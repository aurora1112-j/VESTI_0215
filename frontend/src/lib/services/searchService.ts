import type {
  Conversation,
  ExploreAgentMeta,
  ExploreContextCandidate,
  ExploreMode,
  ExploreToolCall,
  ExploreToolName,
  RagResponse,
  RelatedConversation,
} from "../types";
import { db } from "../db/schema";
import {
  addExploreMessage,
  createExploreSession,
  getExploreMessages,
  getSummary,
  updateExploreSession,
} from "../db/repository";
import { embedText } from "./embeddingService";
import { generateConversationSummary } from "./insightGenerationService";
import { callInference } from "./llmService";
import { getLlmSettings } from "./llmSettingsService";

const MAX_MESSAGE_COUNT = 12;
const MAX_TEXT_LENGTH = 4000;
const MAX_RAG_SOURCES = 5;
const MAX_EMBEDDING_CHARS = 2048;
const AGENT_SUMMARY_SOURCE_LIMIT = 3;

type AgentPlan = {
  sourceLimit: number;
  summaryTargetCount: number;
  reason: string;
};

type SummaryToolResult = {
  snippets: Map<number, string>;
  cacheHits: number;
  generated: number;
  failed: number;
};

type RagRetrievalItem = {
  source: RelatedConversation;
  contextBlock: string;
  excerpt: string;
};

type RagRetrievalResult = {
  sources: RelatedConversation[];
  context: string;
  items: RagRetrievalItem[];
};

function normalizeEmbeddingInput(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= MAX_EMBEDDING_CHARS) return trimmed;
  return trimmed.slice(0, MAX_EMBEDDING_CHARS);
}

function toFloat32Array(value: Float32Array | number[]): Float32Array {
  return value instanceof Float32Array ? value : new Float32Array(value);
}

function buildConversationText(
  conversation: Conversation,
  messageTexts: string[]
): string {
  const chunks = [conversation.title, conversation.snippet, ...messageTexts];
  const combined = chunks.filter(Boolean).join("\n");
  if (combined.length <= MAX_TEXT_LENGTH) return combined;
  return combined.slice(0, MAX_TEXT_LENGTH);
}

function buildConversationContext(
  conversation: Conversation,
  messages: Array<{ role: "user" | "ai"; content_text: string }>
): string {
  const lines = messages
    .slice(0, MAX_MESSAGE_COUNT)
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "AI";
      return `[${role}] ${msg.content_text}`;
    });

  return [
    `[Title] ${conversation.title}`,
    `[Platform] ${conversation.platform}`,
    "[Content]",
    ...lines,
  ].join("\n");
}

function truncateInline(text: string, max = 200): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildHistoryContext(messages: Array<{ role: string; content: string }>): string {
  if (messages.length === 0) return "";

  return `\n\nPrevious conversation context:\n${messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 200)}`)
    .join("\n")}\n\nConsider the above context when answering the new question.`;
}

function buildContextualRagPrompt(
  retrievedContext: string,
  historyContext: string,
  summaryHints?: string
): string {
  const basePrompt =
    "You are Vesti's knowledge base assistant. Answer based primarily on the retrieved conversations below.";
  const summarySection = summaryHints?.trim()
    ? `\nSummary Hints:\n${summaryHints.trim()}\n`
    : "";

  return `${basePrompt}${historyContext}${summarySection}

Retrieved Conversations:
${retrievedContext}

Instructions:
1. If this is a follow-up question, consider the previous conversation context.
2. Answer based primarily on the retrieved conversations.
3. If information is insufficient, say so clearly.
4. Cite specific conversations when possible.
5. Be concise but comprehensive.`;
}

function extractExcerpt(messages: Array<{ content_text: string }>): string {
  const text = messages
    .slice(0, 4)
    .map((message) => message.content_text)
    .filter(Boolean)
    .join("\n");

  return truncateInline(text, 260);
}

function buildLocalFallbackAnswer(query: string, sources: RelatedConversation[]): string {
  if (sources.length === 0) {
    return [
      `I could not find highly similar conversations for: "${truncateInline(query, 120)}".`,
      "Try rephrasing the query or selecting a broader topic.",
      "Tip: configure an LLM in Settings for richer synthesis.",
    ].join("\n");
  }

  const lines = sources
    .slice(0, 5)
    .map(
      (source, index) =>
        `${index + 1}. ${source.title} [${source.platform}] (${source.similarity}% match)`
    );

  return [
    "Model synthesis is unavailable, but these local conversations are most relevant:",
    ...lines,
    "Open a source to inspect details, then ask a narrower follow-up.",
  ].join("\n");
}

function createToolCall(name: ExploreToolName, inputSummary: string): ExploreToolCall {
  const now = Date.now();
  return {
    id: `tool_${now}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    status: "completed",
    startedAt: now,
    endedAt: now,
    durationMs: 0,
    inputSummary,
  };
}

function completeToolCall(call: ExploreToolCall, outputSummary: string): void {
  const endedAt = Date.now();
  call.status = "completed";
  call.endedAt = endedAt;
  call.durationMs = Math.max(0, endedAt - call.startedAt);
  call.outputSummary = outputSummary;
}

function failToolCall(call: ExploreToolCall, error: unknown): void {
  const endedAt = Date.now();
  call.status = "failed";
  call.endedAt = endedAt;
  call.durationMs = Math.max(0, endedAt - call.startedAt);
  call.error = (error as Error)?.message ?? "UNKNOWN_ERROR";
}

async function runToolStep<T>(
  toolCalls: ExploreToolCall[],
  name: ExploreToolName,
  inputSummary: string,
  executor: () => Promise<T>,
  outputSummaryBuilder: (value: T) => string
): Promise<T> {
  const call = createToolCall(name, inputSummary);
  try {
    const value = await executor();
    completeToolCall(call, outputSummaryBuilder(value));
    toolCalls.push(call);
    return value;
  } catch (error) {
    failToolCall(call, error);
    toolCalls.push(call);
    throw error;
  }
}

function buildAgentPlan(query: string, requestedLimit: number): AgentPlan {
  const lowered = query.toLowerCase();
  const isSummaryIntent =
    /summary|summarize|overview|compare|compare all|总结|概览|汇总|整理/.test(lowered);
  const sourceLimit = clamp(requestedLimit || MAX_RAG_SOURCES, 1, 8);
  const summaryTargetCount = isSummaryIntent
    ? clamp(sourceLimit, 1, AGENT_SUMMARY_SOURCE_LIMIT)
    : clamp(Math.min(sourceLimit, 2), 1, AGENT_SUMMARY_SOURCE_LIMIT);

  return {
    sourceLimit,
    summaryTargetCount,
    reason: isSummaryIntent ? "summary_intent_detected" : "default_fact_lookup",
  };
}

function buildSummaryHintsText(
  sources: RelatedConversation[],
  snippets: Map<number, string>
): string {
  const lines: string[] = [];
  for (const source of sources) {
    const snippet = snippets.get(source.id);
    if (!snippet) continue;
    lines.push(`- ${source.title}: ${truncateInline(snippet, 240)}`);
  }
  return lines.join("\n");
}

function buildContextDraft(
  query: string,
  sources: RelatedConversation[],
  candidates: ExploreContextCandidate[]
): string {
  const selectedIds = candidates.map((candidate) => candidate.conversationId);
  const lines: string[] = [
    "# Explore Context Draft",
    "",
    `Query: ${query}`,
    `Generated At: ${new Date().toISOString()}`,
    "",
    "## Selected Source IDs",
    selectedIds.length ? selectedIds.join(", ") : "(none)",
    "",
    "## Source Notes",
  ];

  if (!sources.length) {
    lines.push("- No relevant conversations were retrieved.");
  } else {
    for (const source of sources) {
      const candidate = candidates.find((item) => item.conversationId === source.id);
      lines.push(
        `- ${source.title} [${source.platform}] (${source.similarity}% match)`,
        `  Summary: ${candidate?.summarySnippet || "(not available)"}`,
        `  Excerpt: ${candidate?.excerpt || "(not available)"}`
      );
    }
  }

  lines.push(
    "",
    "## Instruction",
    "Use this draft as a transparent context package for a new conversation. Edit freely before sending."
  );

  return lines.join("\n");
}

async function retrieveRagContext(
  query: string,
  limit: number
): Promise<RagRetrievalResult> {
  const preparedQuery = normalizeEmbeddingInput(query);
  if (!preparedQuery) {
    throw new Error("QUERY_EMPTY");
  }

  const queryVector = toFloat32Array(await embedText(preparedQuery));
  const vectors = await db.vectors.toArray();
  const scored: Array<{ id: number; similarity: number }> = [];

  for (const vector of vectors) {
    const embedding = toFloat32Array(vector.embedding as Float32Array | number[]);
    if (embedding.length !== queryVector.length || embedding.length === 0) continue;
    const similarity = cosineSimilarity(queryVector, embedding);
    if (similarity < 0.15) continue;
    scored.push({ id: vector.conversation_id, similarity });
  }

  const safeLimit = Math.max(1, limit);
  const top = scored.sort((a, b) => b.similarity - a.similarity).slice(0, safeLimit);
  const conversations = top.length
    ? await db.conversations.bulkGet(top.map((item) => item.id))
    : [];
  const byId = new Map<number, Conversation>();

  for (const conversation of conversations) {
    if (conversation?.id !== undefined) {
      byId.set(conversation.id, conversation as Conversation);
    }
  }

  const sources: RelatedConversation[] = [];
  const contextBlocks: string[] = [];
  const items: RagRetrievalItem[] = [];

  for (const topItem of top) {
    const conversation = byId.get(topItem.id);
    if (!conversation) continue;

    const messages = await db.messages
      .where("conversation_id")
      .equals(conversation.id)
      .sortBy("created_at");

    const source: RelatedConversation = {
      id: conversation.id,
      title: conversation.title,
      platform: conversation.platform,
      similarity: Math.round(topItem.similarity * 100),
    };
    const contextBlock = buildConversationContext(conversation, messages);
    const excerpt = extractExcerpt(messages);

    sources.push(source);
    contextBlocks.push(contextBlock);
    items.push({ source, contextBlock, excerpt });
  }

  return {
    sources,
    context: contextBlocks.join("\n\n---\n\n"),
    items,
  };
}

async function resolveSummarySnippets(
  settings: Awaited<ReturnType<typeof getLlmSettings>>,
  sources: RelatedConversation[],
  targetCount: number
): Promise<SummaryToolResult> {
  const snippets = new Map<number, string>();
  let cacheHits = 0;
  let generated = 0;
  let failed = 0;

  for (const source of sources.slice(0, targetCount)) {
    try {
      const existing = await getSummary(source.id);
      if (existing?.content?.trim()) {
        snippets.set(source.id, truncateInline(existing.content, 320));
        cacheHits += 1;
        continue;
      }

      if (!settings) {
        failed += 1;
        continue;
      }

      const synthesized = await generateConversationSummary(settings, source.id);
      if (synthesized?.content?.trim()) {
        snippets.set(source.id, truncateInline(synthesized.content, 320));
        generated += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    snippets,
    cacheHits,
    generated,
    failed,
  };
}

function buildContextCandidates(
  retrieval: RagRetrievalResult,
  summarySnippets: Map<number, string>
): ExploreContextCandidate[] {
  return retrieval.items.map((item) => ({
    conversationId: item.source.id,
    title: item.source.title,
    platform: item.source.platform,
    similarity: item.source.similarity,
    summarySnippet: summarySnippets.get(item.source.id),
    excerpt: item.excerpt,
  }));
}

async function runClassicKnowledgeBase(
  query: string,
  historyContext: string,
  limit: number,
  existingRetrieval?: RagRetrievalResult
): Promise<RagResponse> {
  let retrieval = existingRetrieval;
  if (!retrieval) {
    try {
      retrieval = await retrieveRagContext(query, limit);
    } catch {
      retrieval = {
        sources: [],
        context: "",
        items: [],
      };
    }
  }
  const settings = await getLlmSettings();

  if (!settings) {
    return {
      answer: buildLocalFallbackAnswer(query, retrieval.sources),
      sources: retrieval.sources,
    };
  }

  try {
    const systemPrompt = buildContextualRagPrompt(retrieval.context, historyContext);
    const result = await callInference(settings, query, { systemPrompt });
    const answer = result.content?.trim();
    return {
      answer: answer || buildLocalFallbackAnswer(query, retrieval.sources),
      sources: retrieval.sources,
    };
  } catch {
    return {
      answer: buildLocalFallbackAnswer(query, retrieval.sources),
      sources: retrieval.sources,
    };
  }
}

async function synthesizeAgentAnswer(params: {
  query: string;
  historyContext: string;
  retrieval: RagRetrievalResult;
  summaryHints: string;
  settings: Awaited<ReturnType<typeof getLlmSettings>>;
}): Promise<string> {
  const { query, historyContext, retrieval, summaryHints, settings } = params;
  if (!settings) {
    return buildLocalFallbackAnswer(query, retrieval.sources);
  }

  const systemPrompt = buildContextualRagPrompt(
    retrieval.context,
    historyContext,
    summaryHints
  );

  try {
    const result = await callInference(settings, query, { systemPrompt });
    const answer = result.content?.trim();
    if (!answer) {
      return buildLocalFallbackAnswer(query, retrieval.sources);
    }
    return answer;
  } catch {
    return buildLocalFallbackAnswer(query, retrieval.sources);
  }
}

async function runAgentKnowledgeBase(
  query: string,
  historyContext: string,
  limit: number
): Promise<RagResponse> {
  const toolCalls: ExploreToolCall[] = [];
  const startedAt = Date.now();
  let retrieval: RagRetrievalResult | undefined;
  let contextDraft = "";
  let contextCandidates: ExploreContextCandidate[] = [];
  let selectedContextConversationIds: number[] = [];

  try {
    const plan = await runToolStep(
      toolCalls,
      "query_planner",
      `query="${truncateInline(query, 100)}"`,
      async () => buildAgentPlan(query, limit),
      (value) =>
        `sourceLimit=${value.sourceLimit}, summaryTargetCount=${value.summaryTargetCount}, reason=${value.reason}`
    );

    retrieval = await runToolStep(
      toolCalls,
      "search_rag",
      `sourceLimit=${plan.sourceLimit}`,
      async () => retrieveRagContext(query, plan.sourceLimit),
      (value) => `retrieved=${value.sources.length}`
    );

    const settings = await getLlmSettings();

    const summaryResult = await runToolStep(
      toolCalls,
      "summary_tool",
      `target=${plan.summaryTargetCount}`,
      async () => resolveSummarySnippets(settings, retrieval!.sources, plan.summaryTargetCount),
      (value) =>
        `cacheHits=${value.cacheHits}, generated=${value.generated}, failed=${value.failed}`
    );

    const compiledContext = await runToolStep(
      toolCalls,
      "context_compiler",
      `sources=${retrieval.sources.length}`,
      async () => {
        const candidates = buildContextCandidates(retrieval!, summaryResult.snippets);
        const draft = buildContextDraft(query, retrieval!.sources, candidates);
        return { candidates, draft };
      },
      (value) => `draftChars=${value.draft.length}, candidates=${value.candidates.length}`
    );

    contextCandidates = compiledContext.candidates;
    contextDraft = compiledContext.draft;
    selectedContextConversationIds = contextCandidates.map(
      (candidate) => candidate.conversationId
    );

    const summaryHints = buildSummaryHintsText(retrieval.sources, summaryResult.snippets);
    const answer = await runToolStep(
      toolCalls,
      "answer_synthesizer",
      `sources=${retrieval.sources.length}`,
      async () =>
        synthesizeAgentAnswer({
          query,
          historyContext,
          retrieval: retrieval!,
          summaryHints,
          settings,
        }),
      (value) => `answerChars=${value.length}`
    );

    const agentMeta: ExploreAgentMeta = {
      mode: "agent",
      toolCalls,
      contextDraft,
      contextCandidates,
      selectedContextConversationIds,
      totalDurationMs: Date.now() - startedAt,
    };

    return {
      answer,
      sources: retrieval.sources,
      agent: agentMeta,
    };
  } catch {
    const fallback = await runClassicKnowledgeBase(
      query,
      historyContext,
      limit,
      retrieval
    );

    if (!contextDraft && retrieval) {
      contextCandidates = buildContextCandidates(retrieval, new Map<number, string>());
      contextDraft = buildContextDraft(query, retrieval.sources, contextCandidates);
      selectedContextConversationIds = contextCandidates.map(
        (candidate) => candidate.conversationId
      );
    }

    const agentMeta: ExploreAgentMeta = {
      mode: "agent",
      toolCalls,
      contextDraft,
      contextCandidates,
      selectedContextConversationIds,
      totalDurationMs: Date.now() - startedAt,
    };

    return {
      answer: fallback.answer,
      sources: fallback.sources,
      agent: agentMeta,
    };
  }
}

export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getConversationText(
  conversationId: number
): Promise<{ conversation: Conversation; text: string }> {
  const conversation = await db.conversations.get(conversationId);
  if (!conversation || conversation.id === undefined) {
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  const messages = await db.messages
    .where("conversation_id")
    .equals(conversationId)
    .sortBy("created_at");

  const messageTexts = messages
    .slice(0, MAX_MESSAGE_COUNT)
    .map((message) => message.content_text)
    .filter(Boolean);

  const text = buildConversationText(conversation as Conversation, messageTexts);
  return { conversation: conversation as Conversation, text };
}

export async function ensureVectorForConversation(
  conversationId: number,
  text: string
): Promise<void> {
  const preparedText = normalizeEmbeddingInput(text);
  if (!preparedText) return;

  const textHash = await hashText(preparedText);

  const existing = await db.vectors
    .where("conversation_id")
    .equals(conversationId)
    .and((record) => record.text_hash === textHash)
    .first();
  if (existing && existing.id !== undefined) return;

  const embedding = await embedText(preparedText);

  await db.transaction("rw", db.vectors, async () => {
    await db.vectors
      .where("conversation_id")
      .equals(conversationId)
      .and((record) => record.text_hash !== textHash)
      .delete();

    await db.vectors.add({
      conversation_id: conversationId,
      text_hash: textHash,
      embedding,
    });
  });
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}

export async function findRelatedConversations(
  conversationId: number,
  limit = 3
): Promise<RelatedConversation[]> {
  const { text } = await getConversationText(conversationId);
  await ensureVectorForConversation(conversationId, text);

  const targetVector = await db.vectors
    .where("conversation_id")
    .equals(conversationId)
    .first();
  if (!targetVector) return [];

  const vectors = await db.vectors.toArray();
  const targetEmbedding = toFloat32Array(targetVector.embedding);

  const scores: Array<{ id: number; similarity: number }> = [];
  for (const vector of vectors) {
    if (vector.conversation_id === conversationId) continue;
    const embedding = toFloat32Array(vector.embedding as Float32Array | number[]);
    const similarity = cosineSimilarity(targetEmbedding, embedding);
    scores.push({ id: vector.conversation_id, similarity });
  }

  const top = scores.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  const conversations = await db.conversations.bulkGet(top.map((item) => item.id));
  const byId = new Map<number, Conversation>();
  conversations.forEach((item) => {
    if (item && item.id !== undefined) {
      byId.set(item.id, item as Conversation);
    }
  });

  return top
    .map((item) => {
      const conversation = byId.get(item.id);
      if (!conversation) return null;
      return {
        id: conversation.id,
        title: conversation.title,
        platform: conversation.platform,
        similarity: Math.round(item.similarity * 100),
      } as RelatedConversation;
    })
    .filter(Boolean) as RelatedConversation[];
}

export async function findAllEdges(
  threshold = 0.3
): Promise<Array<{ source: number; target: number; weight: number }>> {
  const vectors = await db.vectors.toArray();
  const edges: Array<{ source: number; target: number; weight: number }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      const left = vectors[i];
      const right = vectors[j];
      if (
        typeof left.conversation_id !== "number" ||
        typeof right.conversation_id !== "number"
      ) {
        continue;
      }

      const a = toFloat32Array(left.embedding as Float32Array | number[]);
      const b = toFloat32Array(right.embedding as Float32Array | number[]);
      if (a.length !== b.length || a.length === 0) continue;

      const similarity = cosineSimilarity(a, b);
      if (similarity < threshold) continue;

      const key = `${left.conversation_id}-${right.conversation_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        source: left.conversation_id,
        target: right.conversation_id,
        weight: Math.round(similarity * 100) / 100,
      });
    }
  }

  return edges;
}

export async function askKnowledgeBase(
  userQuery: string,
  existingSessionId?: string,
  limit = MAX_RAG_SOURCES,
  mode: ExploreMode = "agent"
): Promise<RagResponse & { sessionId: string }> {
  const query = userQuery.trim();
  if (!query) {
    throw new Error("QUERY_EMPTY");
  }

  let sessionId = existingSessionId;
  if (!sessionId) {
    sessionId = await createExploreSession(query.slice(0, 100));
  }

  await addExploreMessage(sessionId, {
    role: "user",
    content: query,
    timestamp: Date.now(),
  });

  const recentMessages = await getExploreMessages(sessionId);
  const historyContext = buildHistoryContext(recentMessages.slice(-6));

  const result =
    mode === "classic"
      ? await runClassicKnowledgeBase(query, historyContext, limit)
      : await runAgentKnowledgeBase(query, historyContext, limit);

  await addExploreMessage(sessionId, {
    role: "assistant",
    content: result.answer,
    sources: result.sources,
    agentMeta: result.agent,
    timestamp: Date.now(),
  });

  await updateExploreSession(sessionId, {
    preview: result.answer.slice(0, 100),
  });

  return {
    ...result,
    sessionId,
  };
}

export async function hybridSearch(query: string): Promise<RagResponse> {
  return askKnowledgeBase(query, undefined, MAX_RAG_SOURCES, "agent");
}

export async function getVectorStats(): Promise<{
  totalVectors: number;
  totalConversations: number;
  vectorizedConversations: number;
  unvectorizedConversations: number;
}> {
  const totalVectors = await db.vectors.count();
  const allConversations = await db.conversations.toArray();
  const totalConversations = allConversations.length;

  const vectorizedIds = new Set<number>();
  const vectors = await db.vectors.toArray();
  vectors.forEach((v) => vectorizedIds.add(v.conversation_id));

  return {
    totalVectors,
    totalConversations,
    vectorizedConversations: vectorizedIds.size,
    unvectorizedConversations: totalConversations - vectorizedIds.size,
  };
}

export async function vectorizeAllConversations(): Promise<number> {
  const conversations = await db.conversations.toArray();

  let created = 0;
  for (const conversation of conversations) {
    if (!conversation?.id) continue;
    try {
      const { text } = await getConversationText(conversation.id);
      await ensureVectorForConversation(conversation.id, text);
      created += 1;
    } catch (err) {
      console.error(
        "[Vectorize] Failed to vectorize conv",
        conversation.id,
        ":",
        (err as Error).message
      );
    }
  }

  return created;
}

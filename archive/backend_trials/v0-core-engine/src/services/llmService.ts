import type { Conversation, Message, LlmConfig } from "../types";
import { logger } from "../utils/logger";

const SYSTEM_PROMPT =
  "You are a careful summarization assistant. Output concise, structured bullet points.";

function ensureConfig(config: LlmConfig): void {
  if (!config.baseUrl) {
    throw new Error("LLM_CONFIG_MISSING:BASE_URL");
  }
  if (!config.apiKey) {
    throw new Error("LLM_CONFIG_MISSING:API_KEY");
  }
  if (!config.modelId) {
    throw new Error("LLM_CONFIG_MISSING:MODEL_ID");
  }
}

export function truncateForContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}
[...truncated...]`;
}

export function buildSummaryPrompt(messages: Message[], lang: "zh" | "en" = "zh"): string {
  const lines = messages.map((msg) => {
    const role = msg.role === "user" ? "User" : "AI";
    return `[${role}] ${msg.content_text}`;
  });

  const instructions =
    lang === "zh"
      ? `Please write the summary in Chinese. Requirements:
1) 3-6 bullet points
2) highlight key takeaways or action items
3) keep it concise
`
      : `Generate a concise summary with 3-6 bullet points and key takeaways.
`;

  return `${instructions}
Conversation:
${lines.join("\n")}`;
}

export function buildWeeklyPrompt(
  conversations: Conversation[],
  lang: "zh" | "en" = "zh"
): string {
  const items = conversations.map((c, index) => {
    return `${index + 1}. [${c.platform}] ${c.title} - ${c.snippet}`;
  });

  const instructions =
    lang === "zh"
      ? `Please write the weekly report in Chinese. Requirements:
1) list main themes
2) mention trends or recurring topics
3) output as bullet points
`
      : `Write a weekly report with themes, trends, and key highlights.
`;

  return `${instructions}
Weekly conversations:
${items.join("\n")}`;
}

export function buildWeeklySourceHash(
  conversations: Conversation[],
  rangeStart: number,
  rangeEnd: number
): string {
  const payload = conversations
    .map((c) => `${c.id}:${c.updated_at}`)
    .join("|");
  return `${rangeStart}-${rangeEnd}-${payload}`;
}

export async function callModelScope(
  config: LlmConfig,
  prompt: string
): Promise<string> {
  ensureConfig(config);

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelId,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      "llm",
      `ModelScope request failed: ${response.status}`,
      new Error(errorText)
    );
    throw new Error(`LLM_REQUEST_FAILED:${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("LLM_RESPONSE_EMPTY");
  }

  return content;
}

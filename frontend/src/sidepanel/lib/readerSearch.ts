import type { Message, Platform } from "~lib/types";
import type { AstNode, AstRoot } from "~lib/types/ast";
import {
  astNodeToPlainText,
  extractAstPlainText,
  inspectAstStructure,
  type AstStructureStats,
} from "~lib/utils/astText";
import type { ReaderOccurrence } from "../types/threadsSearch";

const MIN_QUERY_LENGTH = 1;
const MIN_AST_COVERAGE_RATIO = 0.55;
const MIN_MATH_AST_COVERAGE_RATIO = 0.2;
const MIN_TEXT_LENGTH_FOR_AST_CHECK = 120;
const CLAUDE_RICH_AST_COVERAGE_FLOOR = 0.22;
const GEMINI_USER_PREFIX_PATTERN = /^[\s\u200B\uFEFF]*you said(?:\s*[:\-])?\s*/i;
const LANGUAGE_TOKEN_PATTERN = /^[a-z0-9+#.-]{1,24}$/i;
const LANGUAGE_NOISE_TOKENS = new Set([
  "copy",
  "copied",
  "code",
  "plain",
  "plaintext",
  "text",
]);
const FALLBACK_SEGMENT_PATTERN = /(```[\s\S]*?```|\*\*.*?\*\*)/g;

export interface MessageRenderPlan {
  mode: "ast" | "fallback";
  renderAst: AstRoot | null;
}

export interface ReaderSearchArtifacts {
  occurrences: ReaderOccurrence[];
  renderPlanByMessageId: Record<number, MessageRenderPlan>;
}

export interface ReaderOccurrenceIndex {
  index: number;
  occurrence: ReaderOccurrence;
}

export type OccurrenceIndexMap = Record<string, ReaderOccurrenceIndex[]>;

export interface HighlightSegment {
  text: string;
  occurrenceIndex: number | null;
}

export type FallbackSegmentType = "text" | "bold" | "code_block";

export interface FallbackSegment {
  type: FallbackSegmentType;
  text: string;
  nodeKey: string;
}

interface TextOccurrence {
  charOffset: number;
  length: number;
}

interface OccurrenceIndexRef {
  current: number;
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function buildReaderSearchArtifacts(params: {
  messages: Message[];
  platform: Platform;
  query: string;
}): ReaderSearchArtifacts {
  const { messages, platform, query } = params;
  const normalizedQuery = normalizeSearchQuery(query);
  const renderPlanByMessageId: Record<number, MessageRenderPlan> = {};
  const occurrences: ReaderOccurrence[] = [];
  const occurrenceIndexRef: OccurrenceIndexRef = { current: 0 };

  for (const message of messages) {
    const renderPlan = resolveMessageRenderPlan(message, platform);
    renderPlanByMessageId[message.id] = renderPlan;
    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      continue;
    }

    if (renderPlan.mode === "ast" && renderPlan.renderAst) {
      appendAstOccurrences(
        occurrences,
        occurrenceIndexRef,
        message.id,
        renderPlan.renderAst,
        normalizedQuery
      );
      continue;
    }

    appendFallbackOccurrences(
      occurrences,
      occurrenceIndexRef,
      message.id,
      message.content_text,
      normalizedQuery
    );
  }

  return { occurrences, renderPlanByMessageId };
}

export function buildOccurrenceIndexMap(
  occurrences: ReaderOccurrence[]
): OccurrenceIndexMap {
  const map: OccurrenceIndexMap = {};
  occurrences.forEach((occurrence: ReaderOccurrence, index: number) => {
    const list = map[occurrence.nodeKey];
    if (list) {
      list.push({ index, occurrence });
      return;
    }
    map[occurrence.nodeKey] = [{ index, occurrence }];
  });
  return map;
}

export function buildHighlightSegments(
  text: string,
  occurrenceIndexes: ReaderOccurrenceIndex[] | undefined
): HighlightSegment[] {
  if (!occurrenceIndexes || occurrenceIndexes.length === 0) {
    return [{ text, occurrenceIndex: null }];
  }

  const sorted = [...occurrenceIndexes].sort(
    (left: ReaderOccurrenceIndex, right: ReaderOccurrenceIndex) =>
      left.occurrence.charOffset - right.occurrence.charOffset
  );
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const entry of sorted) {
    const { charOffset, length } = entry.occurrence;
    if (charOffset < cursor) {
      continue;
    }
    if (charOffset > text.length) {
      continue;
    }
    const end = Math.min(text.length, charOffset + length);
    if (charOffset > cursor) {
      segments.push({
        text: text.slice(cursor, charOffset),
        occurrenceIndex: null,
      });
    }
    if (end > charOffset) {
      segments.push({
        text: text.slice(charOffset, end),
        occurrenceIndex: entry.index,
      });
      cursor = end;
    }
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), occurrenceIndex: null });
  }

  return segments;
}

export function buildFallbackSegments(
  text: string,
  messageId: number
): FallbackSegment[] {
  const parts = text.split(FALLBACK_SEGMENT_PATTERN);
  const segments: FallbackSegment[] = [];

  parts.forEach((part: string, index: number) => {
    if (!part) return;
    const nodeKey = buildFallbackNodeKey(messageId, index);
    if (part.startsWith("```") && part.endsWith("```")) {
      segments.push({ type: "code_block", text: part, nodeKey });
      return;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      segments.push({ type: "bold", text: part.slice(2, -2), nodeKey });
      return;
    }
    segments.push({ type: "text", text: part, nodeKey });
  });

  return segments;
}

export function resolveMessageRenderPlan(
  message: Message,
  platform: Platform
): MessageRenderPlan {
  const rawAst = message.content_ast;
  if (
    !rawAst ||
    rawAst.type !== "root" ||
    message.content_ast_version !== "ast_v1"
  ) {
    return { mode: "fallback", renderAst: null };
  }

  const renderAst = sanitizeAstForRender(rawAst, message.role, platform);
  const sourceTextLen = normalizeForCoverage(message.content_text).length;
  const astTextLen = normalizeForCoverage(extractAstPlainText(renderAst)).length;
  const astStats = inspectAstStructure(renderAst);
  const astCoverageRatio = sourceTextLen > 0 ? astTextLen / sourceTextLen : 1;
  const hasRenderableAst = renderAst.children.length > 0;
  const shouldUseAst =
    hasRenderableAst &&
    (sourceTextLen < MIN_TEXT_LENGTH_FOR_AST_CHECK ||
      (astStats.hasMath && astCoverageRatio >= MIN_MATH_AST_COVERAGE_RATIO) ||
      astCoverageRatio >= resolveCoverageFloor(platform, astStats));

  return {
    mode: shouldUseAst ? "ast" : "fallback",
    renderAst: shouldUseAst ? renderAst : null,
  };
}

export function buildAstNodeKey(
  messageId: number,
  pathSegments: string[]
): string {
  if (pathSegments.length === 0) {
    return `msg-${messageId}`;
  }
  return `msg-${messageId}:${pathSegments.join(":")}`;
}

export function formatAstPathSegment(node: AstNode, index: number): string {
  return `${node.type}[${index}]`;
}

export function buildFallbackNodeKey(
  messageId: number,
  segmentIndex: number
): string {
  return `msg-${messageId}:fallback[${segmentIndex}]`;
}

export function sanitizeRootForRender(root: AstRoot): AstRoot {
  return {
    ...root,
    children: sanitizeLanguageLeakage(root.children),
  };
}

function appendAstOccurrences(
  occurrences: ReaderOccurrence[],
  occurrenceIndexRef: OccurrenceIndexRef,
  messageId: number,
  root: AstRoot,
  normalizedQuery: string
): void {
  const sanitizedRoot = sanitizeRootForRender(root);
  const walk = (node: AstNode, path: string[]): void => {
    if (node.type === "text") {
      appendOccurrencesFromText(
        occurrences,
        occurrenceIndexRef,
        messageId,
        buildAstNodeKey(messageId, path),
        node.text,
        normalizedQuery
      );
      return;
    }

    if (node.type === "code_inline") {
      appendOccurrencesFromText(
        occurrences,
        occurrenceIndexRef,
        messageId,
        buildAstNodeKey(messageId, path),
        node.text,
        normalizedQuery
      );
      return;
    }

    if (
      node.type === "code_block" ||
      node.type === "math" ||
      node.type === "table" ||
      node.type === "attachment" ||
      node.type === "br"
    ) {
      return;
    }

    if (
      node.type === "fragment" ||
      node.type === "p" ||
      node.type === "h1" ||
      node.type === "h2" ||
      node.type === "h3" ||
      node.type === "ul" ||
      node.type === "ol" ||
      node.type === "li" ||
      node.type === "strong" ||
      node.type === "em" ||
      node.type === "blockquote"
    ) {
      node.children.forEach((child: AstNode, index: number) => {
        walk(child, [...path, formatAstPathSegment(child, index)]);
      });
    }
  };

  sanitizedRoot.children.forEach((child: AstNode, index: number) => {
    walk(child, [formatAstPathSegment(child, index)]);
  });
}

function appendFallbackOccurrences(
  occurrences: ReaderOccurrence[],
  occurrenceIndexRef: OccurrenceIndexRef,
  messageId: number,
  text: string,
  normalizedQuery: string
): void {
  const segments = buildFallbackSegments(text, messageId);
  for (const segment of segments) {
    if (segment.type === "code_block") {
      continue;
    }
    appendOccurrencesFromText(
      occurrences,
      occurrenceIndexRef,
      messageId,
      segment.nodeKey,
      segment.text,
      normalizedQuery
    );
  }
}

function appendOccurrencesFromText(
  occurrences: ReaderOccurrence[],
  occurrenceIndexRef: OccurrenceIndexRef,
  messageId: number,
  nodeKey: string,
  text: string,
  normalizedQuery: string
): void {
  const matches = findTextOccurrences(text, normalizedQuery);
  for (const match of matches) {
    occurrences.push({
      occurrenceKey: `occ-${occurrenceIndexRef.current}`,
      messageId,
      nodeKey,
      charOffset: match.charOffset,
      length: match.length,
    });
    occurrenceIndexRef.current += 1;
  }
}

function findTextOccurrences(
  text: string,
  normalizedQuery: string
): TextOccurrence[] {
  if (!normalizedQuery || normalizedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }
  const lower = text.toLowerCase();
  const occurrences: TextOccurrence[] = [];
  let index = 0;
  while (index < text.length) {
    const matchIndex = lower.indexOf(normalizedQuery, index);
    if (matchIndex === -1) {
      break;
    }
    occurrences.push({ charOffset: matchIndex, length: normalizedQuery.length });
    index = matchIndex + normalizedQuery.length;
  }
  return occurrences;
}

function normalizeForCoverage(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function resolveCoverageFloor(
  platform: Platform,
  stats: AstStructureStats | null
): number {
  if (!stats) {
    return MIN_AST_COVERAGE_RATIO;
  }

  if (stats.hasBlockquote) {
    return CLAUDE_RICH_AST_COVERAGE_FLOOR;
  }

  const richClaudeAst =
    platform === "Claude" &&
    (
      stats.hasTable ||
      stats.hasList ||
      stats.hasCodeBlock ||
      (stats.hasMath && stats.blockNodes >= 2) ||
      stats.blockNodes >= 4
    );

  return richClaudeAst ? CLAUDE_RICH_AST_COVERAGE_FLOOR : MIN_AST_COVERAGE_RATIO;
}
function sanitizeAstForRender(
  root: AstRoot,
  role: Message["role"],
  platform: Platform
): AstRoot {
  if (role !== "user" || platform !== "Gemini") {
    return root;
  }

  const cloned = JSON.parse(JSON.stringify(root)) as AstRoot;
  stripLeadingGeminiPrefix(cloned.children);
  return cloned;
}

function stripLeadingGeminiPrefix(nodes: AstNode[]): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node) continue;

    if (node.type === "text") {
      const stripped = node.text.replace(GEMINI_USER_PREFIX_PATTERN, "");
      if (stripped !== node.text) {
        if (stripped.trim().length === 0) {
          nodes.splice(index, 1);
        } else {
          node.text = stripped;
        }
        return true;
      }

      if (node.text.trim().length === 0) {
        nodes.splice(index, 1);
        index -= 1;
        continue;
      }
      return false;
    }

    if (node.type === "br") {
      continue;
    }

    if (
      node.type === "fragment" ||
      node.type === "p" ||
      node.type === "h1" ||
      node.type === "h2" ||
      node.type === "h3" ||
      node.type === "ul" ||
      node.type === "ol" ||
      node.type === "li" ||
      node.type === "strong" ||
      node.type === "em" ||
      node.type === "blockquote"
    ) {
      const changed = stripLeadingGeminiPrefix(node.children);
      if (node.children.length === 0) {
        nodes.splice(index, 1);
        index -= 1;
        continue;
      }
      return changed;
    }

    return false;
  }

  return false;
}

function normalizeLanguageToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const prefixed = normalized.match(
    /^(?:language|lang)[:_\-\s]*([a-z0-9+#.-]{1,24})$/i
  );
  const token = (prefixed?.[1] ? prefixed[1] : normalized).toLowerCase();
  if (!LANGUAGE_TOKEN_PATTERN.test(token) || LANGUAGE_NOISE_TOKENS.has(token)) {
    return null;
  }
  return token;
}

function extractLanguageLeakToken(node: AstNode): string | null {
  if (node.type === "text") {
    return normalizeLanguageToken(node.text);
  }
  if (node.type !== "p") {
    return null;
  }
  const text = astNodeToPlainText(node).trim();
  return normalizeLanguageToken(text);
}

function sanitizeLanguageLeakage(nodes: AstNode[]): AstNode[] {
  const sanitizedChildren = nodes.map((node: AstNode) => {
    if (
      node.type === "fragment" ||
      node.type === "p" ||
      node.type === "h1" ||
      node.type === "h2" ||
      node.type === "h3" ||
      node.type === "ul" ||
      node.type === "ol" ||
      node.type === "li" ||
      node.type === "strong" ||
      node.type === "em" ||
      node.type === "blockquote"
    ) {
      return {
        ...node,
        children: sanitizeLanguageLeakage(node.children),
      };
    }
    return node;
  });

  const result: AstNode[] = [];
  for (let i = 0; i < sanitizedChildren.length; i += 1) {
    const current = sanitizedChildren[i];
    const next = sanitizedChildren[i + 1];
    if (next?.type === "code_block") {
      const codeLanguage = normalizeLanguageToken(next.language);
      const leakToken = current ? extractLanguageLeakToken(current) : null;
      if (codeLanguage && leakToken && codeLanguage === leakToken) {
        continue;
      }
    }
    result.push(current);
  }

  return result;
}


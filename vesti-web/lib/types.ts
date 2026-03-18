export type Platform =
  | 'ChatGPT'
  | 'Claude'
  | 'Gemini'
  | 'DeepSeek'
  | 'Qwen'
  | 'Doubao';

export type AstVersion = 'ast_v1';

export interface AstRoot {
  type: 'root';
  children: AstNode[];
}

export type AstNode =
  | AstTextNode
  | AstFragmentNode
  | AstParagraphNode
  | AstHeadingNode
  | AstBreakNode
  | AstListNode
  | AstListItemNode
  | AstCodeBlockNode
  | AstInlineCodeNode
  | AstStrongNode
  | AstEmphasisNode
  | AstTableNode
  | AstMathNode
  | AstAttachmentNode
  | AstBlockquoteNode;

export interface AstTextNode {
  type: 'text';
  text: string;
}

export interface AstFragmentNode {
  type: 'fragment';
  children: AstNode[];
}

export interface AstParagraphNode {
  type: 'p';
  children: AstNode[];
}

export interface AstHeadingNode {
  type: 'h1' | 'h2' | 'h3';
  children: AstNode[];
}

export interface AstBreakNode {
  type: 'br';
}

export interface AstListNode {
  type: 'ul' | 'ol';
  children: AstNode[];
}

export interface AstListItemNode {
  type: 'li';
  children: AstNode[];
}

export interface AstCodeBlockNode {
  type: 'code_block';
  code: string;
  language?: string | null;
}

export interface AstInlineCodeNode {
  type: 'code_inline';
  text: string;
}

export interface AstStrongNode {
  type: 'strong';
  children: AstNode[];
}

export interface AstEmphasisNode {
  type: 'em';
  children: AstNode[];
}

export interface AstTableNode {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface AstMathNode {
  type: 'math';
  tex: string;
  display?: boolean;
}

export interface AstAttachmentNode {
  type: 'attachment';
  name: string;
  mime?: string | null;
}

export interface AstBlockquoteNode {
  type: 'blockquote';
  children: AstNode[];
}

export interface Topic {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: number;
  updated_at: number;
  count?: number;
  children?: Topic[];
}

export interface GardenerStep {
  step: string;
  status: 'pending' | 'running' | 'completed';
  details?: string;
}

export interface GardenerResult {
  tags: string[];
  matchedTopic?: Topic;
  createdTopic?: Topic;
  steps: GardenerStep[];
}

export interface Conversation {
  id: number;
  title: string;
  platform: Platform;
  snippet: string;
  tags: string[];
  topic_id: number | null;
  source_created_at: number | null;
  first_captured_at: number;
  last_captured_at: number;
  created_at: number;
  updated_at: number;
  is_starred: boolean;
  is_archived?: boolean;
  is_trash?: boolean;
  has_note?: boolean;
}

export interface AgentStep {
  step: string;
  status: 'pending' | 'running' | 'completed';
  details?: string;
}

export interface RelatedConversation {
  id: number;
  title: string;
  similarity: number;
  platform: Platform;
}

export interface RagResponse {
  answer: string;
  sources: RelatedConversation[];
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'ai';
  content_text: string;
  content_ast?: AstRoot | null;
  content_ast_version?: AstVersion | null;
  degraded_nodes_count?: number;
  created_at: number;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  linked_conversation_ids: number[];
  created_at: number;
  updated_at: number;
  tags: string[];
}

export type ExportFormat = 'json' | 'txt' | 'md';
export type StorageUsageStatus = 'ok' | 'warning' | 'blocked';

export interface StorageUsageSnapshot {
  originUsed: number;
  originQuota: number | null;
  localUsed: number;
  unlimitedStorageEnabled: boolean;
  softLimit: number;
  hardLimit: number;
  status: StorageUsageStatus;
}

export interface ChatSummaryData {
  meta: {
    title: string;
    generated_at: string;
    tags: string[];
    fallback: boolean;
    range_label?: string;
  };
  core_question: string;
  thinking_journey: Array<{
    step: number;
    speaker: "User" | "AI";
    assertion: string;
    real_world_anchor: string | null;
  }>;
  key_insights: Array<{ term: string; definition: string }>;
  unresolved_threads: string[];
  meta_observations: {
    thinking_style: string;
    emotional_tone: string;
    depth_level: "superficial" | "moderate" | "deep";
  };
  actionable_next_steps: string[];
  plain_text?: string;
}

export interface SummaryRecord {
  id: number;
  conversationId: number;
  content: string;
  structured?: Record<string, unknown> | null;
  modelId: string;
  createdAt: number;
  sourceUpdatedAt: number;
}

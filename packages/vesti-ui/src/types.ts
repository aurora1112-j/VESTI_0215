export type Platform =
  | "ChatGPT"
  | "Claude"
  | "Gemini"
  | "DeepSeek"
  | "Qwen"
  | "Doubao";

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
  status: "pending" | "running" | "completed";
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
  created_at: number;
  updated_at: number;
  is_starred: boolean;
  is_archived?: boolean;
  is_trash?: boolean;
  has_note?: boolean;
}

export interface RelatedConversation {
  id: number;
  title: string;
  platform: Platform;
  similarity: number;
}

export interface RagResponse {
  answer: string;
  sources: RelatedConversation[];
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "ai";
  content_text: string;
  created_at: number;
}

export type ConversationFilters = {
  platform?: Platform;
  search?: string;
  dateRange?: { start: number; end: number };
};

export type StorageApi = {
  getTopics: () => Promise<Topic[]>;
  getConversations: (filters?: ConversationFilters) => Promise<Conversation[]>;
  runGardener?: (
    conversationId: number
  ) => Promise<{ updated: boolean; conversation: Conversation; result: GardenerResult }>;
  getRelatedConversations?: (
    conversationId: number,
    limit?: number
  ) => Promise<RelatedConversation[]>;
  getAllEdges?: (
    threshold?: number
  ) => Promise<Array<{ source: number; target: number; weight: number }>>;
  getMessages?: (conversationId: number) => Promise<Message[]>;
  updateConversation?: (
    id: number,
    changes: { topic_id?: number | null; is_starred?: boolean; tags?: string[] }
  ) => Promise<{ updated: boolean; conversation: Conversation }>;
  updateConversationTitle?: (id: number, title: string) => Promise<Conversation>;
  deleteConversation?: (id: number) => Promise<void>;
  renameFolderTag?: (
    from: string,
    to: string
  ) => Promise<{ updated: number }>;
  moveFolderTag?: (
    from: string,
    to: string
  ) => Promise<{ updated: number }>;
  removeFolderTag?: (tag: string) => Promise<{ updated: number }>;
  askKnowledgeBase?: (query: string, limit?: number) => Promise<RagResponse>;
  getSummary?: (conversationId: number) => Promise<ChatSummaryData | null>;
  generateSummary?: (conversationId: number) => Promise<ChatSummaryData>;
  getNotes?: () => Promise<Note[]>;
  saveNote?: (note: Omit<Note, "id" | "created_at" | "updated_at">) => Promise<Note>;
  updateNote?: (
    id: number,
    changes: Partial<Pick<Note, "title" | "content">>
  ) => Promise<Note>;
  deleteNote?: (id: number) => Promise<void>;
};

export interface ArtifactMetaData {
  title: string;
  generated_at: string;
  tags: string[];
  fallback: boolean;
  range_label?: string;
}

export interface ChatSummaryData {
  meta: ArtifactMetaData;
  core_question: string;
  thinking_journey: Array<{
    step: number;
    speaker: "User" | "AI";
    assertion: string;
    real_world_anchor: string | null;
  }>;
  key_insights: Array<{
    term: string;
    definition: string;
  }>;
  unresolved_threads: string[];
  meta_observations: {
    thinking_style: string;
    emotional_tone: string;
    depth_level: "superficial" | "moderate" | "deep";
  };
  actionable_next_steps: string[];
  plain_text?: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
  linked_conversation_ids: number[];
}

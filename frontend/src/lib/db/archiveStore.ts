import type {
  AnnotationRecord,
  ConversationRecord,
  ExploreMessageRecord,
  ExploreSessionRecord,
  MessageRecord,
  NoteRecord,
  SummaryRecordRecord,
  TopicRecord,
  WeeklyReportRecordRecord
} from "./schema"

export type KnowledgeConversationRecord = ConversationRecord & { id: number }
export type KnowledgeMessageRecord = MessageRecord & { id: number }
export type KnowledgeTopicRecord = TopicRecord & { id: number }
export type KnowledgeNoteRecord = NoteRecord & { id: number }
export type KnowledgeAnnotationRecord = AnnotationRecord & { id: number }
export type KnowledgeSummaryRecord = SummaryRecordRecord & { id: number }
export type KnowledgeWeeklyReportRecord = WeeklyReportRecordRecord & {
  id: number
}

export interface KnowledgeEmbeddingRecord {
  target_type: "conversation"
  target_id: number
  chunk_id: string
  text_hash: string
  embedding: Float32Array
  updated_at: number
}

export interface KnowledgeSnapshot {
  exportedAt: number
  conversations: KnowledgeConversationRecord[]
  messages: KnowledgeMessageRecord[]
  topics: KnowledgeTopicRecord[]
  notes: KnowledgeNoteRecord[]
  annotations: KnowledgeAnnotationRecord[]
  summaries: KnowledgeSummaryRecord[]
  weeklyReports: KnowledgeWeeklyReportRecord[]
  exploreSessions: ExploreSessionRecord[]
  exploreMessages: ExploreMessageRecord[]
  embeddings: KnowledgeEmbeddingRecord[]
}

export interface KnowledgeConversationDelta {
  exportedAt: number
  conversationIds: number[]
  conversations: KnowledgeConversationRecord[]
  messages: KnowledgeMessageRecord[]
  annotations: KnowledgeAnnotationRecord[]
  summaries: KnowledgeSummaryRecord[]
  embeddings: KnowledgeEmbeddingRecord[]
}

export interface KnowledgeValidationDigest {
  counts: {
    conversations: number
    messages: number
    topics: number
    notes: number
    annotations: number
    summaries: number
    weeklyReports: number
    exploreSessions: number
    exploreMessages: number
    embeddings: number
  }
  samples: {
    conversations: number[]
    messages: number[]
    notes: number[]
    annotations: number[]
    exploreSessions: string[]
    exploreMessages: string[]
  }
}

export interface ArchiveStore {
  exportKnowledgeSnapshot(): Promise<KnowledgeSnapshot>
  exportConversationDelta(
    conversationIds: number[]
  ): Promise<KnowledgeConversationDelta>
  buildValidationDigest(snapshot: KnowledgeSnapshot): KnowledgeValidationDigest
}

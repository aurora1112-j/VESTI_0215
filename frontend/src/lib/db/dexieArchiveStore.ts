import type {
  ArchiveStore,
  KnowledgeConversationDelta,
  KnowledgeSnapshot
} from "./archiveStore"
import { db } from "./schema"

function toFloat32Array(value: Float32Array | number[]): Float32Array {
  return value instanceof Float32Array ? value : Float32Array.from(value)
}

function hasNumericId<T extends { id?: number }>(
  record: T
): record is T & { id: number } {
  return typeof record.id === "number" && Number.isFinite(record.id)
}

function normalizeConversationIds(conversationIds: number[]): number[] {
  return Array.from(
    new Set(
      conversationIds
        .filter((value) => typeof value === "number" && Number.isFinite(value))
        .map((value) => Math.floor(value))
        .filter((value) => value > 0)
    )
  ).sort((left, right) => left - right)
}

async function exportEmbeddings(conversationIds?: number[]) {
  const exportedAt = Date.now()
  const vectorRecords =
    Array.isArray(conversationIds) && conversationIds.length > 0
      ? await db.vectors
          .where("conversation_id")
          .anyOf(conversationIds)
          .toArray()
      : await db.vectors.toArray()

  return vectorRecords
    .filter(
      (record) =>
        typeof record.conversation_id === "number" && record.conversation_id > 0
    )
    .map((record) => ({
      target_type: "conversation" as const,
      target_id: record.conversation_id,
      chunk_id: `${record.conversation_id}:0`,
      text_hash: record.text_hash,
      embedding: toFloat32Array(record.embedding as Float32Array | number[]),
      updated_at: exportedAt
    }))
}

function buildValidationDigest(snapshot: KnowledgeSnapshot) {
  return {
    counts: {
      conversations: snapshot.conversations.length,
      messages: snapshot.messages.length,
      topics: snapshot.topics.length,
      notes: snapshot.notes.length,
      annotations: snapshot.annotations.length,
      summaries: snapshot.summaries.length,
      weeklyReports: snapshot.weeklyReports.length,
      exploreSessions: snapshot.exploreSessions.length,
      exploreMessages: snapshot.exploreMessages.length,
      embeddings: snapshot.embeddings.length
    },
    samples: {
      conversations: snapshot.conversations
        .slice(0, 5)
        .map((record) => record.id),
      messages: snapshot.messages.slice(0, 5).map((record) => record.id),
      notes: snapshot.notes.slice(0, 5).map((record) => record.id),
      annotations: snapshot.annotations.slice(0, 5).map((record) => record.id),
      exploreSessions: snapshot.exploreSessions
        .slice(0, 5)
        .map((record) => record.id),
      exploreMessages: snapshot.exploreMessages
        .slice(0, 5)
        .map((record) => record.id)
    }
  }
}

async function exportKnowledgeSnapshot(): Promise<KnowledgeSnapshot> {
  const exportedAt = Date.now()
  const [
    conversations,
    messages,
    topics,
    notes,
    annotations,
    summaries,
    weeklyReports,
    exploreSessions,
    exploreMessages,
    embeddings
  ] = await Promise.all([
    db.conversations.toArray(),
    db.messages.toArray(),
    db.topics.toArray(),
    db.notes.toArray(),
    db.annotations.toArray(),
    db.summaries.toArray(),
    db.weekly_reports.toArray(),
    db.explore_sessions.orderBy("id").toArray(),
    db.explore_messages.orderBy("id").toArray(),
    exportEmbeddings()
  ])

  return {
    exportedAt,
    conversations: conversations
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    messages: messages
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    topics: topics
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    notes: notes.filter(hasNumericId).sort((left, right) => left.id - right.id),
    annotations: annotations
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    summaries: summaries
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    weeklyReports: weeklyReports
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    exploreSessions,
    exploreMessages,
    embeddings: embeddings.sort(
      (left, right) => left.target_id - right.target_id
    )
  }
}

async function exportConversationDelta(
  conversationIds: number[]
): Promise<KnowledgeConversationDelta> {
  const normalizedIds = normalizeConversationIds(conversationIds)
  if (normalizedIds.length === 0) {
    return {
      exportedAt: Date.now(),
      conversationIds: [],
      conversations: [],
      messages: [],
      annotations: [],
      summaries: [],
      embeddings: []
    }
  }

  const [conversations, messages, annotations, summaries, embeddings] =
    await Promise.all([
      db.conversations.bulkGet(normalizedIds),
      db.messages.where("conversation_id").anyOf(normalizedIds).toArray(),
      db.annotations.where("conversation_id").anyOf(normalizedIds).toArray(),
      db.summaries.where("conversationId").anyOf(normalizedIds).toArray(),
      exportEmbeddings(normalizedIds)
    ])

  return {
    exportedAt: Date.now(),
    conversationIds: normalizedIds,
    conversations: conversations
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    messages: messages
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    annotations: annotations
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    summaries: summaries
      .filter(hasNumericId)
      .sort((left, right) => left.id - right.id),
    embeddings: embeddings.sort(
      (left, right) => left.target_id - right.target_id
    )
  }
}

export const dexieArchiveStore: ArchiveStore = {
  exportKnowledgeSnapshot,
  exportConversationDelta,
  buildValidationDigest
}

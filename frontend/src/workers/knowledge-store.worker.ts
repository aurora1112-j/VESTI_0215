import sqlite3InitModule, {
  type Database,
  type OpfsSAHPoolDatabase,
  type PreparedStatement
} from "@sqlite.org/sqlite-wasm"

import type {
  KnowledgeConversationDelta,
  KnowledgeEmbeddingRecord,
  KnowledgeSnapshot,
  KnowledgeValidationDigest
} from "../lib/db/archiveStore"
import type {
  KnowledgeRagRetrievalResult,
  KnowledgeWorkerRequest,
  KnowledgeWorkerResponse,
  KnowledgeWorkerResultMap
} from "../lib/db/knowledgeWorkerProtocol"
import type { ConversationFilters } from "../lib/messaging/protocol"
import type {
  Annotation,
  Conversation,
  ConversationMatchSummary,
  DashboardStats,
  InsightFormat,
  InsightStatus,
  Platform,
  RelatedConversation,
  Topic
} from "../lib/types"

const MATERIALIZED_EDGE_MIN_WEIGHT = 0.1
const RAG_SIMILARITY_FLOOR = 0.15
const MAX_RAG_MESSAGE_COUNT = 12
const MAX_RAG_EXCERPT_LENGTH = 260

const FIRST_CAPTURED_AT_SQL = `
  CASE
    WHEN first_captured_at IS NOT NULL AND first_captured_at > 0 THEN first_captured_at
    ELSE created_at
  END
`

const ORIGIN_AT_SQL = `
  CASE
    WHEN source_created_at IS NOT NULL AND source_created_at > 0 THEN source_created_at
    WHEN first_captured_at IS NOT NULL AND first_captured_at > 0 THEN first_captured_at
    ELSE created_at
  END
`

let sqliteDb: Database | OpfsSAHPoolDatabase | null = null
let sqliteVersion = ""
let activeFilename = ""

type QueryDb = Database | OpfsSAHPoolDatabase
type SummarySchemaVersion = NonNullable<
  KnowledgeSnapshot["summaries"][number]["schemaVersion"]
>
type WeeklyReportSchemaVersion = NonNullable<
  KnowledgeSnapshot["weeklyReports"][number]["schemaVersion"]
>

type WorkerRagMessage = {
  role: "user" | "ai"
  content_text: string
}

function normalizePlatform(value: unknown): Platform {
  switch (value) {
    case "ChatGPT":
    case "Claude":
    case "Gemini":
    case "DeepSeek":
    case "Qwen":
    case "Doubao":
    case "Kimi":
    case "Yuanbao":
      return value
    default:
      throw new Error(`INVALID_PLATFORM_VALUE:${String(value)}`)
  }
}

function normalizeConversationPlatforms(
  filters?: ConversationFilters
): Platform[] {
  const candidates =
    Array.isArray(filters?.platforms) && filters.platforms.length > 0
      ? filters.platforms
      : filters?.platform
        ? [filters.platform]
        : []

  return Array.from(
    new Set(
      candidates.flatMap((value) => {
        try {
          return [normalizePlatform(value)]
        } catch {
          return []
        }
      })
    )
  )
}

function normalizeConversationIdList(ids?: number[]): number[] {
  if (!Array.isArray(ids)) {
    return []
  }

  return Array.from(
    new Set(
      ids
        .filter((value) => typeof value === "number" && Number.isFinite(value))
        .map((value) => Math.floor(value))
        .filter((value) => value > 0)
    )
  )
}

function normalizeConversationFilters(filters?: ConversationFilters): {
  platforms: Platform[]
  search: string
  dateRange?: { start: number; end: number }
  includeTrash: boolean
  includeArchived: boolean
} {
  const search = filters?.search?.trim().toLowerCase() ?? ""
  const rangeStart =
    typeof filters?.dateRange?.start === "number" &&
    Number.isFinite(filters.dateRange.start)
      ? filters.dateRange.start
      : undefined
  const rangeEnd =
    typeof filters?.dateRange?.end === "number" &&
    Number.isFinite(filters.dateRange.end)
      ? filters.dateRange.end
      : undefined

  return {
    platforms: normalizeConversationPlatforms(filters),
    search,
    dateRange:
      rangeStart !== undefined &&
      rangeEnd !== undefined &&
      rangeEnd >= rangeStart
        ? { start: rangeStart, end: rangeEnd }
        : undefined,
    includeTrash: filters?.includeTrash !== false,
    includeArchived: filters?.includeArchived !== false
  }
}

function isPositiveTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function computeConversationOriginAt(record: {
  source_created_at?: number | null
  first_captured_at?: number | null
  created_at: number
}): number {
  if (isPositiveTimestamp(record.source_created_at)) {
    return record.source_created_at
  }

  if (isPositiveTimestamp(record.first_captured_at)) {
    return record.first_captured_at
  }

  return record.created_at
}

function normalizeInsightFormat(value: unknown): InsightFormat | undefined {
  switch (value) {
    case "plain_text":
    case "structured_v1":
    case "fallback_plain_text":
      return value
    default:
      return undefined
  }
}

function normalizeInsightStatus(value: unknown): InsightStatus | undefined {
  switch (value) {
    case "ok":
    case "fallback":
      return value
    default:
      return undefined
  }
}

function normalizeSummarySchemaVersion(
  value: unknown
): SummarySchemaVersion | undefined {
  switch (value) {
    case "conversation_summary.v1":
    case "conversation_summary.v2":
      return value
    default:
      return undefined
  }
}

function normalizeWeeklyReportSchemaVersion(
  value: unknown
): WeeklyReportSchemaVersion | undefined {
  switch (value) {
    case "weekly_report.v1":
    case "weekly_lite.v1":
      return value
    default:
      return undefined
  }
}

function requireDatabase(): QueryDb {
  if (!sqliteDb) {
    throw new Error("SQLITE_DATABASE_NOT_INITIALIZED")
  }
  return sqliteDb
}

function buildValidationDigest(
  snapshot: KnowledgeSnapshot
): KnowledgeValidationDigest {
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

function encodeEmbedding(embedding: Float32Array): Uint8Array {
  return new Uint8Array(
    embedding.buffer.slice(
      embedding.byteOffset,
      embedding.byteOffset + embedding.byteLength
    )
  )
}

function decodeEmbedding(blob: Uint8Array): Float32Array {
  return new Float32Array(
    blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)
  )
}

function createExcerpt(text: string, normalizedQuery: string): string {
  const lower = text.toLowerCase()
  const index = lower.indexOf(normalizedQuery)
  if (index < 0) {
    return ""
  }

  const start = Math.max(0, index - 30)
  const end = Math.min(text.length, index + normalizedQuery.length + 60)
  const prefix = start > 0 ? "..." : ""
  const suffix = end < text.length ? "..." : ""
  return `${prefix}${text.slice(start, end)}${suffix}`
}

function truncateInline(text: string, max = 200): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) {
    return normalized
  }

  return `${normalized.slice(0, max)}...`
}

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0
  }

  let dot = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
  }
  return dot
}

function buildConversationContext(
  conversation: Conversation,
  messages: WorkerRagMessage[],
  annotations: Annotation[]
): string {
  const lines = messages.slice(0, MAX_RAG_MESSAGE_COUNT).map((message) => {
    const role = message.role === "user" ? "User" : "AI"
    return `[${role}] ${message.content_text}`
  })

  const annotationLines = annotations.map(
    (annotation) => `[Note] ${annotation.content_text}`
  )

  return [
    `[Title] ${conversation.title}`,
    `[Platform] ${conversation.platform}`,
    "[Content]",
    ...lines,
    ...(annotationLines.length > 0 ? ["【批注】", ...annotationLines] : [])
  ].join("\n")
}

function extractExcerpt(messages: WorkerRagMessage[]): string {
  return truncateInline(
    messages
      .slice(0, 4)
      .map((message) => message.content_text)
      .filter(Boolean)
      .join("\n"),
    MAX_RAG_EXCERPT_LENGTH
  )
}

function withStatement<T>(
  db: QueryDb,
  sql: string,
  run: (statement: PreparedStatement) => T
): T {
  const statement = db.prepare(sql)
  try {
    return run(statement)
  } finally {
    statement.finalize()
  }
}

function resetStatement(statement: PreparedStatement): void {
  statement.reset(true)
}

function ensureColumn(
  db: QueryDb,
  tableName: string,
  columnName: string,
  definition: string
): void {
  const hasColumn = db
    .selectObjects(`PRAGMA table_info(${tableName})`)
    .some((column) => String(column.name) === columnName)

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition};`)
  }
}

function initializeSchema(db: QueryDb): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA temp_store = MEMORY;

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY,
      platform TEXT NOT NULL,
      uuid TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      snippet TEXT NOT NULL,
      url TEXT NOT NULL,
      source_created_at INTEGER,
      first_captured_at INTEGER,
      last_captured_at INTEGER,
      origin_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      message_count INTEGER NOT NULL,
      turn_count INTEGER NOT NULL,
      is_archived INTEGER NOT NULL,
      is_trash INTEGER NOT NULL,
      tags_json TEXT NOT NULL,
      topic_id INTEGER,
      is_starred INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_uuid
      ON conversations (uuid);
    CREATE INDEX IF NOT EXISTS idx_conversations_origin_at
      ON conversations (origin_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_platform_origin_at
      ON conversations (platform, origin_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_state_origin_at
      ON conversations (is_trash, is_archived, origin_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content_text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
      ON messages (conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      linked_conversation_ids_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      content_text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      days_after INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_conversation_created_at
      ON annotations (conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      structured_json TEXT,
      format TEXT,
      status TEXT,
      schema_version TEXT,
      model_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      source_updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY,
      range_start INTEGER NOT NULL,
      range_end INTEGER NOT NULL,
      content TEXT NOT NULL,
      structured_json TEXT,
      format TEXT,
      status TEXT,
      schema_version TEXT,
      model_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      source_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS explore_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      preview TEXT NOT NULL,
      message_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS explore_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources_json TEXT,
      agent_meta_json TEXT,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_explore_messages_session_timestamp
      ON explore_messages (session_id, timestamp);

    CREATE TABLE IF NOT EXISTS embeddings (
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      chunk_id TEXT NOT NULL,
      text_hash TEXT NOT NULL,
      embedding BLOB NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (target_type, target_id, chunk_id)
    );
    CREATE INDEX IF NOT EXISTS idx_embeddings_target
      ON embeddings (target_type, target_id);

    CREATE TABLE IF NOT EXISTS edges (
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      weight REAL NOT NULL,
      reason TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (source_id, target_id)
    );
    CREATE INDEX IF NOT EXISTS idx_edges_weight
      ON edges (weight DESC);
  `)

  ensureColumn(db, "conversations", "uuid", "uuid TEXT NOT NULL DEFAULT ''")
  ensureColumn(
    db,
    "conversations",
    "origin_at",
    "origin_at INTEGER NOT NULL DEFAULT 0"
  )
  db.exec(`
    UPDATE conversations
    SET origin_at = ${ORIGIN_AT_SQL}
    WHERE origin_at IS NULL OR origin_at <= 0;
  `)
}

async function initializeDatabase(
  dbFilename: string,
  directory: string
): Promise<KnowledgeWorkerResultMap["INIT"]> {
  if (sqliteDb) {
    return {
      engine: "opfs-sahpool",
      dbFilename: activeFilename,
      sqliteVersion
    }
  }

  const sqlite3 = await sqlite3InitModule()
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
    directory,
    initialCapacity: 16
  })

  sqliteDb = new poolUtil.OpfsSAHPoolDb(dbFilename)
  activeFilename = dbFilename
  sqliteVersion = sqlite3.version.libVersion
  initializeSchema(sqliteDb)

  return {
    engine: "opfs-sahpool",
    dbFilename: activeFilename,
    sqliteVersion
  }
}

function clearSnapshotTables(db: QueryDb): void {
  db.exec(`
    DELETE FROM edges;
    DELETE FROM embeddings;
    DELETE FROM explore_messages;
    DELETE FROM explore_sessions;
    DELETE FROM weekly_reports;
    DELETE FROM summaries;
    DELETE FROM annotations;
    DELETE FROM notes;
    DELETE FROM topics;
    DELETE FROM messages;
    DELETE FROM conversations;
  `)
}

function replaceSnapshot(db: QueryDb, snapshot: KnowledgeSnapshot): void {
  clearSnapshotTables(db)

  withStatement(
    db,
    `INSERT OR REPLACE INTO conversations (
      id, platform, uuid, title, snippet, url, source_created_at, first_captured_at,
      last_captured_at, origin_at, created_at, updated_at, message_count, turn_count,
      is_archived, is_trash, tags_json, topic_id, is_starred
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.conversations.forEach((record) => {
        statement.bind([
          record.id,
          record.platform,
          record.uuid,
          record.title,
          record.snippet,
          record.url,
          record.source_created_at,
          record.first_captured_at,
          record.last_captured_at,
          computeConversationOriginAt(record),
          record.created_at,
          record.updated_at,
          record.message_count,
          record.turn_count,
          record.is_archived ? 1 : 0,
          record.is_trash ? 1 : 0,
          JSON.stringify(record.tags ?? []),
          record.topic_id,
          record.is_starred ? 1 : 0
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  withStatement(
    db,
    `INSERT OR REPLACE INTO messages (
      id, conversation_id, role, content_text, created_at
    ) VALUES (?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.messages.forEach((record) => {
        statement.bind([
          record.id,
          record.conversation_id,
          record.role,
          record.content_text,
          record.created_at
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  withStatement(
    db,
    `INSERT OR REPLACE INTO topics (
      id, parent_id, name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.topics.forEach((record) => {
        statement.bind([
          record.id,
          record.parent_id,
          record.name,
          record.created_at,
          record.updated_at
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  withStatement(
    db,
    `INSERT OR REPLACE INTO notes (
      id, title, content, created_at, updated_at, linked_conversation_ids_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.notes.forEach((record) => {
        statement.bind([
          record.id,
          record.title,
          record.content,
          record.created_at,
          record.updated_at,
          JSON.stringify(record.linked_conversation_ids ?? [])
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  withStatement(
    db,
    `INSERT OR REPLACE INTO annotations (
      id, conversation_id, message_id, content_text, created_at, days_after
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.annotations.forEach((record) => {
        statement.bind([
          record.id,
          record.conversation_id,
          record.message_id,
          record.content_text,
          record.created_at,
          record.days_after
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  withStatement(
    db,
    `INSERT OR REPLACE INTO summaries (
      id, conversation_id, content, structured_json, format, status,
      schema_version, model_id, created_at, source_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.summaries.forEach((record) => {
        statement.bind([
          record.id,
          record.conversationId,
          record.content,
          record.structured ? JSON.stringify(record.structured) : null,
          record.format ?? null,
          record.status ?? null,
          record.schemaVersion ?? null,
          record.modelId,
          record.createdAt,
          record.sourceUpdatedAt
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  withStatement(
    db,
    `INSERT OR REPLACE INTO weekly_reports (
      id, range_start, range_end, content, structured_json, format, status,
      schema_version, model_id, created_at, source_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.weeklyReports.forEach((record) => {
        statement.bind([
          record.id,
          record.rangeStart,
          record.rangeEnd,
          record.content,
          record.structured ? JSON.stringify(record.structured) : null,
          record.format ?? null,
          record.status ?? null,
          record.schemaVersion ?? null,
          record.modelId,
          record.createdAt,
          record.sourceHash
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  withStatement(
    db,
    `INSERT OR REPLACE INTO explore_sessions (
      id, title, preview, message_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.exploreSessions.forEach((record) => {
        statement.bind([
          record.id,
          record.title,
          record.preview,
          record.messageCount,
          record.createdAt,
          record.updatedAt
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  withStatement(
    db,
    `INSERT OR REPLACE INTO explore_messages (
      id, session_id, role, content, sources_json, agent_meta_json, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    (statement) => {
      snapshot.exploreMessages.forEach((record) => {
        statement.bind([
          record.id,
          record.sessionId,
          record.role,
          record.content,
          record.sources ?? null,
          record.agentMeta ?? null,
          record.timestamp
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )

  replaceEmbeddings(db, snapshot.embeddings)
  rebuildEdges(db)
}

function replaceEmbeddings(
  db: QueryDb,
  embeddings: KnowledgeEmbeddingRecord[]
): void {
  db.exec(`DELETE FROM embeddings;`)

  withStatement(
    db,
    `INSERT OR REPLACE INTO embeddings (
      target_type, target_id, chunk_id, text_hash, embedding, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    (statement) => {
      embeddings.forEach((record) => {
        statement.bind([
          record.target_type,
          record.target_id,
          record.chunk_id,
          record.text_hash,
          encodeEmbedding(record.embedding),
          record.updated_at
        ])
        statement.step()
        resetStatement(statement)
      })
    }
  )
}

function applyConversationDelta(
  db: QueryDb,
  delta: KnowledgeConversationDelta,
  deletedConversationIds: number[]
): void {
  const normalizedDeletedIds = Array.from(
    new Set(
      deletedConversationIds
        .filter((value) => typeof value === "number" && Number.isFinite(value))
        .map((value) => Math.floor(value))
        .filter((value) => value > 0)
    )
  )

  normalizedDeletedIds.forEach((conversationId) => {
    db.exec({
      sql: `
        DELETE FROM messages WHERE conversation_id = ?;
        DELETE FROM annotations WHERE conversation_id = ?;
        DELETE FROM summaries WHERE conversation_id = ?;
        DELETE FROM embeddings WHERE target_type = 'conversation' AND target_id = ?;
        DELETE FROM conversations WHERE id = ?;
      `,
      bind: [
        conversationId,
        conversationId,
        conversationId,
        conversationId,
        conversationId
      ]
    })
  })

  delta.conversationIds.forEach((conversationId) => {
    db.exec({
      sql: `
        DELETE FROM messages WHERE conversation_id = ?;
        DELETE FROM annotations WHERE conversation_id = ?;
        DELETE FROM summaries WHERE conversation_id = ?;
        DELETE FROM embeddings WHERE target_type = 'conversation' AND target_id = ?;
        DELETE FROM conversations WHERE id = ?;
      `,
      bind: [
        conversationId,
        conversationId,
        conversationId,
        conversationId,
        conversationId
      ]
    })
  })

  replaceSnapshot(db, {
    exportedAt: delta.exportedAt,
    conversations: delta.conversations,
    messages: delta.messages,
    topics: withTopics(db),
    notes: withNotes(db),
    annotations: delta.annotations,
    summaries: delta.summaries,
    weeklyReports: withWeeklyReports(db),
    exploreSessions: withExploreSessions(db),
    exploreMessages: withExploreMessages(db),
    embeddings: withEmbeddings(db, delta.embeddings)
  })
}

function withTopics(db: QueryDb): KnowledgeSnapshot["topics"] {
  return db
    .selectObjects(
      `
    SELECT id, parent_id AS parent_id, name, created_at, updated_at
    FROM topics
    ORDER BY id ASC
  `
    )
    .map((record) => ({
      id: Number(record.id),
      parent_id:
        typeof record.parent_id === "number" ? Number(record.parent_id) : null,
      name: String(record.name),
      created_at: Number(record.created_at),
      updated_at: Number(record.updated_at)
    })) as KnowledgeSnapshot["topics"]
}

function withNotes(db: QueryDb): KnowledgeSnapshot["notes"] {
  return db
    .selectObjects(
      `
    SELECT id, title, content, created_at, updated_at,
      json(linked_conversation_ids_json) AS linked_conversation_ids
    FROM notes
    ORDER BY id ASC
  `
    )
    .map((record) => ({
      id: Number(record.id),
      title: String(record.title),
      content: String(record.content),
      created_at: Number(record.created_at),
      updated_at: Number(record.updated_at),
      linked_conversation_ids: JSON.parse(
        String(record.linked_conversation_ids ?? "[]")
      )
    })) as KnowledgeSnapshot["notes"]
}

function withWeeklyReports(db: QueryDb): KnowledgeSnapshot["weeklyReports"] {
  return db
    .selectObjects(
      `
    SELECT
      id,
      range_start AS rangeStart,
      range_end AS rangeEnd,
      content,
      structured_json,
      format,
      status,
      schema_version AS schemaVersion,
      model_id AS modelId,
      created_at AS createdAt,
      source_hash AS sourceHash
    FROM weekly_reports
    ORDER BY id ASC
  `
    )
    .map((record) => ({
      id: Number(record.id),
      rangeStart: Number(record.rangeStart),
      rangeEnd: Number(record.rangeEnd),
      content: String(record.content),
      structured: record.structured_json
        ? JSON.parse(String(record.structured_json))
        : null,
      format: normalizeInsightFormat(record.format),
      status: normalizeInsightStatus(record.status),
      schemaVersion: normalizeWeeklyReportSchemaVersion(record.schemaVersion),
      modelId: String(record.modelId),
      createdAt: Number(record.createdAt),
      sourceHash: String(record.sourceHash)
    })) as KnowledgeSnapshot["weeklyReports"]
}

function withExploreSessions(
  db: QueryDb
): KnowledgeSnapshot["exploreSessions"] {
  return db
    .selectObjects(
      `
    SELECT
      id,
      title,
      preview,
      message_count AS messageCount,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM explore_sessions
    ORDER BY id ASC
  `
    )
    .map((record) => ({
      id: String(record.id),
      title: String(record.title),
      preview: String(record.preview),
      messageCount: Number(record.messageCount),
      createdAt: Number(record.createdAt),
      updatedAt: Number(record.updatedAt)
    })) as KnowledgeSnapshot["exploreSessions"]
}

function withExploreMessages(
  db: QueryDb
): KnowledgeSnapshot["exploreMessages"] {
  return db
    .selectObjects(
      `
    SELECT
      id,
      session_id AS sessionId,
      role,
      content,
      sources_json AS sources,
      agent_meta_json AS agentMeta,
      timestamp
    FROM explore_messages
    ORDER BY id ASC
  `
    )
    .map((record) => ({
      id: String(record.id),
      sessionId: String(record.sessionId),
      role: String(record.role) as "user" | "assistant",
      content: String(record.content),
      sources: typeof record.sources === "string" ? record.sources : undefined,
      agentMeta:
        typeof record.agentMeta === "string" ? record.agentMeta : undefined,
      timestamp: Number(record.timestamp)
    })) as KnowledgeSnapshot["exploreMessages"]
}

function withEmbeddings(
  db: QueryDb,
  upserts?: KnowledgeEmbeddingRecord[]
): KnowledgeSnapshot["embeddings"] {
  if (Array.isArray(upserts) && upserts.length > 0) {
    const ids = new Set(upserts.map((record) => record.target_id))
    const retained = db
      .selectObjects(
        `
        SELECT target_type, target_id, chunk_id, text_hash, embedding, updated_at
        FROM embeddings
        ORDER BY target_id ASC
      `
      )
      .map((record) => ({
        target_type: String(record.target_type) as "conversation",
        target_id: Number(record.target_id),
        chunk_id: String(record.chunk_id),
        text_hash: String(record.text_hash),
        embedding: decodeEmbedding(record.embedding as Uint8Array),
        updated_at: Number(record.updated_at)
      }))
      .filter((record) => !ids.has(record.target_id))

    return [...retained, ...upserts].sort(
      (left, right) => left.target_id - right.target_id
    )
  }

  return db
    .selectObjects(
      `
    SELECT target_type, target_id, chunk_id, text_hash, embedding, updated_at
    FROM embeddings
    ORDER BY target_id ASC
  `
    )
    .map((record) => ({
      target_type: String(record.target_type) as "conversation",
      target_id: Number(record.target_id),
      chunk_id: String(record.chunk_id),
      text_hash: String(record.text_hash),
      embedding: decodeEmbedding(record.embedding as Uint8Array),
      updated_at: Number(record.updated_at)
    })) as KnowledgeSnapshot["embeddings"]
}

function withConversations(db: QueryDb): KnowledgeSnapshot["conversations"] {
  return withStatement(
    db,
    `
      SELECT
        id, platform, uuid, title, snippet, url, source_created_at,
        first_captured_at, last_captured_at, created_at, updated_at,
        message_count, turn_count, is_archived, is_trash,
        tags_json, topic_id, is_starred
      FROM conversations
      ORDER BY id ASC
    `,
    (statement) => {
      const rows: KnowledgeSnapshot["conversations"] = []
      while (statement.step()) {
        const row = statement.get({}) as Record<string, unknown>
        rows.push({
          id: Number(row.id),
          platform: normalizePlatform(row.platform),
          uuid: String(row.uuid),
          title: String(row.title),
          snippet: String(row.snippet),
          url: String(row.url),
          source_created_at:
            typeof row.source_created_at === "number"
              ? Number(row.source_created_at)
              : null,
          first_captured_at: Number(row.first_captured_at),
          last_captured_at: Number(row.last_captured_at),
          created_at: Number(row.created_at),
          updated_at: Number(row.updated_at),
          message_count: Number(row.message_count),
          turn_count: Number(row.turn_count),
          is_archived: Boolean(row.is_archived),
          is_trash: Boolean(row.is_trash),
          tags: JSON.parse(String(row.tags_json ?? "[]")),
          topic_id:
            typeof row.topic_id === "number" ? Number(row.topic_id) : null,
          is_starred: Boolean(row.is_starred)
        })
      }
      return rows
    }
  )
}

function withMessages(db: QueryDb): KnowledgeSnapshot["messages"] {
  return withStatement(
    db,
    `
      SELECT id, conversation_id, role, content_text, created_at
      FROM messages
      ORDER BY id ASC
    `,
    (statement) => {
      const rows: KnowledgeSnapshot["messages"] = []
      while (statement.step()) {
        const row = statement.get({}) as Record<string, unknown>
        rows.push({
          id: Number(row.id),
          conversation_id: Number(row.conversation_id),
          role: String(row.role) as "user" | "ai",
          content_text: String(row.content_text),
          created_at: Number(row.created_at)
        })
      }
      return rows
    }
  )
}

function withAnnotations(db: QueryDb): KnowledgeSnapshot["annotations"] {
  return withStatement(
    db,
    `
      SELECT id, conversation_id, message_id, content_text, created_at, days_after
      FROM annotations
      ORDER BY id ASC
    `,
    (statement) => {
      const rows: KnowledgeSnapshot["annotations"] = []
      while (statement.step()) {
        const row = statement.get({}) as Record<string, unknown>
        rows.push({
          id: Number(row.id),
          conversation_id: Number(row.conversation_id),
          message_id: Number(row.message_id),
          content_text: String(row.content_text),
          created_at: Number(row.created_at),
          days_after: Number(row.days_after)
        })
      }
      return rows
    }
  )
}

function withSummaries(db: QueryDb): KnowledgeSnapshot["summaries"] {
  return withStatement(
    db,
    `
      SELECT
        id,
        conversation_id AS conversationId,
        content,
        structured_json,
        format,
        status,
        schema_version AS schemaVersion,
        model_id AS modelId,
        created_at AS createdAt,
        source_updated_at AS sourceUpdatedAt
      FROM summaries
      ORDER BY id ASC
    `,
    (statement) => {
      const rows: KnowledgeSnapshot["summaries"] = []
      while (statement.step()) {
        const row = statement.get({}) as Record<string, unknown>
        rows.push({
          id: Number(row.id),
          conversationId: Number(row.conversationId),
          content: String(row.content),
          structured: row.structured_json
            ? JSON.parse(String(row.structured_json))
            : null,
          format: normalizeInsightFormat(row.format),
          status: normalizeInsightStatus(row.status),
          schemaVersion: normalizeSummarySchemaVersion(row.schemaVersion),
          modelId: String(row.modelId),
          createdAt: Number(row.createdAt),
          sourceUpdatedAt: Number(row.sourceUpdatedAt)
        })
      }
      return rows
    }
  )
}

function rebuildEdges(db: QueryDb): void {
  const embeddings = withEmbeddings(db)
  db.exec(`DELETE FROM edges;`)

  withStatement(
    db,
    `INSERT OR REPLACE INTO edges (
      source_id, target_id, weight, reason, updated_at
    ) VALUES (?, ?, ?, ?, ?)`,
    (statement) => {
      const updatedAt = Date.now()
      for (let leftIndex = 0; leftIndex < embeddings.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < embeddings.length;
          rightIndex += 1
        ) {
          const left = embeddings[leftIndex]
          const right = embeddings[rightIndex]
          const similarity = cosineSimilarity(left.embedding, right.embedding)
          if (similarity < MATERIALIZED_EDGE_MIN_WEIGHT) {
            continue
          }

          statement.bind([
            Math.min(left.target_id, right.target_id),
            Math.max(left.target_id, right.target_id),
            Math.round(similarity * 100) / 100,
            "embedding_similarity",
            updatedAt
          ])
          statement.step()
          resetStatement(statement)
        }
      }
    }
  )
}

function buildInFilter<T extends string | number>(
  columnName: string,
  values: T[]
): { clause: string; bind: T[] } {
  if (!values.length) {
    return { clause: "", bind: [] }
  }

  return {
    clause: ` AND ${columnName} IN (${values.map(() => "?").join(", ")})`,
    bind: values
  }
}

function rowToConversation(row: Record<string, unknown>): Conversation {
  return {
    id: Number(row.id),
    platform: normalizePlatform(row.platform),
    uuid: String(row.uuid ?? ""),
    title: String(row.title ?? ""),
    snippet: String(row.snippet ?? ""),
    url: String(row.url ?? ""),
    source_created_at:
      typeof row.source_created_at === "number"
        ? Number(row.source_created_at)
        : null,
    first_captured_at: Number(row.first_captured_at ?? row.created_at ?? 0),
    last_captured_at: Number(row.last_captured_at ?? row.updated_at ?? 0),
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
    message_count: Number(row.message_count ?? 0),
    turn_count: Number(row.turn_count ?? 0),
    is_archived: Boolean(row.is_archived),
    is_trash: Boolean(row.is_trash),
    tags: JSON.parse(String(row.tags_json ?? "[]")),
    topic_id: typeof row.topic_id === "number" ? Number(row.topic_id) : null,
    is_starred: Boolean(row.is_starred)
  }
}

function listConversations(filters?: ConversationFilters): Conversation[] {
  const db = requireDatabase()
  const normalized = normalizeConversationFilters(filters)
  const platformFilter = buildInFilter("platform", normalized.platforms)
  const whereClauses = ["1 = 1"]
  const bind: Array<string | number> = []

  if (!normalized.includeTrash) {
    whereClauses.push("is_trash = 0")
  }

  if (!normalized.includeArchived) {
    whereClauses.push("is_archived = 0")
  }

  if (normalized.search) {
    whereClauses.push(
      "(instr(lower(title), ?) > 0 OR instr(lower(snippet), ?) > 0)"
    )
    bind.push(normalized.search, normalized.search)
  }

  if (normalized.dateRange) {
    whereClauses.push("origin_at >= ? AND origin_at <= ?")
    bind.push(normalized.dateRange.start, normalized.dateRange.end)
  }

  const rows = db.selectObjects(
    `
      SELECT
        id, platform, uuid, title, snippet, url, source_created_at,
        first_captured_at, last_captured_at, created_at, updated_at,
        message_count, turn_count, is_archived, is_trash,
        tags_json, topic_id, is_starred
      FROM conversations
      WHERE ${whereClauses.join(" AND ")}${platformFilter.clause}
      ORDER BY origin_at DESC, id ASC
    `,
    [...bind, ...platformFilter.bind]
  )

  return rows.map((row) => rowToConversation(row as Record<string, unknown>))
}

function getTopicsWithCounts(): Topic[] {
  const db = requireDatabase()

  return db
    .selectObjects(
      `
        SELECT
          topics.id,
          topics.parent_id,
          topics.name,
          topics.created_at,
          topics.updated_at,
          COALESCE(topic_counts.direct_count, 0) AS count
        FROM topics
        LEFT JOIN (
          SELECT topic_id, COUNT(*) AS direct_count
          FROM conversations
          WHERE topic_id IS NOT NULL AND is_archived = 0 AND is_trash = 0
          GROUP BY topic_id
        ) AS topic_counts
          ON topic_counts.topic_id = topics.id
        ORDER BY topics.id ASC
      `
    )
    .map((row) => ({
      id: Number(row.id),
      parent_id:
        typeof row.parent_id === "number" ? Number(row.parent_id) : null,
      name: String(row.name),
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      count: Number(row.count ?? 0)
    })) as Topic[]
}

function toLocalDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getDashboardStats(): DashboardStats {
  const db = requireDatabase()
  const distribution: DashboardStats["platformDistribution"] = {
    ChatGPT: 0,
    Claude: 0,
    Gemini: 0,
    DeepSeek: 0,
    Qwen: 0,
    Doubao: 0,
    Kimi: 0,
    Yuanbao: 0
  }

  const totalConversationsRow = db.selectObjects(
    `SELECT COUNT(*) AS count FROM conversations`
  )[0]
  const totalConversations = Number(totalConversationsRow?.count ?? 0)

  const platformRows = db.selectObjects(
    `
      SELECT platform, COUNT(*) AS count
      FROM conversations
      GROUP BY platform
    `
  )

  platformRows.forEach((row) => {
    const platform = normalizePlatform(row.platform)
    distribution[platform] = Number(row.count ?? 0)
  })

  const heatmapRows = db.selectObjects(
    `
      SELECT
        date((${FIRST_CAPTURED_AT_SQL}) / 1000, 'unixepoch', 'localtime') AS date,
        COUNT(*) AS count
      FROM conversations
      GROUP BY date
      ORDER BY date ASC
    `
  )

  const firstCaptureHeatmapData = heatmapRows.map((row) => ({
    date: String(row.date),
    count: Number(row.count ?? 0)
  }))

  const today = toLocalDayKey(Date.now())
  const firstCapturedTodayCount =
    firstCaptureHeatmapData.find((row) => row.date === today)?.count ?? 0
  const daysWithConversations = new Set(
    firstCaptureHeatmapData.map((row) => row.date)
  )

  let firstCaptureStreak = 0
  const cursor = new Date()
  while (daysWithConversations.has(toLocalDayKey(cursor.getTime()))) {
    firstCaptureStreak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    totalConversations,
    totalTokens: 0,
    firstCaptureStreak,
    firstCapturedTodayCount,
    platformDistribution: distribution,
    firstCaptureHeatmapData
  }
}

function getMessagesForConversation(
  db: QueryDb,
  conversationId: number
): WorkerRagMessage[] {
  return db
    .selectObjects(
      `
        SELECT role, content_text
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
      [conversationId]
    )
    .map((row) => ({
      role: String(row.role) as WorkerRagMessage["role"],
      content_text: String(row.content_text ?? "")
    }))
}

function getAnnotationsForConversation(
  db: QueryDb,
  conversationId: number
): Annotation[] {
  return db
    .selectObjects(
      `
        SELECT id, conversation_id, message_id, content_text, created_at, days_after
        FROM annotations
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
      [conversationId]
    )
    .map((row) => ({
      id: Number(row.id),
      conversation_id: Number(row.conversation_id),
      message_id: Number(row.message_id),
      content_text: String(row.content_text ?? ""),
      created_at: Number(row.created_at),
      days_after: Number(row.days_after)
    })) as Annotation[]
}

function retrieveRagContext(payload: {
  queryEmbedding: Float32Array
  limit: number
  conversationIds?: number[]
}): KnowledgeRagRetrievalResult {
  const db = requireDatabase()
  const scopedConversationIds = normalizeConversationIdList(
    payload.conversationIds
  )
  const scopedConversationIdSet = scopedConversationIds.length
    ? new Set(scopedConversationIds)
    : undefined
  const candidateFilter = buildInFilter("target_id", scopedConversationIds)
  const embeddingRows = db.selectObjects(
    `
      SELECT target_id, embedding
      FROM embeddings
      WHERE target_type = 'conversation'${candidateFilter.clause}
      ORDER BY target_id ASC
    `,
    candidateFilter.bind
  )

  const scored: Array<{ id: number; similarity: number }> = []
  embeddingRows.forEach((row) => {
    const conversationId = Number(row.target_id)
    if (
      !Number.isFinite(conversationId) ||
      (scopedConversationIdSet && !scopedConversationIdSet.has(conversationId))
    ) {
      return
    }

    const embedding = decodeEmbedding(row.embedding as Uint8Array)
    if (
      embedding.length === 0 ||
      embedding.length !== payload.queryEmbedding.length
    ) {
      return
    }

    const similarity = cosineSimilarity(payload.queryEmbedding, embedding)
    if (similarity < RAG_SIMILARITY_FLOOR) {
      return
    }

    scored.push({ id: conversationId, similarity })
  })

  const safeLimit = Math.max(1, payload.limit)
  const top = scored
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, safeLimit)

  if (scopedConversationIds.length > 0) {
    const topIds = new Set(top.map((item) => item.id))
    for (const conversationId of scopedConversationIds) {
      if (top.length >= safeLimit) {
        break
      }
      if (topIds.has(conversationId)) {
        continue
      }
      top.push({ id: conversationId, similarity: 0 })
      topIds.add(conversationId)
    }
  }

  if (top.length === 0) {
    return {
      sources: [],
      context: "",
      items: []
    }
  }

  const conversationIds = top.map((item) => item.id)
  const conversationFilter = buildInFilter("id", conversationIds)
  const conversations = db
    .selectObjects(
      `
        SELECT
          id, platform, uuid, title, snippet, url, source_created_at,
          first_captured_at, last_captured_at, created_at, updated_at,
          message_count, turn_count, is_archived, is_trash,
          tags_json, topic_id, is_starred
        FROM conversations
        WHERE 1 = 1${conversationFilter.clause}
      `,
      conversationFilter.bind
    )
    .map((row) => rowToConversation(row as Record<string, unknown>))

  const byId = new Map(
    conversations.map((conversation) => [conversation.id, conversation])
  )
  const sources: RelatedConversation[] = []
  const contextBlocks: string[] = []
  const items: KnowledgeRagRetrievalResult["items"] = []

  top.forEach((topItem) => {
    const conversation = byId.get(topItem.id)
    if (!conversation) {
      return
    }

    const messages = getMessagesForConversation(db, conversation.id)
    const annotations = getAnnotationsForConversation(db, conversation.id)
    const source: RelatedConversation = {
      id: conversation.id,
      title: conversation.title,
      platform: conversation.platform,
      similarity: Math.round(topItem.similarity * 100)
    }
    const contextBlock = buildConversationContext(
      conversation,
      messages,
      annotations
    )
    const excerpt = extractExcerpt(messages)

    sources.push(source)
    contextBlocks.push(contextBlock)
    items.push({ source, contextBlock, excerpt })
  })

  return {
    sources,
    context: contextBlocks.join("\n\n---\n\n"),
    items
  }
}

function searchConversationIdsByText(query: string): number[] {
  const db = requireDatabase()
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery.length < 2) {
    return []
  }

  const rows = db.selectObjects(
    `
      SELECT DISTINCT conversation_id FROM messages
      WHERE instr(lower(content_text), ?) > 0
      UNION
      SELECT DISTINCT conversation_id FROM annotations
      WHERE instr(lower(content_text), ?) > 0
      ORDER BY conversation_id ASC
    `,
    [normalizedQuery, normalizedQuery]
  )

  return rows
    .map((record) => Number(record.conversation_id))
    .filter((value) => Number.isFinite(value))
}

function searchConversationMatchesByText(params: {
  query: string
  conversationIds?: number[]
}): ConversationMatchSummary[] {
  const db = requireDatabase()
  const normalizedQuery = params.query.trim().toLowerCase()
  if (normalizedQuery.length < 2) {
    return []
  }

  const candidateIds = normalizeConversationIdList(params.conversationIds)
  if (Array.isArray(params.conversationIds) && candidateIds.length === 0) {
    return []
  }

  const filter = buildInFilter("conversation_id", candidateIds)
  const rows = db.selectObjects(
    `
      SELECT id, conversation_id, created_at, content_text
      FROM messages
      WHERE instr(lower(content_text), ?) > 0${filter.clause}
      ORDER BY conversation_id ASC, created_at ASC, id ASC
    `,
    [normalizedQuery, ...filter.bind]
  )

  const matches = new Map<number, ConversationMatchSummary>()
  rows.forEach((row) => {
    const conversationId = Number(row.conversation_id)
    const messageId = Number(row.id)
    const contentText = String(row.content_text ?? "")
    if (
      !Number.isFinite(conversationId) ||
      !Number.isFinite(messageId) ||
      matches.has(conversationId)
    ) {
      return
    }

    matches.set(conversationId, {
      conversationId,
      firstMatchedMessageId: messageId,
      bestExcerpt: createExcerpt(contentText, normalizedQuery)
    })
  })

  return Array.from(matches.values())
}

function getAllEdges(payload: {
  threshold: number
  conversationIds?: number[]
}): Array<{ source: number; target: number; weight: number }> {
  const db = requireDatabase()
  const normalizedIds = normalizeConversationIdList(payload.conversationIds)
  if (Array.isArray(payload.conversationIds) && normalizedIds.length === 0) {
    return []
  }

  const filter = buildInFilter("source_id", normalizedIds)
  const filterRight = buildInFilter("target_id", normalizedIds)
  const rows = db.selectObjects(
    `
      SELECT source_id, target_id, weight
      FROM edges
      WHERE weight >= ?${filter.clause}${filterRight.clause}
      ORDER BY weight DESC, source_id ASC, target_id ASC
    `,
    [payload.threshold, ...filter.bind, ...filterRight.bind]
  )

  return rows.map((row) => ({
    source: Number(row.source_id),
    target: Number(row.target_id),
    weight: Number(row.weight)
  }))
}

function getRelatedConversations(
  conversationId: number,
  limit: number
): RelatedConversation[] {
  const db = requireDatabase()
  const edgeRows = db.selectObjects(
    `
      SELECT source_id, target_id, weight
      FROM edges
      WHERE source_id = ? OR target_id = ?
      ORDER BY weight DESC
      LIMIT ?
    `,
    [conversationId, conversationId, limit]
  )

  const relatedIds = edgeRows.map((row) =>
    Number(row.source_id) === conversationId
      ? Number(row.target_id)
      : Number(row.source_id)
  )
  if (relatedIds.length === 0) {
    return []
  }

  const idFilter = relatedIds.map(() => "?").join(", ")
  const conversations = db
    .selectObjects(
      `
        SELECT id, title, platform
        FROM conversations
        WHERE id IN (${idFilter})
      `,
      relatedIds
    )
    .map((record) => ({
      id: Number(record.id),
      title: String(record.title),
      platform: String(record.platform)
    }))

  const byId = new Map(conversations.map((record) => [record.id, record]))
  return edgeRows
    .map((row) => {
      const relatedId =
        Number(row.source_id) === conversationId
          ? Number(row.target_id)
          : Number(row.source_id)
      const conversation = byId.get(relatedId)
      if (!conversation) {
        return null
      }

      return {
        id: conversation.id,
        title: conversation.title,
        platform: conversation.platform as RelatedConversation["platform"],
        similarity: Math.round(Number(row.weight) * 100)
      } satisfies RelatedConversation
    })
    .filter((record): record is RelatedConversation => record !== null)
}

async function handleMessage(
  message: KnowledgeWorkerRequest
): Promise<KnowledgeWorkerResponse> {
  try {
    switch (message.type) {
      case "INIT": {
        const result = await initializeDatabase(
          message.payload.dbFilename,
          message.payload.directory
        )
        return { id: message.id, ok: true, type: message.type, result }
      }
      case "IMPORT_FULL_SNAPSHOT": {
        const db = requireDatabase()
        replaceSnapshot(db, message.payload.snapshot)
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: buildValidationDigest(message.payload.snapshot)
        }
      }
      case "UPSERT_CONVERSATION_DELTA": {
        const db = requireDatabase()
        applyConversationDelta(
          db,
          message.payload.delta,
          message.payload.deletedConversationIds
        )
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: buildValidationDigest({
            exportedAt: message.payload.delta.exportedAt,
            conversations: withConversations(db),
            messages: withMessages(db),
            topics: withTopics(db),
            notes: withNotes(db),
            annotations: withAnnotations(db),
            summaries: withSummaries(db),
            weeklyReports: withWeeklyReports(db),
            exploreSessions: withExploreSessions(db),
            exploreMessages: withExploreMessages(db),
            embeddings: withEmbeddings(db)
          })
        }
      }
      case "CLEAR_KNOWLEDGE_DATA": {
        const db = requireDatabase()
        db.exec(`
          DELETE FROM edges;
          DELETE FROM embeddings;
          DELETE FROM explore_messages;
          DELETE FROM explore_sessions;
          DELETE FROM weekly_reports;
          DELETE FROM summaries;
          DELETE FROM notes;
          DELETE FROM topics;
          DELETE FROM annotations;
          DELETE FROM messages;
          DELETE FROM conversations;
        `)
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: { cleared: true }
        }
      }
      case "LIST_CONVERSATIONS": {
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: listConversations(message.payload?.filters)
        }
      }
      case "GET_TOPICS_WITH_COUNTS": {
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: getTopicsWithCounts()
        }
      }
      case "GET_DASHBOARD_STATS": {
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: getDashboardStats()
        }
      }
      case "SEARCH_CONVERSATION_IDS_BY_TEXT": {
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: searchConversationIdsByText(message.payload.query)
        }
      }
      case "SEARCH_CONVERSATION_MATCHES_BY_TEXT": {
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: searchConversationMatchesByText(message.payload.params)
        }
      }
      case "GET_ALL_EDGES": {
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: getAllEdges(message.payload)
        }
      }
      case "GET_RELATED_CONVERSATIONS": {
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: getRelatedConversations(
            message.payload.conversationId,
            message.payload.limit
          )
        }
      }
      case "RETRIEVE_RAG_CONTEXT": {
        return {
          id: message.id,
          ok: true,
          type: message.type,
          result: retrieveRagContext(message.payload)
        }
      }
      default: {
        throw new Error(
          `Unsupported knowledge worker message: ${String(message)}`
        )
      }
    }
  } catch (error) {
    return {
      id: message.id,
      ok: false,
      type: message.type,
      error: (error as Error).message || "Unknown knowledge worker error"
    }
  }
}

self.addEventListener(
  "message",
  (event: MessageEvent<KnowledgeWorkerRequest>) => {
    void (async () => {
      const response = await handleMessage(event.data)
      self.postMessage(response)
    })()
  }
)

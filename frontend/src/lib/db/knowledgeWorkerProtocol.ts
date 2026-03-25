import type { ConversationFilters } from "../messaging/protocol"
import type {
  Conversation,
  ConversationMatchSummary,
  DashboardStats,
  RelatedConversation,
  SearchConversationMatchesQuery,
  Topic
} from "../types"
import type {
  KnowledgeConversationDelta,
  KnowledgeSnapshot,
  KnowledgeValidationDigest
} from "./archiveStore"

export interface KnowledgeWorkerInitPayload {
  dbFilename: string
  directory: string
}

export interface KnowledgeWorkerEngineInfo {
  engine: "opfs-sahpool"
  dbFilename: string
  sqliteVersion: string
}

export interface KnowledgeRagRetrievalItem {
  source: RelatedConversation
  contextBlock: string
  excerpt: string
}

export interface KnowledgeRagRetrievalResult {
  sources: RelatedConversation[]
  context: string
  items: KnowledgeRagRetrievalItem[]
}

export type KnowledgeWorkerRequest =
  | {
      id: number
      type: "INIT"
      payload: KnowledgeWorkerInitPayload
    }
  | {
      id: number
      type: "IMPORT_FULL_SNAPSHOT"
      payload: {
        snapshot: KnowledgeSnapshot
      }
    }
  | {
      id: number
      type: "UPSERT_CONVERSATION_DELTA"
      payload: {
        delta: KnowledgeConversationDelta
        deletedConversationIds: number[]
      }
    }
  | {
      id: number
      type: "CLEAR_KNOWLEDGE_DATA"
    }
  | {
      id: number
      type: "LIST_CONVERSATIONS"
      payload?: {
        filters?: ConversationFilters
      }
    }
  | {
      id: number
      type: "GET_TOPICS_WITH_COUNTS"
    }
  | {
      id: number
      type: "GET_DASHBOARD_STATS"
    }
  | {
      id: number
      type: "SEARCH_CONVERSATION_IDS_BY_TEXT"
      payload: {
        query: string
      }
    }
  | {
      id: number
      type: "SEARCH_CONVERSATION_MATCHES_BY_TEXT"
      payload: {
        params: SearchConversationMatchesQuery
      }
    }
  | {
      id: number
      type: "GET_ALL_EDGES"
      payload: {
        threshold: number
        conversationIds?: number[]
      }
    }
  | {
      id: number
      type: "GET_RELATED_CONVERSATIONS"
      payload: {
        conversationId: number
        limit: number
      }
    }
  | {
      id: number
      type: "RETRIEVE_RAG_CONTEXT"
      payload: {
        queryEmbedding: Float32Array
        limit: number
        conversationIds?: number[]
      }
    }

export type KnowledgeWorkerResultMap = {
  INIT: KnowledgeWorkerEngineInfo
  IMPORT_FULL_SNAPSHOT: KnowledgeValidationDigest
  UPSERT_CONVERSATION_DELTA: KnowledgeValidationDigest
  CLEAR_KNOWLEDGE_DATA: { cleared: boolean }
  LIST_CONVERSATIONS: Conversation[]
  GET_TOPICS_WITH_COUNTS: Topic[]
  GET_DASHBOARD_STATS: DashboardStats
  SEARCH_CONVERSATION_IDS_BY_TEXT: number[]
  SEARCH_CONVERSATION_MATCHES_BY_TEXT: ConversationMatchSummary[]
  GET_ALL_EDGES: Array<{ source: number; target: number; weight: number }>
  GET_RELATED_CONVERSATIONS: RelatedConversation[]
  RETRIEVE_RAG_CONTEXT: KnowledgeRagRetrievalResult
}

export type KnowledgeWorkerResponse<
  T extends keyof KnowledgeWorkerResultMap = keyof KnowledgeWorkerResultMap
> =
  | {
      id: number
      ok: true
      type: T
      result: KnowledgeWorkerResultMap[T]
    }
  | {
      id: number
      ok: false
      type: T
      error: string
    }

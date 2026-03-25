import type { ConversationFilters } from "../messaging/protocol"
import type {
  Conversation,
  ConversationMatchSummary,
  DashboardStats,
  RelatedConversation,
  SearchConversationMatchesQuery,
  Topic
} from "../types"
import { logger } from "../utils/logger"
import type { KnowledgeValidationDigest } from "./archiveStore"
import { dexieArchiveStore } from "./dexieArchiveStore"
import type {
  KnowledgeRagRetrievalResult,
  KnowledgeWorkerRequest,
  KnowledgeWorkerResponse,
  KnowledgeWorkerResultMap
} from "./knowledgeWorkerProtocol"
import {
  bumpStorageSnapshotWatermark,
  getStorageEngineState,
  markStorageEngineError,
  markStorageEngineReady,
  patchStorageEngineState,
  type StorageEngineState
} from "./storageEngineState"

const SQLITE_DB_FILENAME = "/vesti/knowledge-read-model.sqlite"
const SQLITE_VFS_DIRECTORY = "/vesti/opfs-sahpool"
type KnowledgeWorkerRequestType = KnowledgeWorkerRequest["type"]
type KnowledgeWorkerFailureResponse = Extract<
  KnowledgeWorkerResponse,
  { ok: false }
>
type KnowledgeWorkerSuccessResponse = Extract<
  KnowledgeWorkerResponse,
  { ok: true }
>
type KnowledgeWorkerPayload<T extends KnowledgeWorkerRequestType> =
  Extract<KnowledgeWorkerRequest, { type: T }> extends { payload?: infer P }
    ? P
    : undefined

function isKnowledgeWorkerFailureResponse(
  response: KnowledgeWorkerResponse
): response is KnowledgeWorkerFailureResponse {
  return response.ok === false
}

function isKnowledgeWorkerSuccessResponse(
  response: KnowledgeWorkerResponse
): response is KnowledgeWorkerSuccessResponse {
  return response.ok === true
}

class OffscreenKnowledgeQueryStore {
  private worker: Worker | null = null
  private nextRequestId = 1
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    }
  >()
  private initPromise: Promise<StorageEngineState> | null = null
  private initializedThisSession = false
  private pendingConversationIds = new Set<number>()
  private pendingDeletedConversationIds = new Set<number>()
  private needsFullSnapshot = false

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL("../../workers/knowledge-store.worker.ts", import.meta.url),
        { type: "module" }
      )
      this.worker.addEventListener(
        "message",
        (event: MessageEvent<KnowledgeWorkerResponse>) => {
          const pending = this.pendingRequests.get(event.data.id)
          if (!pending) {
            return
          }

          this.pendingRequests.delete(event.data.id)
          if (isKnowledgeWorkerSuccessResponse(event.data)) {
            pending.resolve(event.data.result)
            return
          }

          if (!isKnowledgeWorkerFailureResponse(event.data)) {
            pending.reject(new Error("Unknown knowledge worker response"))
            return
          }

          pending.reject(new Error(event.data.error))
        }
      )
    }

    return this.worker
  }

  private async callWorker<T extends KnowledgeWorkerRequestType>(
    type: T,
    payload?: KnowledgeWorkerPayload<T>
  ): Promise<KnowledgeWorkerResultMap[T]> {
    const worker = this.ensureWorker()
    const requestId = this.nextRequestId
    this.nextRequestId += 1

    return new Promise<KnowledgeWorkerResultMap[T]>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject })

      const request: KnowledgeWorkerRequest = {
        id: requestId,
        type,
        ...(payload === undefined ? {} : { payload })
      } as KnowledgeWorkerRequest

      worker.postMessage(request)
    })
  }

  private validateDigest(
    expected: KnowledgeValidationDigest,
    actual: KnowledgeValidationDigest
  ): void {
    const expectedSerialized = JSON.stringify(expected)
    const actualSerialized = JSON.stringify(actual)
    if (expectedSerialized !== actualSerialized) {
      throw new Error("SQLITE_READ_MODEL_VALIDATION_FAILED")
    }
  }

  private async importFullSnapshot(targetWatermark: number): Promise<void> {
    const snapshot = await dexieArchiveStore.exportKnowledgeSnapshot()
    const actualDigest = await this.callWorker("IMPORT_FULL_SNAPSHOT", {
      snapshot
    })
    const expectedDigest = dexieArchiveStore.buildValidationDigest(snapshot)
    this.validateDigest(expectedDigest, actualDigest)

    this.pendingConversationIds.clear()
    this.pendingDeletedConversationIds.clear()
    this.needsFullSnapshot = false

    await patchStorageEngineState({
      activeEngine: "sqlite",
      migrationState: "ready",
      appliedWatermark: targetWatermark,
      lastError: null
    })
  }

  private async flushPendingChanges(targetWatermark: number): Promise<void> {
    if (this.needsFullSnapshot || this.pendingConversationIds.size === 0) {
      await this.importFullSnapshot(targetWatermark)
      return
    }

    const conversationIds = Array.from(this.pendingConversationIds).sort(
      (left, right) => left - right
    )
    const deletedConversationIds = Array.from(
      this.pendingDeletedConversationIds
    ).sort((left, right) => left - right)
    const delta =
      await dexieArchiveStore.exportConversationDelta(conversationIds)
    await this.callWorker("UPSERT_CONVERSATION_DELTA", {
      delta,
      deletedConversationIds
    })

    this.pendingConversationIds.clear()
    this.pendingDeletedConversationIds.clear()
    this.needsFullSnapshot = false

    await patchStorageEngineState({
      activeEngine: "sqlite",
      migrationState: "ready",
      appliedWatermark: targetWatermark,
      lastError: null
    })
  }

  async initialize(): Promise<StorageEngineState> {
    if (this.initPromise) {
      return this.initPromise
    }

    if (this.initializedThisSession) {
      return getStorageEngineState()
    }

    this.initPromise = (async () => {
      let state = await getStorageEngineState()
      if (state.activeEngine === "sqlite" && state.migrationState === "ready") {
        this.initializedThisSession = true
        await this.callWorker("INIT", {
          dbFilename: SQLITE_DB_FILENAME,
          directory: SQLITE_VFS_DIRECTORY
        })
        return state
      }

      await patchStorageEngineState({
        activeEngine: "dexie",
        migrationState: "initializing",
        lastError: null
      })

      try {
        await this.callWorker("INIT", {
          dbFilename: SQLITE_DB_FILENAME,
          directory: SQLITE_VFS_DIRECTORY
        })

        const watermark = Date.now()
        await patchStorageEngineState({
          activeEngine: "dexie",
          migrationState: "migrating",
          snapshotWatermark: watermark,
          lastError: null
        })

        await this.importFullSnapshot(watermark)
        state = await markStorageEngineReady(watermark)
        this.initializedThisSession = true
        return state
      } catch (error) {
        const message =
          (error as Error).message || "SQLITE_READ_MODEL_INIT_FAILED"
        logger.warn("db", "SQLite read-model initialization failed", {
          error: message
        })
        state = await markStorageEngineError(message)
        this.initializedThisSession = true
        return state
      } finally {
        this.initPromise = null
      }
    })()

    return this.initPromise
  }

  async prepareForQuery(): Promise<boolean> {
    const initialized = await this.initialize()
    if (
      initialized.activeEngine !== "sqlite" ||
      initialized.migrationState !== "ready"
    ) {
      return false
    }

    const state = await getStorageEngineState()
    const snapshotWatermark = state.snapshotWatermark ?? 0
    const appliedWatermark = state.appliedWatermark ?? 0
    if (snapshotWatermark <= appliedWatermark) {
      return true
    }

    try {
      await this.flushPendingChanges(snapshotWatermark)
      return true
    } catch (error) {
      const message =
        (error as Error).message || "SQLITE_READ_MODEL_SYNC_FAILED"
      await markStorageEngineError(message)
      logger.warn(
        "db",
        "SQLite read-model sync failed; falling back to Dexie",
        {
          error: message
        }
      )
      return false
    }
  }

  async markConversationsDirty(conversationIds: number[]): Promise<void> {
    conversationIds.forEach((conversationId) => {
      if (
        typeof conversationId !== "number" ||
        !Number.isFinite(conversationId)
      ) {
        return
      }
      const normalized = Math.floor(conversationId)
      if (normalized <= 0) {
        return
      }
      this.pendingDeletedConversationIds.delete(normalized)
      this.pendingConversationIds.add(normalized)
    })

    await bumpStorageSnapshotWatermark()
  }

  async markConversationsDeleted(conversationIds: number[]): Promise<void> {
    conversationIds.forEach((conversationId) => {
      if (
        typeof conversationId !== "number" ||
        !Number.isFinite(conversationId)
      ) {
        return
      }
      const normalized = Math.floor(conversationId)
      if (normalized <= 0) {
        return
      }
      this.pendingConversationIds.delete(normalized)
      this.pendingDeletedConversationIds.add(normalized)
    })

    await bumpStorageSnapshotWatermark()
  }

  async markGlobalMutation(): Promise<void> {
    this.needsFullSnapshot = true
    await bumpStorageSnapshotWatermark()
  }

  async clearAfterAuthoritativeClear(): Promise<void> {
    const state = await getStorageEngineState()
    const watermark = Date.now()

    this.pendingConversationIds.clear()
    this.pendingDeletedConversationIds.clear()
    this.needsFullSnapshot = false

    if (state.activeEngine === "sqlite" && state.migrationState === "ready") {
      await this.callWorker("CLEAR_KNOWLEDGE_DATA")
    }

    await patchStorageEngineState({
      snapshotWatermark: watermark,
      appliedWatermark: watermark,
      lastError: null
    })
  }

  async searchConversationIdsByText(query: string): Promise<number[] | null> {
    if (!(await this.prepareForQuery())) {
      return null
    }

    return this.callWorker("SEARCH_CONVERSATION_IDS_BY_TEXT", { query })
  }

  async searchConversationMatchesByText(
    params: SearchConversationMatchesQuery
  ): Promise<ConversationMatchSummary[] | null> {
    if (!(await this.prepareForQuery())) {
      return null
    }

    return this.callWorker("SEARCH_CONVERSATION_MATCHES_BY_TEXT", { params })
  }

  async getAllEdges(payload: {
    threshold: number
    conversationIds?: number[]
  }): Promise<Array<{
    source: number
    target: number
    weight: number
  }> | null> {
    if (!(await this.prepareForQuery())) {
      return null
    }

    return this.callWorker("GET_ALL_EDGES", payload)
  }

  async getRelatedConversations(
    conversationId: number,
    limit: number
  ): Promise<RelatedConversation[] | null> {
    if (!(await this.prepareForQuery())) {
      return null
    }

    return this.callWorker("GET_RELATED_CONVERSATIONS", {
      conversationId,
      limit
    })
  }

  async listConversations(
    filters?: ConversationFilters
  ): Promise<Conversation[] | null> {
    if (!(await this.prepareForQuery())) {
      return null
    }

    return this.callWorker("LIST_CONVERSATIONS", { filters })
  }

  async getTopicsWithCounts(): Promise<Topic[] | null> {
    if (!(await this.prepareForQuery())) {
      return null
    }

    return this.callWorker("GET_TOPICS_WITH_COUNTS")
  }

  async getDashboardStats(): Promise<DashboardStats | null> {
    if (!(await this.prepareForQuery())) {
      return null
    }

    return this.callWorker("GET_DASHBOARD_STATS")
  }

  async retrieveRagContext(payload: {
    queryEmbedding: Float32Array
    limit: number
    conversationIds?: number[]
  }): Promise<KnowledgeRagRetrievalResult | null> {
    if (!(await this.prepareForQuery())) {
      return null
    }

    return this.callWorker("RETRIEVE_RAG_CONTEXT", payload)
  }
}

const offscreenKnowledgeQueryStore = new OffscreenKnowledgeQueryStore()

export async function initializeKnowledgeQueryStore(): Promise<StorageEngineState> {
  return offscreenKnowledgeQueryStore.initialize()
}

export async function markKnowledgeConversationsDirty(
  conversationIds: number[]
): Promise<void> {
  await offscreenKnowledgeQueryStore.markConversationsDirty(conversationIds)
}

export async function markKnowledgeConversationsDeleted(
  conversationIds: number[]
): Promise<void> {
  await offscreenKnowledgeQueryStore.markConversationsDeleted(conversationIds)
}

export async function markKnowledgeGlobalMutation(): Promise<void> {
  await offscreenKnowledgeQueryStore.markGlobalMutation()
}

export async function clearKnowledgeReadModelAfterAuthoritativeClear(): Promise<void> {
  await offscreenKnowledgeQueryStore.clearAfterAuthoritativeClear()
}

export async function queryConversationIdsFromKnowledgeStore(
  query: string
): Promise<number[] | null> {
  return offscreenKnowledgeQueryStore.searchConversationIdsByText(query)
}

export async function queryConversationsFromKnowledgeStore(
  filters?: ConversationFilters
): Promise<Conversation[] | null> {
  return offscreenKnowledgeQueryStore.listConversations(filters)
}

export async function queryTopicsWithCountsFromKnowledgeStore(): Promise<
  Topic[] | null
> {
  return offscreenKnowledgeQueryStore.getTopicsWithCounts()
}

export async function queryDashboardStatsFromKnowledgeStore(): Promise<DashboardStats | null> {
  return offscreenKnowledgeQueryStore.getDashboardStats()
}

export async function queryConversationMatchesFromKnowledgeStore(
  params: SearchConversationMatchesQuery
): Promise<ConversationMatchSummary[] | null> {
  return offscreenKnowledgeQueryStore.searchConversationMatchesByText(params)
}

export async function queryAllEdgesFromKnowledgeStore(payload: {
  threshold: number
  conversationIds?: number[]
}): Promise<Array<{ source: number; target: number; weight: number }> | null> {
  return offscreenKnowledgeQueryStore.getAllEdges(payload)
}

export async function queryRelatedConversationsFromKnowledgeStore(
  conversationId: number,
  limit: number
): Promise<RelatedConversation[] | null> {
  return offscreenKnowledgeQueryStore.getRelatedConversations(
    conversationId,
    limit
  )
}

export async function retrieveRagContextFromKnowledgeStore(payload: {
  queryEmbedding: Float32Array
  limit: number
  conversationIds?: number[]
}): Promise<KnowledgeRagRetrievalResult | null> {
  return offscreenKnowledgeQueryStore.retrieveRagContext(payload)
}

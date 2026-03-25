import {
  getLocalStorageValue,
  setLocalStorageValue
} from "../utils/chromeStorageBridge"

export type StorageEngineKind = "dexie" | "sqlite"

export type StorageMigrationState =
  | "idle"
  | "initializing"
  | "migrating"
  | "validating"
  | "ready"
  | "error"

export interface StorageEngineState {
  activeEngine: StorageEngineKind
  migrationState: StorageMigrationState
  snapshotWatermark: number | null
  appliedWatermark: number | null
  lastError: string | null
  updatedAt: number
}

const STORAGE_ENGINE_STATE_KEY = "vesti_storage_engine_state"

const DEFAULT_STORAGE_ENGINE_STATE: StorageEngineState = {
  activeEngine: "dexie",
  migrationState: "idle",
  snapshotWatermark: null,
  appliedWatermark: null,
  lastError: null,
  updatedAt: 0
}

let memoryStorageEngineState: StorageEngineState = {
  ...DEFAULT_STORAGE_ENGINE_STATE
}

function normalizeStorageEngineState(raw: unknown): StorageEngineState {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_STORAGE_ENGINE_STATE }
  }

  const state = raw as Partial<StorageEngineState>
  const activeEngine = state.activeEngine === "sqlite" ? "sqlite" : "dexie"
  const migrationState: StorageMigrationState =
    state.migrationState === "initializing" ||
    state.migrationState === "migrating" ||
    state.migrationState === "validating" ||
    state.migrationState === "ready" ||
    state.migrationState === "error"
      ? state.migrationState
      : "idle"

  return {
    activeEngine,
    migrationState,
    snapshotWatermark:
      typeof state.snapshotWatermark === "number" &&
      Number.isFinite(state.snapshotWatermark)
        ? state.snapshotWatermark
        : null,
    appliedWatermark:
      typeof state.appliedWatermark === "number" &&
      Number.isFinite(state.appliedWatermark)
        ? state.appliedWatermark
        : null,
    lastError: typeof state.lastError === "string" ? state.lastError : null,
    updatedAt:
      typeof state.updatedAt === "number" && Number.isFinite(state.updatedAt)
        ? state.updatedAt
        : 0
  }
}

export async function getStorageEngineState(): Promise<StorageEngineState> {
  try {
    const raw = await getLocalStorageValue<unknown>(STORAGE_ENGINE_STATE_KEY)
    const normalized = normalizeStorageEngineState(raw)
    memoryStorageEngineState = normalized
    return { ...normalized }
  } catch {
    return { ...memoryStorageEngineState }
  }
}

export async function patchStorageEngineState(
  patch: Partial<StorageEngineState>
): Promise<StorageEngineState> {
  const current = await getStorageEngineState()

  const next = normalizeStorageEngineState({
    ...current,
    ...patch,
    updatedAt: Date.now()
  })

  memoryStorageEngineState = next

  try {
    await setLocalStorageValue(STORAGE_ENGINE_STATE_KEY, next)
  } catch {
    return { ...next }
  }

  return { ...next }
}

export async function bumpStorageSnapshotWatermark(
  nextWatermark: number = Date.now()
): Promise<StorageEngineState> {
  return patchStorageEngineState({
    snapshotWatermark: nextWatermark
  })
}

export async function markStorageEngineReady(
  watermark: number
): Promise<StorageEngineState> {
  return patchStorageEngineState({
    activeEngine: "sqlite",
    migrationState: "ready",
    snapshotWatermark: watermark,
    appliedWatermark: watermark,
    lastError: null
  })
}

export async function markStorageEngineError(
  error: string
): Promise<StorageEngineState> {
  return patchStorageEngineState({
    activeEngine: "dexie",
    migrationState: "error",
    lastError: error
  })
}

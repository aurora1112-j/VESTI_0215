import type { CaptureMode, CaptureSettings } from "../types"
import {
  getLocalStorageValue,
  setLocalStorageValue
} from "../utils/chromeStorageBridge"

const STORAGE_KEY = "vesti_capture_settings"
const DEFAULT_MIN_TURNS = 3
const MIN_TURNS_LIMIT = 1
const MAX_TURNS_LIMIT = 20

const LEGACY_MODE_MAP: Record<string, CaptureMode> = {
  full_mirror: "mirror",
  smart_denoise: "smart",
  curator: "manual",
  mirror: "mirror",
  smart: "smart",
  manual: "manual"
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  mode: "mirror",
  smartConfig: {
    minTurns: DEFAULT_MIN_TURNS,
    blacklistKeywords: []
  }
}

function normalizeMode(value: unknown): CaptureMode {
  if (typeof value !== "string") {
    return DEFAULT_CAPTURE_SETTINGS.mode
  }
  return (
    LEGACY_MODE_MAP[value.trim().toLowerCase()] ?? DEFAULT_CAPTURE_SETTINGS.mode
  )
}

function normalizeMinTurns(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return DEFAULT_MIN_TURNS
  }
  return Math.min(MAX_TURNS_LIMIT, Math.max(MIN_TURNS_LIMIT, Math.round(num)))
}

function normalizeBlacklistKeywords(value: unknown): string[] {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : []

  const result: string[] = []
  const seen = new Set<string>()

  for (const raw of rawItems) {
    const keyword = String(raw).trim()
    if (!keyword || seen.has(keyword)) continue
    seen.add(keyword)
    result.push(keyword)
  }

  return result
}

export function normalizeCaptureSettings(input: unknown): CaptureSettings {
  if (!input || typeof input !== "object") {
    return DEFAULT_CAPTURE_SETTINGS
  }

  const raw = input as {
    mode?: unknown
    smartConfig?: { minTurns?: unknown; blacklistKeywords?: unknown }
  }

  return {
    mode: normalizeMode(raw.mode),
    smartConfig: {
      minTurns: normalizeMinTurns(raw.smartConfig?.minTurns),
      blacklistKeywords: normalizeBlacklistKeywords(
        raw.smartConfig?.blacklistKeywords
      )
    }
  }
}

export async function getCaptureSettings(): Promise<CaptureSettings> {
  const raw = await getLocalStorageValue<unknown>(STORAGE_KEY)
  return normalizeCaptureSettings(raw)
}

export async function setCaptureSettings(
  settings: CaptureSettings
): Promise<void> {
  const normalized = normalizeCaptureSettings(settings)
  await setLocalStorageValue(STORAGE_KEY, normalized)
}

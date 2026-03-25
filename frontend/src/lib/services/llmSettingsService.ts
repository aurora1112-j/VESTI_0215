import type { LlmConfig } from "../types"
import {
  getLocalStorageValue,
  setLocalStorageValue
} from "../utils/chromeStorageBridge"
import {
  buildDefaultLlmSettings,
  needsProxySettingsBackfill,
  normalizeLlmSettings
} from "./llmConfig"

const STORAGE_KEY = "vesti_llm_settings"

export async function getLlmSettings(): Promise<LlmConfig | null> {
  const raw =
    (await getLocalStorageValue<LlmConfig | null>(STORAGE_KEY)) ?? null
  if (!raw) {
    return buildDefaultLlmSettings()
  }

  const normalized = normalizeLlmSettings(raw)
  if (needsProxySettingsBackfill(raw)) {
    void setLocalStorageValue(STORAGE_KEY, normalized).catch(() => {})
  }

  return normalized
}

export async function setLlmSettings(settings: LlmConfig): Promise<void> {
  const normalized = normalizeLlmSettings(settings)
  await setLocalStorageValue(STORAGE_KEY, normalized)
}

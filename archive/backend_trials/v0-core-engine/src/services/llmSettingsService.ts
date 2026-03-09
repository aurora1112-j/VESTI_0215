import type { LlmConfig } from "../types";

const STORAGE_KEY = "vesti_llm_settings";

function getStorage() {
  if (!chrome?.storage?.local) {
    throw new Error("STORAGE_UNAVAILABLE");
  }
  return chrome.storage.local;
}

export async function getLlmSettings(): Promise<LlmConfig | null> {
  const storage = getStorage();
  return new Promise((resolve, reject) => {
    storage.get([STORAGE_KEY], (result: Record<string, unknown>) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve((result[STORAGE_KEY] as LlmConfig | undefined) ?? null);
    });
  });
}

export async function setLlmSettings(settings: LlmConfig): Promise<void> {
  const storage = getStorage();
  return new Promise((resolve, reject) => {
    storage.set({ [STORAGE_KEY]: settings }, () => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}


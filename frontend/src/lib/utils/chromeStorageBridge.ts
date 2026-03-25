export type InternalStorageBridgeMessage =
  | {
      type: "VESTI_INTERNAL_STORAGE_GET"
      payload: { key: string }
    }
  | {
      type: "VESTI_INTERNAL_STORAGE_SET"
      payload: { values: Record<string, unknown> }
    }

export type InternalStorageBridgeResponse =
  | { ok: true; value?: unknown }
  | { ok: false; error: string }

type InternalStorageBridgeSuccessResponse = Extract<
  InternalStorageBridgeResponse,
  { ok: true }
>
type InternalStorageBridgeFailureResponse = Extract<
  InternalStorageBridgeResponse,
  { ok: false }
>

function isInternalStorageBridgeFailureResponse(
  response: InternalStorageBridgeResponse
): response is InternalStorageBridgeFailureResponse {
  return response.ok === false
}

function resolveStorageArea(): chrome.storage.StorageArea | null {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return null
  }

  return chrome.storage.local
}

function sendInternalStorageBridgeMessage(
  message: InternalStorageBridgeMessage
): Promise<InternalStorageBridgeSuccessResponse> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return Promise.reject(new Error("STORAGE_UNAVAILABLE"))
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      message,
      (response: InternalStorageBridgeResponse | undefined) => {
        const error = chrome.runtime?.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        if (!response) {
          reject(new Error("STORAGE_UNAVAILABLE"))
          return
        }

        if (isInternalStorageBridgeFailureResponse(response)) {
          reject(new Error(response.error || "STORAGE_UNAVAILABLE"))
          return
        }

        resolve(response)
      }
    )
  })
}

export async function getLocalStorageValue<T>(
  key: string
): Promise<T | undefined> {
  const storageArea = resolveStorageArea()
  if (storageArea) {
    return new Promise((resolve, reject) => {
      storageArea.get([key], (result) => {
        const error = chrome.runtime?.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve(result?.[key] as T | undefined)
      })
    })
  }

  const response = await sendInternalStorageBridgeMessage({
    type: "VESTI_INTERNAL_STORAGE_GET",
    payload: { key }
  })

  return response.value as T | undefined
}

export async function setLocalStorageValues(
  values: Record<string, unknown>
): Promise<void> {
  const storageArea = resolveStorageArea()
  if (storageArea) {
    return new Promise((resolve, reject) => {
      storageArea.set(values, () => {
        const error = chrome.runtime?.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }

        resolve()
      })
    })
  }

  await sendInternalStorageBridgeMessage({
    type: "VESTI_INTERNAL_STORAGE_SET",
    payload: { values }
  })
}

export async function setLocalStorageValue(
  key: string,
  value: unknown
): Promise<void> {
  await setLocalStorageValues({ [key]: value })
}

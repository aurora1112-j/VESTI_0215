import { bumpStorageSnapshotWatermark } from "../lib/db/storageEngineState"
import { isRequestMessage } from "../lib/messaging/protocol"
import type { RequestMessage, ResponseMessage } from "../lib/messaging/protocol"
import { getCaptureSettings } from "../lib/services/captureSettingsService"
import { vectorizeAllConversations } from "../lib/services/searchService"
import type {
  ActiveCaptureStatus,
  CaptureMode,
  ForceArchiveTransientResult,
  Platform
} from "../lib/types"
import type {
  InternalStorageBridgeMessage,
  InternalStorageBridgeResponse
} from "../lib/utils/chromeStorageBridge"
import { logger } from "../lib/utils/logger"
import { setupOffscreenDocument } from "./offscreenDocument"

let isVectorizing = false
let rerunVectorizationRequested = false

async function runVectorizationTask(reason: string): Promise<boolean> {
  if (isVectorizing) {
    rerunVectorizationRequested = true
    return false
  }
  isVectorizing = true
  try {
    const created = await vectorizeAllConversations()
    if (created > 0) {
      await bumpStorageSnapshotWatermark()
    }
    logger.info("vectorize", "Vectorization task completed", {
      reason,
      created
    })
  } catch (error) {
    logger.warn("vectorize", "Vectorization task failed", {
      reason,
      error: (error as Error)?.message ?? String(error)
    })
  } finally {
    isVectorizing = false
    if (rerunVectorizationRequested) {
      rerunVectorizationRequested = false
      void runVectorizationTask("rerun")
    }
  }
  return true
}

async function forwardRequestToOffscreen(
  message: RequestMessage
): Promise<ResponseMessage> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { ...message, via: "background" } as RequestMessage,
      (response: ResponseMessage) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve(response)
      }
    )
  })
}

function ensureOffscreenDocument(context: string): void {
  void setupOffscreenDocument().catch((error) => {
    logger.warn("background", "Failed to ensure offscreen document", {
      context,
      error: (error as Error).message || String(error)
    })
  })
}

type ContentTransientStatusResponse =
  | {
      ok: true
      status: {
        available: boolean
        reason: "ok" | "no_transient"
        platform?: Platform
        sessionUUID?: string
        transientKey?: string
        messageCount?: number
        turnCount?: number
        lastDecision?: ActiveCaptureStatus["lastDecision"]
        firstObservedAt?: number
        updatedAt?: number
      }
    }
  | { ok: false; error: string }

type ContentForceArchiveResponse =
  | {
      ok: true
      result: {
        saved: boolean
        newMessages: number
        conversationId?: number
        decision: ForceArchiveTransientResult["decision"]
      }
    }
  | { ok: false; error: string }

const SUPPORTED_CAPTURE_HOSTS = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "chat.deepseek.com",
  "www.doubao.com",
  "chat.qwen.ai",
  "www.kimi.com",
  "kimi.com",
  "kimi.moonshot.cn",
  "yuanbao.tencent.com"
])

function resolvePlatformFromUrl(url: string): Platform | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === "chatgpt.com" || host === "chat.openai.com") {
      return "ChatGPT"
    }
    if (host === "claude.ai") {
      return "Claude"
    }
    if (host === "gemini.google.com") {
      return "Gemini"
    }
    if (host === "chat.deepseek.com") {
      return "DeepSeek"
    }
    if (host === "www.doubao.com") {
      return "Doubao"
    }
    if (host === "chat.qwen.ai") {
      return "Qwen"
    }
    if (
      host === "www.kimi.com" ||
      host === "kimi.com" ||
      host === "kimi.moonshot.cn"
    ) {
      return "Kimi"
    }
    if (host === "yuanbao.tencent.com") {
      return "Yuanbao"
    }
  } catch {
    return undefined
  }

  return undefined
}

function isSupportedCaptureTabUrl(url?: string): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return SUPPORTED_CAPTURE_HOSTS.has(host)
  } catch {
    return false
  }
}

function getModeFromSettings(mode: CaptureMode): CaptureMode {
  if (mode === "mirror" || mode === "smart" || mode === "manual") {
    return mode
  }
  return "mirror"
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] ?? null)
    })
  })
}

async function sendMessageToTab<T>(
  tabId: number,
  message: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: T) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }
      resolve(response)
    })
  })
}

async function buildActiveCaptureStatus(
  mode: CaptureMode
): Promise<ActiveCaptureStatus> {
  const tab = await getActiveTab()
  if (!tab?.id || !isSupportedCaptureTabUrl(tab.url)) {
    return {
      mode,
      supported: false,
      available: false,
      reason: "unsupported_tab"
    }
  }

  const platform = tab.url ? resolvePlatformFromUrl(tab.url) : undefined

  if (mode === "mirror") {
    return {
      mode,
      supported: true,
      available: false,
      reason: "mode_mirror",
      platform
    }
  }

  try {
    const response = await sendMessageToTab<ContentTransientStatusResponse>(
      tab.id,
      {
        type: "GET_TRANSIENT_CAPTURE_STATUS"
      }
    )

    if (!response?.ok) {
      return {
        mode,
        supported: true,
        available: false,
        reason: "content_unreachable",
        platform
      }
    }

    return {
      mode,
      supported: true,
      available: response.status.available,
      reason: response.status.reason === "ok" ? "ok" : "no_transient",
      platform: response.status.platform ?? platform,
      sessionUUID: response.status.sessionUUID,
      transientKey: response.status.transientKey,
      messageCount: response.status.messageCount,
      turnCount: response.status.turnCount,
      lastDecision: response.status.lastDecision,
      firstObservedAt: response.status.firstObservedAt,
      updatedAt: response.status.updatedAt
    }
  } catch {
    return {
      mode,
      supported: true,
      available: false,
      reason: "content_unreachable",
      platform
    }
  }
}

async function handleBackgroundRequest(
  message: Extract<RequestMessage, { target?: "background" }>
): Promise<ResponseMessage> {
  const messageType = message.type

  try {
    switch (message.type) {
      case "GET_ACTIVE_CAPTURE_STATUS": {
        const settings = await getCaptureSettings()
        const mode = getModeFromSettings(settings.mode)
        const data = await buildActiveCaptureStatus(mode)
        return { ok: true, type: messageType, data }
      }
      case "FORCE_ARCHIVE_TRANSIENT": {
        const settings = await getCaptureSettings()
        const mode = getModeFromSettings(settings.mode)
        if (mode === "mirror") {
          throw new Error("ARCHIVE_MODE_DISABLED")
        }

        const tab = await getActiveTab()
        if (!tab?.id) {
          throw new Error("ACTIVE_TAB_UNAVAILABLE")
        }
        if (!isSupportedCaptureTabUrl(tab.url)) {
          throw new Error("ACTIVE_TAB_UNSUPPORTED")
        }

        let response: ContentForceArchiveResponse
        try {
          response = await sendMessageToTab<ContentForceArchiveResponse>(
            tab.id,
            {
              type: "FORCE_ARCHIVE_TRANSIENT"
            }
          )
        } catch (error) {
          throw new Error((error as Error).message || "FORCE_ARCHIVE_FAILED")
        }

        if (!response || response.ok === false) {
          const errorMessage =
            response && response.ok === false
              ? response.error
              : "FORCE_ARCHIVE_FAILED"
          throw new Error(errorMessage || "FORCE_ARCHIVE_FAILED")
        }

        const data: ForceArchiveTransientResult = {
          forced: true,
          saved: response.result.saved,
          newMessages: response.result.newMessages,
          conversationId: response.result.conversationId,
          decision: response.result.decision
        }

        return { ok: true, type: messageType, data }
      }
      case "RUN_VECTORIZATION": {
        void runVectorizationTask("message")
        return { ok: true, type: messageType, data: { queued: true } }
      }
      default:
        return {
          ok: false,
          type: messageType,
          error: `Unsupported message type: ${messageType}`
        }
    }
  } catch (error) {
    logger.error("background", "Background request failed", error as Error)
    return {
      ok: false,
      type: messageType,
      error: (error as Error).message || "Unknown error"
    }
  }
}

if (chrome?.alarms?.create) {
  chrome.alarms.create("vectorize-job", { periodInMinutes: 5 })
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "vectorize-job") {
      void runVectorizationTask("alarm")
    }
  })
}

function openSidepanelForTab(tabId: number): void {
  if (!chrome?.sidePanel?.open) {
    logger.warn("background", "sidePanel API not available")
    return
  }
  chrome.sidePanel.setOptions(
    { tabId, path: "sidepanel.html", enabled: true },
    () => {
      chrome.sidePanel.open({ tabId }, () => {
        void chrome.runtime.lastError
      })
    }
  )
}

function isInternalStorageBridgeMessage(
  message: unknown
): message is InternalStorageBridgeMessage {
  if (!message || typeof message !== "object") {
    return false
  }

  const typed = message as {
    type?: string
    payload?: { key?: unknown; values?: unknown }
  }

  if (typed.type === "VESTI_INTERNAL_STORAGE_GET") {
    return typeof typed.payload?.key === "string"
  }

  if (typed.type === "VESTI_INTERNAL_STORAGE_SET") {
    return (
      !!typed.payload?.values &&
      typeof typed.payload.values === "object" &&
      !Array.isArray(typed.payload.values)
    )
  }

  return false
}

async function handleInternalStorageBridgeMessage(
  message: InternalStorageBridgeMessage
): Promise<InternalStorageBridgeResponse> {
  const storageArea = chrome.storage?.local
  if (!storageArea) {
    return { ok: false, error: "STORAGE_UNAVAILABLE" }
  }

  if (message.type === "VESTI_INTERNAL_STORAGE_GET") {
    return new Promise((resolve) => {
      storageArea.get([message.payload.key], (result) => {
        const error = chrome.runtime?.lastError
        if (error) {
          resolve({ ok: false, error: error.message })
          return
        }

        resolve({
          ok: true,
          value: result?.[message.payload.key]
        })
      })
    })
  }

  return new Promise((resolve) => {
    storageArea.set(message.payload.values, () => {
      const error = chrome.runtime?.lastError
      if (error) {
        resolve({ ok: false, error: error.message })
        return
      }

      resolve({ ok: true })
    })
  })
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (!message || typeof message !== "object") return
    const type = (message as { type?: string }).type
    if (type !== "OPEN_SIDEPANEL") return

    const tabId = sender.tab?.id
    if (typeof tabId === "number") {
      openSidepanelForTab(tabId)
      sendResponse?.({ ok: true })
      return
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeId = tabs[0]?.id
      if (typeof activeId === "number") {
        openSidepanelForTab(activeId)
      }
      sendResponse?.({ ok: true })
    })

    return true
  }
)

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (!isInternalStorageBridgeMessage(message)) return

    void (async () => {
      const response = await handleInternalStorageBridgeMessage(message)
      sendResponse(response)
    })()

    return true
  }
)

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (!isRequestMessage(message)) return
    if (message.target !== "offscreen") return
    if ((message as { via?: string }).via === "background") return

    void (async () => {
      try {
        await setupOffscreenDocument()
        const response = await forwardRequestToOffscreen(message)
        sendResponse(response)
      } catch (error) {
        logger.error(
          "background",
          "Failed to forward request to offscreen",
          error as Error
        )
        sendResponse({
          ok: false,
          type: message.type,
          error: (error as Error).message || "OFFSCREEN_FORWARD_FAILED"
        } satisfies ResponseMessage)
      }
    })()

    return true
  }
)

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (!isRequestMessage(message)) return
    if (message.target !== "background") return

    void (async () => {
      const response = await handleBackgroundRequest(
        message as Extract<RequestMessage, { target?: "background" }>
      )
      sendResponse(response)
    })()

    return true
  }
)

if (chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    ensureOffscreenDocument("onInstalled")
  })
}

if (chrome.runtime?.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    ensureOffscreenDocument("onStartup")
  })
}

ensureOffscreenDocument("background_init")

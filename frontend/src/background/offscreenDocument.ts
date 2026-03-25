const OFFSCREEN_DOCUMENT_PATH = "options.html?offscreen=1"

let creatingOffscreenDocument: Promise<void> | null = null

async function hasOffscreenDocument(): Promise<boolean> {
  if (!chrome.runtime?.getContexts) {
    return false
  }

  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    documentUrls: [offscreenUrl]
  })

  return contexts.length > 0
}

export async function setupOffscreenDocument(): Promise<void> {
  if (!chrome.offscreen?.createDocument) {
    throw new Error("OFFSCREEN_API_UNAVAILABLE")
  }

  if (await hasOffscreenDocument()) {
    return
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ["WORKERS" as chrome.offscreen.Reason],
        justification:
          "Run a single offscreen document and storage worker for the local SQLite read-model."
      })
      .then(() => undefined)
      .finally(() => {
        creatingOffscreenDocument = null
      })
  }

  await creatingOffscreenDocument
}

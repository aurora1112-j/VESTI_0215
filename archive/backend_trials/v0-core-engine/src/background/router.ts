import { isRequestMessage } from "../messaging/protocol";
import type { RequestMessage } from "../messaging/protocol";
import { logger } from "../utils/logger";

const OFFSCREEN_URL = "offscreen.html";

async function ensureOffscreenDocument(): Promise<void> {
  if (!chrome.offscreen) return;

  const hasDocument = await chrome.offscreen.hasDocument();
  if (hasDocument) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["BLOBS"],
    justification: "Store conversations in IndexedDB",
  });
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (!isRequestMessage(message)) return;
    if (message.via === "background") return;
    if (message.target !== "offscreen") return;

    void (async () => {
      try {
        await ensureOffscreenDocument();
        const forwarded: RequestMessage = {
          ...message,
          via: "background",
        };
        const response = await chrome.runtime.sendMessage(forwarded);
        sendResponse(response);
      } catch (error) {
        logger.error("background", "Forwarding failed", error as Error);
        sendResponse({
          ok: false,
          type: (message as RequestMessage).type,
          error: (error as Error).message || "Forwarding failed",
        });
      }
    })();

    return true;
  }
);


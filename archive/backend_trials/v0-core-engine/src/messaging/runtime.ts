import type { RequestMessage, ResponseMessage, ResponseDataMap } from "./protocol";

const DEFAULT_TIMEOUT_MS = 4000;

export async function sendMessageWithTimeout<T extends keyof ResponseDataMap>(
  message: RequestMessage,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ResponseMessage<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (response: ResponseMessage<T>) => {
        clearTimeout(timer);
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

export async function sendRequest<T extends keyof ResponseDataMap>(
  message: RequestMessage,
  timeoutMs?: number
): Promise<ResponseDataMap[T]> {
  const response = await sendMessageWithTimeout<T>(message, timeoutMs);
  if (!response.ok) {
    throw new Error(response.error || "Request failed");
  }
  return response.data;
}

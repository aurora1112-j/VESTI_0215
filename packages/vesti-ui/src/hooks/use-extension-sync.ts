import { useEffect } from "react";
import type { ConversationUpdateChanges } from "../../../../frontend/src/lib/messaging/protocol";

export interface ConversationUpdatedPayload {
  id: number;
  changes: ConversationUpdateChanges;
}

interface ConversationUpdatedMessage {
  type: "CONVERSATION_UPDATED";
  payload: ConversationUpdatedPayload;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isConversationUpdateChanges = (
  value: unknown
): value is ConversationUpdateChanges => {
  if (!isRecord(value)) return false;

  if ("topic_id" in value) {
    const topicId = value.topic_id;
    if (!(typeof topicId === "number" || topicId === null)) {
      return false;
    }
  }

  if ("is_starred" in value) {
    if (typeof value.is_starred !== "boolean") {
      return false;
    }
  }

  return true;
};

const isConversationUpdatedMessage = (
  message: unknown
): message is ConversationUpdatedMessage => {
  if (!isRecord(message) || message.type !== "CONVERSATION_UPDATED") {
    return false;
  }

  const payload = message.payload;
  if (!isRecord(payload)) return false;

  return (
    typeof payload.id === "number" &&
    "changes" in payload &&
    isConversationUpdateChanges(payload.changes)
  );
};

export function useExtensionSync(
  onConversationUpdated: (payload: ConversationUpdatedPayload) => void
) {
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return;
    }

    const handler = (message: unknown) => {
      if (!isConversationUpdatedMessage(message)) return;
      onConversationUpdated(message.payload);
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, [onConversationUpdated]);
}

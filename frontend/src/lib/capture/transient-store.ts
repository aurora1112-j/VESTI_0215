import type { ConversationDraft, ParsedMessage } from "../messaging/protocol";
import { normalizePlatform } from "../platform";
import type { CaptureDecisionMeta, Platform } from "../types";
import { countAiTurns } from "./turn-metrics";

export interface TransientCapturePayload {
  conversation: ConversationDraft;
  messages: ParsedMessage[];
}

export interface TransientCaptureStatusSnapshot {
  available: boolean;
  reason: "ok" | "no_transient";
  platform?: Platform;
  sessionUUID?: string;
  transientKey?: string;
  messageCount?: number;
  turnCount?: number;
  lastDecision?: CaptureDecisionMeta;
  updatedAt?: number;
}

interface TransientCaptureState {
  payload: TransientCapturePayload | null;
  lastDecision?: CaptureDecisionMeta;
  updatedAt?: number;
}

function buildTransientKey(platform: Platform | string, sessionUUID: string): string {
  const canonicalPlatform = normalizePlatform(platform) ?? platform;
  const suffix = sessionUUID.trim() ? sessionUUID.trim() : "pending";
  return `${canonicalPlatform}:${suffix}`;
}

export function createTransientCaptureStore() {
  const state: TransientCaptureState = {
    payload: null,
  };

  return {
    setPayload(payload: TransientCapturePayload) {
      state.payload = {
        conversation: payload.conversation,
        messages: payload.messages,
      };
      state.updatedAt = Date.now();
    },

    setDecision(decision: CaptureDecisionMeta) {
      state.lastDecision = decision;
      state.updatedAt = Date.now();
    },

    getPayload(): TransientCapturePayload | null {
      return state.payload;
    },

    getStatus(): TransientCaptureStatusSnapshot {
      if (!state.payload) {
        return {
          available: false,
          reason: "no_transient",
          lastDecision: state.lastDecision,
          updatedAt: state.updatedAt,
        };
      }

      const { conversation, messages } = state.payload;
      const platform = normalizePlatform(conversation.platform) ?? conversation.platform;
      const sessionUUID = conversation.uuid.trim() || undefined;
      const transientKey = buildTransientKey(platform, conversation.uuid);

      return {
        available: true,
        reason: "ok",
        platform,
        sessionUUID,
        transientKey,
        messageCount: messages.length,
        turnCount: countAiTurns(messages),
        lastDecision: state.lastDecision,
        updatedAt: state.updatedAt,
      };
    },
  };
}

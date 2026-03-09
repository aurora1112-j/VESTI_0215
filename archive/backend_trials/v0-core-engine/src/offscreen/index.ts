import { isRequestMessage } from "../messaging/protocol";
import type { RequestMessage, ResponseMessage } from "../messaging/protocol";
import { deduplicateAndSave } from "../core/middleware/deduplicate";
import {
  listConversations,
  listMessages,
  deleteConversation,
  getDashboardStats,
  getStorageUsage,
  exportAllDataAsJson,
  clearAllData,
  getSummary,
  saveSummary,
  getWeeklyReport,
  saveWeeklyReport,
  listConversationsByRange,
  getConversationById,
} from "../db/repository";
import { getLlmSettings, setLlmSettings } from "../services/llmSettingsService";
import {
  buildSummaryPrompt,
  buildWeeklyPrompt,
  buildWeeklySourceHash,
  callModelScope,
  truncateForContext,
} from "../services/llmService";
import type { LlmConfig } from "../types";
import { logger } from "../utils/logger";

const SUMMARY_MAX_CHARS = 12000;
const WEEKLY_MAX_CHARS = 12000;

function requireSettings(settings: LlmConfig | null): LlmConfig {
  if (!settings) {
    throw new Error("LLM_CONFIG_MISSING");
  }
  if (!settings.apiKey || !settings.modelId || !settings.baseUrl) {
    throw new Error("LLM_CONFIG_MISSING");
  }
  return settings;
}

async function handleRequest(message: RequestMessage): Promise<ResponseMessage> {
  const messageType = message.type;
  try {
    switch (message.type) {
      case "CAPTURE_CONVERSATION": {
        const result = await deduplicateAndSave(
          message.payload.conversation,
          message.payload.messages
        );
        return { ok: true, type: messageType, data: result };
      }
      case "GET_CONVERSATIONS": {
        const data = await listConversations(message.payload);
        return { ok: true, type: messageType, data };
      }
      case "GET_MESSAGES": {
        const data = await listMessages(message.payload.conversationId);
        return { ok: true, type: messageType, data };
      }
      case "DELETE_CONVERSATION": {
        const deleted = await deleteConversation(message.payload.id);
        return { ok: true, type: messageType, data: { deleted } };
      }
      case "GET_DASHBOARD_STATS": {
        const data = await getDashboardStats();
        return { ok: true, type: messageType, data };
      }
      case "GET_STORAGE_USAGE": {
        const data = await getStorageUsage();
        return { ok: true, type: messageType, data };
      }
      case "EXPORT_DATA": {
        const json = await exportAllDataAsJson();
        return { ok: true, type: messageType, data: { json } };
      }
      case "CLEAR_ALL_DATA": {
        const cleared = await clearAllData();
        return { ok: true, type: messageType, data: { cleared } };
      }
      case "GET_LLM_SETTINGS": {
        const settings = await getLlmSettings();
        return { ok: true, type: messageType, data: { settings } };
      }
      case "SET_LLM_SETTINGS": {
        await setLlmSettings(message.payload.settings);
        return { ok: true, type: messageType, data: { saved: true } };
      }
      case "TEST_LLM_CONNECTION": {
        const settings = requireSettings(await getLlmSettings());
        const content = await callModelScope(
          settings,
          "Reply with OK only."
        );
        return {
          ok: true,
          type: messageType,
          data: { ok: true, message: content },
        };
      }
      case "GET_CONVERSATION_SUMMARY": {
        const data = await getSummary(message.payload.conversationId);
        return { ok: true, type: messageType, data };
      }
      case "GENERATE_CONVERSATION_SUMMARY": {
        const settings = requireSettings(await getLlmSettings());
        const conversation = await getConversationById(
          message.payload.conversationId
        );
        if (!conversation) {
          throw new Error("CONVERSATION_NOT_FOUND");
        }
        const messages = await listMessages(message.payload.conversationId);
        const prompt = truncateForContext(
          buildSummaryPrompt(messages, "zh"),
          SUMMARY_MAX_CHARS
        );
        const content = await callModelScope(settings, prompt);
        const record = await saveSummary({
          conversationId: conversation.id,
          content,
          modelId: settings.modelId,
          createdAt: Date.now(),
          sourceUpdatedAt: conversation.updated_at,
        });
        return { ok: true, type: messageType, data: record };
      }
      case "GET_WEEKLY_REPORT": {
        const data = await getWeeklyReport(
          message.payload.rangeStart,
          message.payload.rangeEnd
        );
        return { ok: true, type: messageType, data };
      }
      case "GENERATE_WEEKLY_REPORT": {
        const settings = requireSettings(await getLlmSettings());
        const conversations = await listConversationsByRange(
          message.payload.rangeStart,
          message.payload.rangeEnd
        );
        const sourceHash = buildWeeklySourceHash(
          conversations,
          message.payload.rangeStart,
          message.payload.rangeEnd
        );
        if (conversations.length === 0) {
          const record = await saveWeeklyReport({
            rangeStart: message.payload.rangeStart,
            rangeEnd: message.payload.rangeEnd,
            content: "No conversations found for this range.",
            modelId: settings.modelId,
            createdAt: Date.now(),
            sourceHash,
          });
          return { ok: true, type: messageType, data: record };
        }
        const prompt = truncateForContext(
          buildWeeklyPrompt(conversations, "zh"),
          WEEKLY_MAX_CHARS
        );
        const content = await callModelScope(settings, prompt);
        const record = await saveWeeklyReport({
          rangeStart: message.payload.rangeStart,
          rangeEnd: message.payload.rangeEnd,
          content,
          modelId: settings.modelId,
          createdAt: Date.now(),
          sourceHash,
        });
        return { ok: true, type: messageType, data: record };
      }
      default:
        return {
          ok: false,
          type: messageType,
          error: `Unsupported message type: ${messageType}`,
        };
    }
  } catch (error) {
    logger.error("offscreen", "Request failed", error as Error);
    return {
      ok: false,
      type: messageType,
      error: (error as Error).message || "Unknown error",
    };
  }
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (!isRequestMessage(message)) return;
    if (message.target !== "offscreen") return;

    void (async () => {
      const response = await handleRequest(message);
      sendResponse(response);
    })();

    return true;
  }
);

logger.info("offscreen", "Offscreen handler initialized");





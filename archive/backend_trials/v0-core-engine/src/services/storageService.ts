import type {
  Conversation,
  Message,
  DashboardStats,
  Platform,
  LlmConfig,
  SummaryRecord,
  WeeklyReportRecord,
} from "../types";
import { sendRequest } from "../messaging/runtime";

export async function getConversations(filters?: {
  platform?: Platform;
  search?: string;
  dateRange?: { start: number; end: number };
}): Promise<Conversation[]> {
  return sendRequest({
    type: "GET_CONVERSATIONS",
    target: "offscreen",
    payload: filters,
  }) as Promise<Conversation[]>;
}

export async function getMessages(
  conversationId: number
): Promise<Message[]> {
  return sendRequest({
    type: "GET_MESSAGES",
    target: "offscreen",
    payload: { conversationId },
  }) as Promise<Message[]>;
}

export async function deleteConversation(id: number): Promise<void> {
  await sendRequest({
    type: "DELETE_CONVERSATION",
    target: "offscreen",
    payload: { id },
  });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return sendRequest({
    type: "GET_DASHBOARD_STATS",
    target: "offscreen",
  }) as Promise<DashboardStats>;
}

export async function getStorageUsage(): Promise<{ used: number; total: number }> {
  return sendRequest({
    type: "GET_STORAGE_USAGE",
    target: "offscreen",
  }) as Promise<{ used: number; total: number }>;
}

export async function exportData(format: "json"): Promise<Blob> {
  void format;
  const result = (await sendRequest({
    type: "EXPORT_DATA",
    target: "offscreen",
    payload: { format: "json" },
  })) as { json: string };
  return new Blob([result.json], { type: "application/json" });
}

export async function clearAllData(): Promise<void> {
  await sendRequest({
    type: "CLEAR_ALL_DATA",
    target: "offscreen",
  });
}

export async function getLlmSettings(): Promise<LlmConfig | null> {
  const result = (await sendRequest({
    type: "GET_LLM_SETTINGS",
    target: "offscreen",
  })) as { settings: LlmConfig | null };
  return result.settings;
}

export async function setLlmSettings(settings: LlmConfig): Promise<void> {
  await sendRequest({
    type: "SET_LLM_SETTINGS",
    target: "offscreen",
    payload: { settings },
  });
}

export async function testLlmConnection(): Promise<{ ok: boolean; message?: string }> {
  return sendRequest({
    type: "TEST_LLM_CONNECTION",
    target: "offscreen",
  }) as Promise<{ ok: boolean; message?: string }>;
}

export async function getConversationSummary(
  conversationId: number
): Promise<SummaryRecord | null> {
  return sendRequest({
    type: "GET_CONVERSATION_SUMMARY",
    target: "offscreen",
    payload: { conversationId },
  }) as Promise<SummaryRecord | null>;
}

export async function generateConversationSummary(
  conversationId: number
): Promise<SummaryRecord> {
  return sendRequest({
    type: "GENERATE_CONVERSATION_SUMMARY",
    target: "offscreen",
    payload: { conversationId },
  }) as Promise<SummaryRecord>;
}

export async function getWeeklyReport(
  rangeStart: number,
  rangeEnd: number
): Promise<WeeklyReportRecord | null> {
  return sendRequest({
    type: "GET_WEEKLY_REPORT",
    target: "offscreen",
    payload: { rangeStart, rangeEnd },
  }) as Promise<WeeklyReportRecord | null>;
}

export async function generateWeeklyReport(
  rangeStart: number,
  rangeEnd: number
): Promise<WeeklyReportRecord> {
  return sendRequest({
    type: "GENERATE_WEEKLY_REPORT",
    target: "offscreen",
    payload: { rangeStart, rangeEnd },
  }) as Promise<WeeklyReportRecord>;
}


import type {
  Conversation,
  Message,
  DashboardStats,
  Platform,
  LlmConfig,
  SummaryRecord,
  WeeklyReportRecord,
} from "../types";

export interface DateRange {
  start: number;
  end: number;
}

export interface ConversationFilters {
  platform?: Platform;
  search?: string;
  dateRange?: DateRange;
}

export interface ConversationDraft {
  uuid: string;
  platform: Platform;
  title: string;
  snippet: string;
  url: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  is_archived: boolean;
  is_trash: boolean;
  tags: string[];
}

export interface ParsedMessage {
  role: "user" | "ai";
  textContent: string;
  htmlContent?: string;
  timestamp?: number;
}

export type RequestMessage =
  | {
      type: "CAPTURE_CONVERSATION";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { conversation: ConversationDraft; messages: ParsedMessage[] };
    }
  | {
      type: "GET_CONVERSATIONS";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload?: ConversationFilters;
    }
  | {
      type: "GET_MESSAGES";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { conversationId: number };
    }
  | {
      type: "DELETE_CONVERSATION";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { id: number };
    }
  | {
      type: "GET_DASHBOARD_STATS";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
    }
  | {
      type: "GET_STORAGE_USAGE";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
    }
  | {
      type: "EXPORT_DATA";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { format: "json" };
    }
  | {
      type: "CLEAR_ALL_DATA";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
    }
  | {
      type: "GET_LLM_SETTINGS";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
    }
  | {
      type: "SET_LLM_SETTINGS";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { settings: LlmConfig };
    }
  | {
      type: "TEST_LLM_CONNECTION";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
    }
  | {
      type: "GET_CONVERSATION_SUMMARY";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { conversationId: number };
    }
  | {
      type: "GENERATE_CONVERSATION_SUMMARY";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { conversationId: number };
    }
  | {
      type: "GET_WEEKLY_REPORT";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { rangeStart: number; rangeEnd: number };
    }
  | {
      type: "GENERATE_WEEKLY_REPORT";
      target?: "offscreen";
      via?: "background";
      requestId?: string;
      payload: { rangeStart: number; rangeEnd: number };
    };

export type ResponseDataMap = {
  CAPTURE_CONVERSATION: { saved: boolean; newMessages: number; conversationId?: number };
  GET_CONVERSATIONS: Conversation[];
  GET_MESSAGES: Message[];
  DELETE_CONVERSATION: { deleted: boolean };
  GET_DASHBOARD_STATS: DashboardStats;
  GET_STORAGE_USAGE: { used: number; total: number };
  EXPORT_DATA: { json: string };
  CLEAR_ALL_DATA: { cleared: boolean };
  GET_LLM_SETTINGS: { settings: LlmConfig | null };
  SET_LLM_SETTINGS: { saved: boolean };
  TEST_LLM_CONNECTION: { ok: boolean; message?: string };
  GET_CONVERSATION_SUMMARY: SummaryRecord | null;
  GENERATE_CONVERSATION_SUMMARY: SummaryRecord;
  GET_WEEKLY_REPORT: WeeklyReportRecord | null;
  GENERATE_WEEKLY_REPORT: WeeklyReportRecord;
};

export type ResponseMessage<T extends keyof ResponseDataMap = keyof ResponseDataMap> =
  | {
      ok: true;
      type: T;
      requestId?: string;
      data: ResponseDataMap[T];
    }
  | {
      ok: false;
      type: T;
      requestId?: string;
      error: string;
    };

export function isRequestMessage(value: unknown): value is RequestMessage {
  if (!value || typeof value !== "object") return false;
  const msg = value as { type?: unknown };
  return typeof msg.type === "string";
}

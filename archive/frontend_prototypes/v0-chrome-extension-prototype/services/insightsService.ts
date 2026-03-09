import type {
  Conversation,
  LlmConfig,
  SummaryRecord,
  WeeklyReportRecord,
} from "@/types";
import { MOCK_CONVERSATIONS } from "@/data/mockData";

const STORAGE_KEY = "vesti_llm_settings";
const DEFAULT_BASE_URL = "https://api-inference.modelscope.cn/v1/";

const memoryCache = {
  summaries: new Map<number, SummaryRecord>(),
  weeklyReports: new Map<string, WeeklyReportRecord>(),
  settings: null as LlmConfig | null,
};

type RuntimeLike = {
  sendMessage: (message: unknown, callback: (response: any) => void) => void;
  lastError?: { message: string };
};

function getRuntime(): RuntimeLike | null {
  const runtime = (globalThis as { chrome?: { runtime?: RuntimeLike } }).chrome
    ?.runtime;
  if (!runtime?.sendMessage) return null;
  return runtime;
}

async function sendRequest<T>(message: unknown): Promise<T> {
  const runtime = getRuntime();
  if (!runtime) {
    throw new Error("CHROME_RUNTIME_UNAVAILABLE");
  }
  return new Promise((resolve, reject) => {
    runtime.sendMessage(message, (response: { ok: boolean; error?: string; data?: T }) => {
      const err = runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Request failed"));
        return;
      }
      resolve(response.data as T);
    });
  });
}

function readLocalSettings(): LlmConfig | null {
  if (typeof window === "undefined") return memoryCache.settings;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return memoryCache.settings;
  try {
    const parsed = JSON.parse(raw) as LlmConfig;
    memoryCache.settings = parsed;
    return parsed;
  } catch {
    return memoryCache.settings;
  }
}

function writeLocalSettings(settings: LlmConfig): void {
  memoryCache.settings = settings;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function requireLocalSettings(): LlmConfig {
  const settings = readLocalSettings();
  if (!settings?.apiKey || !settings?.modelId || !settings?.baseUrl) {
    throw new Error("请先在设置中配置 ModelScope API Key 与模型 ID。");
  }
  return settings;
}

function buildMockSummary(conversation: Conversation): string {
  return [
    `- 主题：${conversation.title}`,
    `- 核心片段：${conversation.snippet}`,
    `- 对话轮数：${conversation.message_count} 轮`,
  ].join("\n");
}

function buildMockWeeklyReport(conversations: Conversation[]): string {
  const total = conversations.length;
  const titles = conversations.slice(0, 5).map((c) => `- ${c.title}`);
  return [
    `- 本周共记录 ${total} 条对话`,
    "- 高频主题：",
    ...titles,
    "- 建议：优先回顾高价值对话，并整理行动项",
  ].join("\n");
}

export async function getLlmSettings(): Promise<LlmConfig | null> {
  try {
    const result = await sendRequest<{ settings: LlmConfig | null }>({
      type: "GET_LLM_SETTINGS",
      target: "offscreen",
    });
    return result.settings;
  } catch {
    return readLocalSettings();
  }
}

export async function setLlmSettings(settings: LlmConfig): Promise<void> {
  try {
    await sendRequest({
      type: "SET_LLM_SETTINGS",
      target: "offscreen",
      payload: { settings },
    });
  } catch {
    writeLocalSettings(settings);
  }
}

export async function testLlmConnection(): Promise<{ ok: boolean; message?: string }> {
  try {
    return await sendRequest({
      type: "TEST_LLM_CONNECTION",
      target: "offscreen",
    });
  } catch (error) {
    const settings = requireLocalSettings();
    void settings;
    return { ok: true, message: "Mock: OK" };
  }
}

export async function getConversationSummary(
  conversationId: number
): Promise<SummaryRecord | null> {
  try {
    return await sendRequest({
      type: "GET_CONVERSATION_SUMMARY",
      target: "offscreen",
      payload: { conversationId },
    });
  } catch {
    return memoryCache.summaries.get(conversationId) ?? null;
  }
}

export async function generateConversationSummary(
  conversationId: number
): Promise<SummaryRecord> {
  try {
    return await sendRequest({
      type: "GENERATE_CONVERSATION_SUMMARY",
      target: "offscreen",
      payload: { conversationId },
    });
  } catch {
    const settings = requireLocalSettings();
    const conversation = MOCK_CONVERSATIONS.find((c) => c.id === conversationId);
    if (!conversation) {
      throw new Error("未找到对应对话");
    }
    const record: SummaryRecord = {
      id: Date.now(),
      conversationId,
      content: buildMockSummary(conversation),
      modelId: settings.modelId || "mock-model",
      createdAt: Date.now(),
      sourceUpdatedAt: conversation.updated_at,
    };
    memoryCache.summaries.set(conversationId, record);
    return record;
  }
}

export async function getWeeklyReport(
  rangeStart: number,
  rangeEnd: number
): Promise<WeeklyReportRecord | null> {
  const key = `${rangeStart}-${rangeEnd}`;
  try {
    return await sendRequest({
      type: "GET_WEEKLY_REPORT",
      target: "offscreen",
      payload: { rangeStart, rangeEnd },
    });
  } catch {
    return memoryCache.weeklyReports.get(key) ?? null;
  }
}

export async function generateWeeklyReport(
  rangeStart: number,
  rangeEnd: number
): Promise<WeeklyReportRecord> {
  const key = `${rangeStart}-${rangeEnd}`;
  try {
    return await sendRequest({
      type: "GENERATE_WEEKLY_REPORT",
      target: "offscreen",
      payload: { rangeStart, rangeEnd },
    });
  } catch {
    const settings = requireLocalSettings();
    const conversations = MOCK_CONVERSATIONS.filter(
      (c) => c.created_at >= rangeStart && c.created_at <= rangeEnd
    );
    const record: WeeklyReportRecord = {
      id: Date.now(),
      rangeStart,
      rangeEnd,
      content: buildMockWeeklyReport(conversations),
      modelId: settings.modelId || "mock-model",
      createdAt: Date.now(),
      sourceHash: `${rangeStart}-${rangeEnd}-${conversations.length}`,
    };
    memoryCache.weeklyReports.set(key, record);
    return record;
  }
}

export function getDefaultLlmSettings(): LlmConfig {
  return {
    provider: "modelscope",
    baseUrl: DEFAULT_BASE_URL,
    apiKey: "",
    modelId: "",
    temperature: 0.3,
    maxTokens: 800,
    updatedAt: Date.now(),
  };
}

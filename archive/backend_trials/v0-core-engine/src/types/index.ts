// ============================================================
// --- types/index.ts ---
// All interface definitions for Vesti (kept in sync with frontend)
// ============================================================

export type Platform = "ChatGPT" | "Claude" | "Gemini" | "DeepSeek";

export interface Conversation {
  id: number;
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

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "ai";
  content_text: string;
  created_at: number;
}

export interface DashboardStats {
  totalConversations: number;
  totalTokens: number;
  activeStreak: number;
  todayCount: number;
  platformDistribution: Record<Platform, number>;
  heatmapData: { date: string; count: number }[];
}

export type CapsuleState = "RECORDING" | "STANDBY" | "PAUSED" | "SAVED";

export type CaptureMode = "full_mirror" | "smart_denoise" | "curator";

export type PageId = "timeline" | "dashboard" | "settings";

export type LlmProvider = "modelscope";

export interface LlmConfig {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  updatedAt: number;
}

export interface SummaryRecord {
  id: number;
  conversationId: number;
  content: string;
  modelId: string;
  createdAt: number;
  sourceUpdatedAt: number;
}

export interface WeeklyReportRecord {
  id: number;
  rangeStart: number;
  rangeEnd: number;
  content: string;
  modelId: string;
  createdAt: number;
  sourceHash: string;
}

export type InsightStatus = "idle" | "loading" | "ready" | "error";


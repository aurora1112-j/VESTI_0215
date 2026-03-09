// ============================================================
// --- services/mockService.ts ---
// Service Layer — the ONLY data access point for all UI components.
// Production: replace internals with Dexie.js / IndexedDB calls.
// UI components import ONLY from this module.
// ============================================================

import type {
  Conversation,
  Message,
  Platform,
  DashboardStats,
} from "@/types";
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from "@/data/mockData";

// --- Helpers ---
function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function generateMockHeatmap(
  days: number
): { date: string; count: number }[] {
  const data: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toISOString().split("T")[0],
      count: Math.random() > 0.3 ? Math.floor(Math.random() * 8) : 0,
    });
  }
  return data;
}

/**
 * Fetch conversation list with optional filters.
 * Production: db.conversations.orderBy('updated_at').reverse().toArray()
 */
export async function getConversations(filters?: {
  platform?: Platform;
  search?: string;
  dateRange?: { start: number; end: number };
}): Promise<Conversation[]> {
  await delay(150);
  let results = [...MOCK_CONVERSATIONS];
  if (filters?.platform) {
    results = results.filter((c) => c.platform === filters.platform);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.snippet.toLowerCase().includes(q)
    );
  }
  return results.sort((a, b) => b.updated_at - a.updated_at);
}

/**
 * Fetch messages for a single conversation.
 * Production: db.messages.where('conversation_id').equals(id).sortBy('created_at')
 */
export async function getMessages(
  conversationId: number
): Promise<Message[]> {
  await delay(100);
  return MOCK_MESSAGES.filter(
    (m) => m.conversation_id === conversationId
  ).sort((a, b) => a.created_at - b.created_at);
}

/**
 * Delete a conversation.
 * Production: db.conversations.delete(id)
 */
export async function deleteConversation(id: number): Promise<void> {
  await delay(100);
  console.log(`[Mock] Deleted conversation ${id}`);
}

/**
 * Fetch dashboard statistics.
 * Production: aggregate queries on db.conversations
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  await delay(200);
  return {
    totalConversations: MOCK_CONVERSATIONS.length,
    totalTokens: 1_283_400,
    activeStreak: 7,
    todayCount: 3,
    platformDistribution: {
      ChatGPT: 45,
      Claude: 30,
      Gemini: 15,
      DeepSeek: 10,
    },
    heatmapData: generateMockHeatmap(364),
  };
}

/**
 * Get storage usage info.
 * Production: navigator.storage.estimate()
 */
export async function getStorageUsage(): Promise<{
  used: number;
  total: number;
}> {
  await delay(50);
  return { used: 312_000, total: 5_000_000_000 };
}

/**
 * Export all data as JSON blob.
 */
export async function exportData(format: "json"): Promise<Blob> {
  await delay(300);
  void format;
  const data = JSON.stringify(MOCK_CONVERSATIONS, null, 2);
  return new Blob([data], { type: "application/json" });
}

/**
 * Clear all stored data.
 * Production: db.delete()
 */
export async function clearAllData(): Promise<void> {
  await delay(200);
  console.log("[Mock] All data cleared");
}

import type {
  Conversation,
  Message,
  DashboardStats,
  Platform,
  SummaryRecord,
  WeeklyReportRecord,
} from "../types";
import type { ConversationFilters } from "../messaging/protocol";
import {
  db,
  ConversationRecord,
  MessageRecord,
  SummaryRecordRecord,
  WeeklyReportRecordRecord,
} from "./schema";

function toConversation(record: ConversationRecord): Conversation {
  if (record.id === undefined) {
    throw new Error("Conversation record missing id");
  }
  return record as Conversation;
}

function toMessage(record: MessageRecord): Message {
  if (record.id === undefined) {
    throw new Error("Message record missing id");
  }
  return record as Message;
}

function toSummary(record: SummaryRecordRecord): SummaryRecord {
  if (record.id === undefined) {
    throw new Error("Summary record missing id");
  }
  return record as SummaryRecord;
}

function toWeeklyReport(record: WeeklyReportRecordRecord): WeeklyReportRecord {
  if (record.id === undefined) {
    throw new Error("Weekly report record missing id");
  }
  return record as WeeklyReportRecord;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function initPlatformDistribution(): Record<Platform, number> {
  return {
    ChatGPT: 0,
    Claude: 0,
    Gemini: 0,
    DeepSeek: 0,
  };
}

export async function listConversations(
  filters?: ConversationFilters
): Promise<Conversation[]> {
  let results: ConversationRecord[];

  if (filters?.platform) {
    results = await db.conversations
      .where("platform")
      .equals(filters.platform)
      .toArray();
  } else {
    results = await db.conversations.toArray();
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.snippet.toLowerCase().includes(q)
    );
  }

  if (filters?.dateRange) {
    results = results.filter(
      (c) =>
        c.created_at >= filters.dateRange!.start &&
        c.created_at <= filters.dateRange!.end
    );
  }

  return results
    .sort((a, b) => b.updated_at - a.updated_at)
    .map(toConversation);
}

export async function getConversationById(id: number): Promise<Conversation | null> {
  const record = await db.conversations.get(id);
  return record ? toConversation(record) : null;
}

export async function listConversationsByRange(
  rangeStart: number,
  rangeEnd: number
): Promise<Conversation[]> {
  const records = await db.conversations
    .where("created_at")
    .between(rangeStart, rangeEnd, true, true)
    .toArray();
  return records
    .sort((a, b) => b.updated_at - a.updated_at)
    .map(toConversation);
}

export async function listMessages(
  conversationId: number
): Promise<Message[]> {
  const records = await db.messages
    .where("conversation_id")
    .equals(conversationId)
    .sortBy("created_at");

  return records.map(toMessage);
}

export async function deleteConversation(id: number): Promise<boolean> {
  await db.transaction("rw", db.conversations, db.messages, async () => {
    await db.messages.where("conversation_id").equals(id).delete();
    await db.conversations.delete(id);
  });
  return true;
}

export async function clearAllData(): Promise<boolean> {
  await db.transaction("rw", db.conversations, db.messages, async () => {
    await db.messages.clear();
    await db.conversations.clear();
  });
  return true;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const conversations = await db.conversations.toArray();
  const distribution = initPlatformDistribution();

  for (const c of conversations) {
    distribution[c.platform] += 1;
  }

  const today = dayKey(Date.now());
  const todayCount = conversations.filter(
    (c) => dayKey(c.created_at) === today
  ).length;

  const daysWithConversations = new Set(
    conversations.map((c) => dayKey(c.created_at))
  );

  let activeStreak = 0;
  let cursor = new Date();
  while (daysWithConversations.has(dayKey(cursor.getTime()))) {
    activeStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const heatmapData = Array.from(daysWithConversations).map((d) => ({
    date: d,
    count: conversations.filter((c) => dayKey(c.created_at) === d).length,
  }));

  return {
    totalConversations: conversations.length,
    totalTokens: 0,
    activeStreak,
    todayCount,
    platformDistribution: distribution,
    heatmapData,
  };
}

export async function getStorageUsage(): Promise<{ used: number; total: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage ?? 0,
      total: estimate.quota ?? 0,
    };
  }
  return { used: 0, total: 0 };
}

export async function exportAllDataAsJson(): Promise<string> {
  const conversations = (await db.conversations.toArray()).map(toConversation);
  const messages = (await db.messages.toArray()).map(toMessage);
  const summaries = (await db.summaries.toArray()).map(toSummary);
  const weeklyReports = (await db.weekly_reports.toArray()).map(toWeeklyReport);
  return JSON.stringify(
    { conversations, messages, summaries, weeklyReports },
    null,
    2
  );
}

export async function getSummary(
  conversationId: number
): Promise<SummaryRecord | null> {
  const record = await db.summaries
    .where("conversationId")
    .equals(conversationId)
    .last();
  return record ? toSummary(record) : null;
}

export async function saveSummary(
  record: Omit<SummaryRecord, "id">
): Promise<SummaryRecord> {
  const existing = await db.summaries
    .where("conversationId")
    .equals(record.conversationId)
    .first();

  if (existing?.id !== undefined) {
    await db.summaries.update(existing.id, record);
    return toSummary({ ...existing, ...record, id: existing.id });
  }

  const id = await db.summaries.add(record);
  return toSummary({ ...record, id });
}

export async function getWeeklyReport(
  rangeStart: number,
  rangeEnd: number
): Promise<WeeklyReportRecord | null> {
  const record = await db.weekly_reports
    .where("rangeStart")
    .equals(rangeStart)
    .and((item) => item.rangeEnd === rangeEnd)
    .first();
  return record ? toWeeklyReport(record) : null;
}

export async function saveWeeklyReport(
  record: Omit<WeeklyReportRecord, "id">
): Promise<WeeklyReportRecord> {
  const existing = await db.weekly_reports
    .where("rangeStart")
    .equals(record.rangeStart)
    .and((item) => item.rangeEnd === record.rangeEnd)
    .first();

  if (existing?.id !== undefined) {
    await db.weekly_reports.update(existing.id, record);
    return toWeeklyReport({ ...existing, ...record, id: existing.id });
  }

  const id = await db.weekly_reports.add(record);
  return toWeeklyReport({ ...record, id });
}

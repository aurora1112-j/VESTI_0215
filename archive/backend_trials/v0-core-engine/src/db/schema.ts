import Dexie, { Table } from "dexie";
import type {
  Conversation,
  Message,
  SummaryRecord,
  WeeklyReportRecord,
} from "../types";

export type ConversationRecord = Omit<Conversation, "id"> & { id?: number };
export type MessageRecord = Omit<Message, "id"> & { id?: number };
export type SummaryRecordRecord = Omit<SummaryRecord, "id"> & { id?: number };
export type WeeklyReportRecordRecord = Omit<WeeklyReportRecord, "id"> & { id?: number };

export class MemoryHubDB extends Dexie {
  conversations!: Table<ConversationRecord, number>;
  messages!: Table<MessageRecord, number>;
  summaries!: Table<SummaryRecordRecord, number>;
  weekly_reports!: Table<WeeklyReportRecordRecord, number>;

  constructor() {
    super("MemoryHubDB");
    this.version(1).stores({
      conversations:
        "++id, platform, title, created_at, updated_at, uuid, [platform+created_at]",
      messages:
        "++id, conversation_id, role, created_at, [conversation_id+created_at]",
    });
    this.version(2).stores({
      conversations:
        "++id, platform, title, created_at, updated_at, uuid, [platform+created_at]",
      messages:
        "++id, conversation_id, role, created_at, [conversation_id+created_at]",
      summaries: "++id, conversationId, createdAt",
      weekly_reports: "++id, rangeStart, rangeEnd, createdAt",
    });
  }
}

export const db = new MemoryHubDB();

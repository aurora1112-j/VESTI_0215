import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/schema";
import { deduplicateAndSave } from "../../src/core/middleware/deduplicate";
import type { ConversationDraft, ParsedMessage } from "../../src/messaging/protocol";

const baseConversation: ConversationDraft = {
  uuid: "conv-1",
  platform: "ChatGPT",
  title: "Test",
  snippet: "Hello",
  url: "https://chatgpt.com/c/conv-1",
  created_at: 1,
  updated_at: 1,
  message_count: 2,
  is_archived: false,
  is_trash: false,
  tags: [],
};

const baseMessages: ParsedMessage[] = [
  { role: "user", textContent: "hi" },
  { role: "ai", textContent: "hello" },
];

beforeEach(async () => {
  await db.messages.clear();
  await db.conversations.clear();
});

describe("deduplicateAndSave", () => {
  it("creates new conversation on first save", async () => {
    const result = await deduplicateAndSave(baseConversation, baseMessages);
    expect(result.saved).toBe(true);
    expect(result.newMessages).toBe(2);

    const convs = await db.conversations.toArray();
    const msgs = await db.messages.toArray();
    expect(convs.length).toBe(1);
    expect(msgs.length).toBe(2);
  });

  it("skips save when no new messages", async () => {
    await deduplicateAndSave(baseConversation, baseMessages);
    const result = await deduplicateAndSave(baseConversation, baseMessages);
    expect(result.saved).toBe(false);
    expect(result.newMessages).toBe(0);
  });

  it("appends new messages when message_count increases", async () => {
    await deduplicateAndSave(baseConversation, baseMessages);

    const updatedConversation: ConversationDraft = {
      ...baseConversation,
      message_count: 3,
      updated_at: 2,
      snippet: "Hello updated",
    };

    const updatedMessages: ParsedMessage[] = [
      ...baseMessages,
      { role: "ai", textContent: "new message" },
    ];

    const result = await deduplicateAndSave(
      updatedConversation,
      updatedMessages
    );

    expect(result.saved).toBe(true);
    expect(result.newMessages).toBe(1);

    const msgs = await db.messages.toArray();
    expect(msgs.length).toBe(3);
  });
});

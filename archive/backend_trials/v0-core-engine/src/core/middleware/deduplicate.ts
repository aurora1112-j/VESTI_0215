import type { ConversationDraft, ParsedMessage } from "../../messaging/protocol";
import { db } from "../../db/schema";
import type { ConversationRecord, MessageRecord } from "../../db/schema";

export async function deduplicateAndSave(
  conversation: ConversationDraft,
  messages: ParsedMessage[]
): Promise<{ saved: boolean; newMessages: number; conversationId?: number }> {
  return db.transaction("rw", db.conversations, db.messages, async () => {
    const existing = await db.conversations
      .where("uuid")
      .equals(conversation.uuid)
      .first();

    if (existing && existing.id !== undefined) {
      if (conversation.message_count <= existing.message_count) {
        return { saved: false, newMessages: 0, conversationId: existing.id };
      }

      const newCount = conversation.message_count - existing.message_count;
      const newMessages = messages.slice(-newCount);

      await db.conversations.update(existing.id, {
        updated_at: conversation.updated_at,
        message_count: conversation.message_count,
        snippet: conversation.snippet,
      } as Partial<ConversationRecord>);

      const inserts: MessageRecord[] = newMessages.map((m) => ({
        conversation_id: existing.id!,
        role: m.role,
        content_text: m.textContent,
        created_at: m.timestamp ?? Date.now(),
      }));

      await db.messages.bulkAdd(inserts);

      return {
        saved: true,
        newMessages: newMessages.length,
        conversationId: existing.id,
      };
    }

    const record: ConversationRecord = { ...conversation };
    const conversationId = await db.conversations.add(record);

    const inserts: MessageRecord[] = messages.map((m) => ({
      conversation_id: conversationId,
      role: m.role,
      content_text: m.textContent,
      created_at: m.timestamp ?? Date.now(),
    }));

    await db.messages.bulkAdd(inserts);

    return { saved: true, newMessages: messages.length, conversationId };
  });
}

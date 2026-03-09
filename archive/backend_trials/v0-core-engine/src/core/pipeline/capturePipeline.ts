import type { IParser, ParsedMessage } from "../parser/IParser";
import type { ConversationDraft } from "../../messaging/protocol";
import { logger } from "../../utils/logger";

export type CaptureSender = (payload: {
  conversation: ConversationDraft;
  messages: ParsedMessage[];
}) => Promise<void>;

export class CapturePipeline {
  private parser: IParser;
  private sender: CaptureSender;

  constructor(parser: IParser, sender: CaptureSender) {
    this.parser = parser;
    this.sender = sender;
  }

  async capture(): Promise<void> {
    try {
      const platform = this.parser.detect();
      if (!platform) return;

      const messages = this.parser.getMessages();
      if (messages.length === 0) return;

      const now = Date.now();
      const conversation: ConversationDraft = {
        uuid: this.parser.getSessionUUID(),
        platform,
        title: this.parser.getConversationTitle(),
        snippet: messages[0]?.textContent.slice(0, 100) || "",
        url: window.location.href,
        created_at: now,
        updated_at: now,
        message_count: messages.length,
        is_archived: false,
        is_trash: false,
        tags: [],
      };

      await this.sender({ conversation, messages });
      logger.info("capture", "Captured conversation", {
        platform,
        messageCount: messages.length,
      });
    } catch (error) {
      logger.error("capture", "Capture failed", error as Error);
    }
  }
}

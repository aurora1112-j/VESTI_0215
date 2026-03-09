import type { IParser, ParsedMessage } from "../IParser";
import type { Platform } from "../../../types";
import {
  queryAll,
  queryFirst,
  queryFirstWithin,
  hasAnySelector,
  safeTextContent,
} from "../shared/selectorUtils";

const SELECTORS = {
  messageBlocks: [
    "[data-testid^=\"conversation-turn\"]",
    "[data-message-id]",
    "[data-message-author-role]",
  ],
  userRole: ["[data-message-author-role=\"user\"]"],
  assistantRole: ["[data-message-author-role=\"assistant\"]"],
  messageContent: [
    ".markdown",
    "[data-message-author-role] .markdown",
    "div[class*='markdown']",
    "div[class*='message']",
  ],
  title: ["nav h1", "title"],
  generating: [
    ".result-streaming",
    "[data-testid=\"result-streaming\"]",
    ".typing",
    "[data-is-streaming=\"true\"]",
  ],
};

export class ChatGPTParser implements IParser {
  detect(): Platform | null {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
      return "ChatGPT";
    }
    return null;
  }

  getConversationTitle(): string {
    const titleEl = queryFirst(SELECTORS.title);
    const title = safeTextContent(titleEl);
    if (title) return title;
    return document.title || "Untitled Conversation";
  }

  getMessages(): ParsedMessage[] {
    const nodes = queryAll(SELECTORS.messageBlocks);
    return nodes.map((node) => this.parseMessageNode(node));
  }

  isGenerating(): boolean {
    return queryFirst(SELECTORS.generating) !== null;
  }

  getSessionUUID(): string {
    const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    if (match && match[1]) return match[1];
    return `chatgpt-${Date.now()}`;
  }

  private parseMessageNode(node: Element): ParsedMessage {
    const isUser = hasAnySelector(node, SELECTORS.userRole);
    const isAssistant = hasAnySelector(node, SELECTORS.assistantRole);
    const role = isUser && !isAssistant ? "user" : "ai";

    const contentEl = queryFirstWithin(node, SELECTORS.messageContent);
    const textContent = safeTextContent(contentEl || node);

    return {
      role,
      textContent,
      htmlContent: contentEl ? contentEl.innerHTML : undefined,
    };
  }
}

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
    "[data-testid*=\"message\"]",
    "[data-testid^=\"message\"]",
    "div[class*='message']",
    "div[class*='chat-message']",
  ],
  userRole: [
    "[data-message-author-role=\"user\"]",
    "[data-author=\"user\"]",
    "[data-testid*=\"user\"]",
    ".user",
    ".human",
  ],
  assistantRole: [
    "[data-message-author-role=\"assistant\"]",
    "[data-author=\"assistant\"]",
    "[data-testid*=\"assistant\"]",
    ".assistant",
    ".ai",
  ],
  messageContent: [
    "[data-testid*=\"message-content\"]",
    ".prose",
    ".markdown",
    "div[class*='content']",
  ],
  title: ["nav h1", "h1", "title"],
  generating: [
    "[data-is-streaming=\"true\"]",
    "[data-testid*=\"stream\"]",
    ".typing",
    ".cursor",
  ],
};

export class ClaudeParser implements IParser {
  detect(): Platform | null {
    const host = window.location.hostname;
    if (host.includes("claude.ai")) {
      return "Claude";
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
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);
    if (match && match[1]) return match[1];
    return `claude-${Date.now()}`;
  }

  private parseMessageNode(node: Element): ParsedMessage {
    const hasUser = hasAnySelector(node, SELECTORS.userRole);
    const hasAssistant = hasAnySelector(node, SELECTORS.assistantRole);
    let role: "user" | "ai" = "ai";

    if (hasUser && !hasAssistant) role = "user";
    if (hasAssistant && !hasUser) role = "ai";

    const contentEl = queryFirstWithin(node, SELECTORS.messageContent);
    const textContent = safeTextContent(contentEl || node);

    return {
      role,
      textContent,
      htmlContent: contentEl ? contentEl.innerHTML : undefined,
    };
  }
}

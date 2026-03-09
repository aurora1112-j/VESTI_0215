import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, it, expect } from "vitest";
import { ClaudeParser } from "../../src/core/parser/claude/ClaudeParser";

function loadFixture(url: string, filename: string) {
  const html = readFileSync(resolve(__dirname, "fixtures", filename), "utf-8");
  const dom = new JSDOM(html, { url });
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).MutationObserver = dom.window.MutationObserver;
}

describe("ClaudeParser", () => {
  it("parses messages and session id", () => {
    loadFixture("https://claude.ai/chat/def456", "claude-message.html");

    const parser = new ClaudeParser();
    expect(parser.detect()).toBe("Claude");
    expect(parser.getSessionUUID()).toBe("def456");

    const messages = parser.getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].textContent).toBe("User message");
    expect(messages[1].role).toBe("ai");
    expect(messages[1].textContent).toBe("Assistant message");
  });
});

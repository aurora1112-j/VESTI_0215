import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, it, expect } from "vitest";
import { ChatGPTParser } from "../../src/core/parser/chatgpt/ChatGPTParser";

function loadFixture(url: string, filename: string) {
  const html = readFileSync(resolve(__dirname, "fixtures", filename), "utf-8");
  const dom = new JSDOM(html, { url });
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).MutationObserver = dom.window.MutationObserver;
}

describe("ChatGPTParser", () => {
  it("parses messages and session id", () => {
    loadFixture("https://chatgpt.com/c/abc123", "chatgpt-message.html");

    const parser = new ChatGPTParser();
    expect(parser.detect()).toBe("ChatGPT");
    expect(parser.getSessionUUID()).toBe("abc123");

    const messages = parser.getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].textContent).toBe("Hello from user");
    expect(messages[1].role).toBe("ai");
    expect(messages[1].textContent).toBe("Hello from assistant");
  });
});

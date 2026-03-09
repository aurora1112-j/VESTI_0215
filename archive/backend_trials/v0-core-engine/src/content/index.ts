import { ChatGPTParser } from "../core/parser/chatgpt/ChatGPTParser";
import { ClaudeParser } from "../core/parser/claude/ClaudeParser";
import type { IParser } from "../core/parser/IParser";
import { ConversationObserver } from "../core/observer/ConversationObserver";
import { CapturePipeline } from "../core/pipeline/capturePipeline";
import { sendRequest } from "../messaging/runtime";
import { logger } from "../utils/logger";

function selectParser(): IParser | null {
  const chatgpt = new ChatGPTParser();
  if (chatgpt.detect()) return chatgpt;

  const claude = new ClaudeParser();
  if (claude.detect()) return claude;

  return null;
}

const parser = selectParser();
if (!parser) {
  logger.info("content", "No supported platform detected");
} else {
  const pipeline = new CapturePipeline(parser, async (payload) => {
    await sendRequest({
      type: "CAPTURE_CONVERSATION",
      target: "offscreen",
      payload,
    });
  });

  const observer = new ConversationObserver(parser, pipeline);
  observer.start();
}

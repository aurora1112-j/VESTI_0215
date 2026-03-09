import type { IParser } from "../parser/IParser";
import { CapturePipeline } from "../pipeline/capturePipeline";
import { logger } from "../../utils/logger";

export class ConversationObserver {
  private debounceTimer: number | null = null;
  private observer: MutationObserver | null = null;
  private parser: IParser;
  private pipeline: CapturePipeline;

  constructor(parser: IParser, pipeline: CapturePipeline) {
    this.parser = parser;
    this.pipeline = pipeline;
  }

  start(): void {
    if (this.observer) return;

    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) {
        window.clearTimeout(this.debounceTimer);
      }

      const delay = this.parser.isGenerating() ? 2000 : 500;
      this.debounceTimer = window.setTimeout(() => {
        void this.pipeline.capture();
      }, delay);
    });

    const targetNode = document.querySelector("main") || document.body;
    if (!targetNode) {
      logger.warn("observer", "No target node found; observer not started");
      return;
    }

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    logger.info("observer", "MutationObserver started");
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

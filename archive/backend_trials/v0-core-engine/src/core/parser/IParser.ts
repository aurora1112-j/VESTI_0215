import type { Platform } from "../../types";

export interface ParsedMessage {
  role: "user" | "ai";
  textContent: string;
  htmlContent?: string;
  timestamp?: number;
}

export interface IParser {
  detect(): Platform | null;
  getConversationTitle(): string;
  getMessages(): ParsedMessage[];
  isGenerating(): boolean;
  getSessionUUID(): string;
}

type LogScope =
  | "observer"
  | "parser"
  | "capture"
  | "db"
  | "offscreen"
  | "background"
  | "content"
  | "service"
  | "llm";

const DEBUG = true;

export const logger = {
  info(scope: LogScope, message: string, data?: unknown) {
    if (!DEBUG) return;
    if (data !== undefined) {
      console.log(`[${scope}] ${message}`, data);
    } else {
      console.log(`[${scope}] ${message}`);
    }
  },
  warn(scope: LogScope, message: string, data?: unknown) {
    if (!DEBUG) return;
    if (data !== undefined) {
      console.warn(`[${scope}] ${message}`, data);
    } else {
      console.warn(`[${scope}] ${message}`);
    }
  },
  error(scope: LogScope, message: string, error: Error) {
    console.error(`[${scope}] ${message}`, error);
  },
};

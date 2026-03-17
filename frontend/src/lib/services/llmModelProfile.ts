export type ResponseFormatStrategy = "json_mode_first" | "prompt_json_first";
export type ThinkingParamPolicy = "force_false" | "omit";
export type StreamCapabilityProfile =
  | "stable_non_stream"
  | "candidate_reasoning_stream";
export type ReasoningContentPolicy = "ignore" | "json_recovery_only";
export type ExportPromptProfile =
  | "legacy_handoff_balanced"
  | "kimi_handoff_rich"
  | "step_flash_concise";
export type ModelFamily =
  | "moonshot_kimi"
  | "stepfun"
  | "legacy_deepseek"
  | "legacy_qwen"
  | "unknown";

export interface LlmModelProfile {
  modelFamily: ModelFamily;
  responseFormatStrategy: ResponseFormatStrategy;
  thinkingParamPolicy: ThinkingParamPolicy;
  streamProfile: StreamCapabilityProfile;
  reasoningContentPolicy: ReasoningContentPolicy;
  exportPromptProfile: ExportPromptProfile;
}

export const KIMI_K2_5_MODEL = "moonshotai/Kimi-K2.5";
export const STEP_3_5_FLASH_MODEL = "stepfun-ai/Step-3.5-Flash";
export const LEGACY_DS14_MODEL = "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B";
export const LEGACY_QWEN14_MODEL = "Qwen/Qwen3-14B";

const KIMI_PROFILE: LlmModelProfile = {
  modelFamily: "moonshot_kimi",
  responseFormatStrategy: "prompt_json_first",
  thinkingParamPolicy: "omit",
  streamProfile: "candidate_reasoning_stream",
  reasoningContentPolicy: "json_recovery_only",
  exportPromptProfile: "kimi_handoff_rich",
};

const STEP_PROFILE: LlmModelProfile = {
  modelFamily: "stepfun",
  responseFormatStrategy: "prompt_json_first",
  thinkingParamPolicy: "omit",
  streamProfile: "candidate_reasoning_stream",
  reasoningContentPolicy: "json_recovery_only",
  exportPromptProfile: "step_flash_concise",
};

const LEGACY_DEEPSEEK_PROFILE: LlmModelProfile = {
  modelFamily: "legacy_deepseek",
  responseFormatStrategy: "json_mode_first",
  thinkingParamPolicy: "force_false",
  streamProfile: "stable_non_stream",
  reasoningContentPolicy: "json_recovery_only",
  exportPromptProfile: "legacy_handoff_balanced",
};

const LEGACY_QWEN_PROFILE: LlmModelProfile = {
  modelFamily: "legacy_qwen",
  responseFormatStrategy: "json_mode_first",
  thinkingParamPolicy: "force_false",
  streamProfile: "stable_non_stream",
  reasoningContentPolicy: "json_recovery_only",
  exportPromptProfile: "legacy_handoff_balanced",
};

const DEFAULT_PROFILE: LlmModelProfile = {
  modelFamily: "unknown",
  responseFormatStrategy: "json_mode_first",
  thinkingParamPolicy: "force_false",
  streamProfile: "stable_non_stream",
  reasoningContentPolicy: "json_recovery_only",
  exportPromptProfile: "legacy_handoff_balanced",
};

export function getLlmModelProfile(modelId: string | null | undefined): LlmModelProfile {
  const normalized = (modelId || "").trim();
  if (!normalized) {
    return DEFAULT_PROFILE;
  }

  if (normalized === KIMI_K2_5_MODEL) {
    return KIMI_PROFILE;
  }

  if (normalized === STEP_3_5_FLASH_MODEL) {
    return STEP_PROFILE;
  }

  if (normalized.startsWith("deepseek-ai/")) {
    return LEGACY_DEEPSEEK_PROFILE;
  }

  if (normalized.startsWith("Qwen/")) {
    return LEGACY_QWEN_PROFILE;
  }

  return DEFAULT_PROFILE;
}

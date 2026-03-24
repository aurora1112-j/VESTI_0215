/**
 * Schema validation test: exercises parseConversationSummaryV2Object and
 * parseWeeklyLiteReportObject with realistic LLM output patterns that
 * historically cause failures.
 */
import {
  parseConversationSummaryV2Object,
  parseJsonObjectFromText,
  parseWeeklyLiteReportObject,
  isLowSignalNarrativeItem,
} from "../src/lib/services/insightSchemas";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
    if (detail) console.error(`    ${detail}`);
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ─── Test data from real export ───
import testData from "./vesti-1threads-2026-03-23.json";
const conversation = testData.conversations[0];
const messages = conversation.messages;

// ════════════════════════════════════════════════════════════════
// 1. parseJsonObjectFromText — LLM output edge cases
// ════════════════════════════════════════════════════════════════
section("parseJsonObjectFromText — edge cases");

// 1a. Clean JSON
assert(
  typeof parseJsonObjectFromText('{"a":1}') === "object",
  "Clean JSON parses"
);

// 1b. Wrapped in ```json fences
assert(
  typeof parseJsonObjectFromText('```json\n{"a":1}\n```') === "object",
  "JSON in code fences"
);

// 1c. With <think> block before JSON
assert(
  typeof parseJsonObjectFromText(
    '<think>reasoning here</think>\n{"core_question":"test"}'
  ) === "object",
  "<think> block before JSON"
);

// 1d. With BOM
assert(
  typeof parseJsonObjectFromText('\uFEFF{"a":1}') === "object",
  "BOM prefix handled"
);

// 1e. Trailing comma
assert(
  typeof parseJsonObjectFromText('{"a":1, "b":2,}') === "object",
  "Trailing comma handled"
);

// 1f. Double-encoded JSON
assert(
  typeof parseJsonObjectFromText('"{\\"a\\":1}"') === "object",
  "Double-encoded JSON"
);

// 1g. Text before JSON
assert(
  typeof parseJsonObjectFromText(
    'Here is the result:\n{"core_question":"test"}'
  ) === "object",
  "Text before JSON"
);

// 1h. <think> + ```json combined
assert(
  typeof parseJsonObjectFromText(
    '<think>I need to analyze...</think>\n```json\n{"core_question":"test"}\n```'
  ) === "object",
  "<think> + code fences combined"
);

// ════════════════════════════════════════════════════════════════
// 2. parseConversationSummaryV2Object — common LLM output quirks
// ════════════════════════════════════════════════════════════════
section("Summary V2 — valid baseline");

const validV2 = {
  core_question: "铭凡MS-S1 MAX与A100的性价比对比",
  thinking_journey: [
    {
      step: 1,
      speaker: "User",
      assertion:
        "用户询问铭凡MS-S1 MAX的价格，这是购买决策的第一步。这个问题背后隐含着对AI工作站性价比的关注。",
      real_world_anchor: "铭凡MS-S1 MAX首发价14999元",
    },
    {
      step: 2,
      speaker: "AI",
      assertion:
        "AI提供了详细的价格和配置信息，包括128GB内存和2TB SSD，这为后续比较奠定基础。",
      real_world_anchor: "AMD锐龙AI Max+ 395处理器，126 TOPS算力",
    },
    {
      step: 3,
      speaker: "User",
      assertion:
        "用户进一步将MS-S1 MAX与A100进行比较，说明用户在评估是否可以用消费级设备替代专业GPU。",
      real_world_anchor: null,
    },
  ],
  key_insights: [
    {
      term: "性价比差异",
      definition: "MS-S1 MAX价格仅为A100单卡的1/5到1/10",
    },
    {
      term: "内存带宽瓶颈",
      definition: "LPDDR5X带宽仅为HBM2e的1/8，是训练大模型的最大限制",
    },
  ],
  unresolved_threads: [
    "MS-S1 MAX在实际LoRA微调场景下的真实训练速度和效果如何",
  ],
  meta_observations: {
    thinking_style: "逐步从价格比较深入到技术细节和适用场景分析",
    emotional_tone: "务实而好奇，希望找到高性价比的AI硬件方案",
    depth_level: "moderate",
  },
  actionable_next_steps: [
    "实际测试MS-S1 MAX在7B-13B模型LoRA微调场景下的表现",
    "对比云端A100租用成本与本地MS-S1 MAX的长期成本",
  ],
};

const baselineResult = parseConversationSummaryV2Object(validV2);
assert(baselineResult.success === true, "Valid V2 baseline passes");

// ─── 2a. Empty string real_world_anchor (very common LLM mistake) ───
section("Summary V2 — empty string anchor");
const emptyAnchor = structuredClone(validV2);
emptyAnchor.thinking_journey[2].real_world_anchor = "" as any;
const emptyAnchorResult = parseConversationSummaryV2Object(emptyAnchor);
assert(
  emptyAnchorResult.success === true,
  'Empty string "" anchor coerced to null'
);
if (emptyAnchorResult.success) {
  assert(
    emptyAnchorResult.data.thinking_journey[2].real_world_anchor === null,
    "Anchor value is null after coercion"
  );
}

// ─── 2b. speaker = "assistant" instead of "AI" ───
section("Summary V2 — speaker variants");
const altSpeaker = structuredClone(validV2);
(altSpeaker.thinking_journey[1] as any).speaker = "assistant";
const altSpeakerResult = parseConversationSummaryV2Object(altSpeaker);
assert(altSpeakerResult.success === true, '"assistant" coerced to "AI"');
if (altSpeakerResult.success) {
  assert(
    altSpeakerResult.data.thinking_journey[1].speaker === "AI",
    "Speaker value is AI after coercion"
  );
}

const humanSpeaker = structuredClone(validV2);
(humanSpeaker.thinking_journey[0] as any).speaker = "human";
const humanResult = parseConversationSummaryV2Object(humanSpeaker);
assert(humanResult.success === true, '"human" coerced to "User"');

// ─── 2c. depth_level capitalized or non-standard ───
section("Summary V2 — depth_level variants");
const capsDepth = structuredClone(validV2);
(capsDepth.meta_observations as any).depth_level = "Moderate";
const capsResult = parseConversationSummaryV2Object(capsDepth);
assert(capsResult.success === true, '"Moderate" (capitalized) accepted');

const deepish = structuredClone(validV2);
(deepish.meta_observations as any).depth_level = "in-depth";
const deepishResult = parseConversationSummaryV2Object(deepish);
assert(
  deepishResult.success === true,
  '"in-depth" (non-standard) defaults to moderate'
);

// ─── 2d. Missing optional arrays (null instead of []) ───
section("Summary V2 — null/missing arrays");
const nullArrays = structuredClone(validV2);
(nullArrays as any).key_insights = null;
(nullArrays as any).unresolved_threads = null;
(nullArrays as any).actionable_next_steps = null;
const nullArraysResult = parseConversationSummaryV2Object(nullArrays);
assert(nullArraysResult.success === true, "null arrays coerced to []");

const missingArrays = structuredClone(validV2);
delete (missingArrays as any).key_insights;
delete (missingArrays as any).unresolved_threads;
delete (missingArrays as any).actionable_next_steps;
const missingResult = parseConversationSummaryV2Object(missingArrays);
assert(missingResult.success === true, "Missing arrays default to []");

// ─── 2e. step as string "1" instead of number 1 ───
section("Summary V2 — step type coercion");
const stringStep = structuredClone(validV2);
(stringStep.thinking_journey[0] as any).step = "1";
(stringStep.thinking_journey[1] as any).step = "2";
(stringStep.thinking_journey[2] as any).step = "3";
const stringStepResult = parseConversationSummaryV2Object(stringStep);
assert(stringStepResult.success === true, "String step numbers accepted");

// ─── 2f. Overly long core_question (>180 chars) ───
section("Summary V2 — string length truncation");
const longQuestion = structuredClone(validV2);
longQuestion.core_question = "这是一个非常长的问题" + "，".repeat(200);
const longResult = parseConversationSummaryV2Object(longQuestion);
assert(longResult.success === true, "Long core_question truncated, not rejected");
if (longResult.success) {
  assert(
    longResult.data.core_question.length <= 180,
    `core_question length ${longResult.data.core_question.length} <= 180`
  );
}

// ─── 2g. Overly long assertion ───
const longAssertion = structuredClone(validV2);
longAssertion.thinking_journey[0].assertion = "A".repeat(600);
const longAssertionResult = parseConversationSummaryV2Object(longAssertion);
assert(
  longAssertionResult.success === true,
  "Long assertion truncated, not rejected"
);

// ─── 2h. All anchors empty strings ───
section("Summary V2 — all anchors empty");
const allEmptyAnchors = structuredClone(validV2);
allEmptyAnchors.thinking_journey.forEach((s: any) => {
  s.real_world_anchor = "";
});
const allEmptyResult = parseConversationSummaryV2Object(allEmptyAnchors);
assert(allEmptyResult.success === true, "All empty anchors accepted");

// ─── 2i. Complete realistic LLM output with mixed issues ───
section("Summary V2 — realistic mixed-issue LLM output");
const realisticLlm = {
  core_question:
    "铭凡MS-S1 MAX迷你主机与NVIDIA A100 GPU在价格、性能和适用场景上有何差异，以及MS-S1 MAX是否适合用于大模型训练？",
  thinking_journey: [
    {
      step: 1,
      speaker: "User" as const,
      assertion:
        "用户首先询问铭凡MS-S1 MAX的价格。这表明用户正在调研AI硬件选项，可能在考虑购买决策，并需要了解产品定位。",
      real_world_anchor: "铭凡MS-S1 MAX首发价14999元，日常价15999元",
    },
    {
      step: 2,
      speaker: "assistant", // WRONG: should be "AI"
      assertion:
        "AI详细列出了MS-S1 MAX的价格、配置和亮点，包括AMD锐龙AI Max+ 395处理器和128GB LPDDR5X内存。这些信息为后续价格对比提供了基准线。",
      real_world_anchor: "",  // WRONG: should be null
    },
    {
      step: "3", // WRONG: should be number
      speaker: "User" as const,
      assertion:
        "用户将MS-S1 MAX与A100进行价格比较。这揭示了用户的真正需求：评估消费级AI工作站能否在某些场景下替代专业数据中心GPU，以节约成本。",
      real_world_anchor: null,
    },
    {
      step: 4,
      speaker: "AI" as const,
      assertion:
        "AI提供了全面的价格对比表和关键差异分析，明确了两者定位的根本不同。这推动用户进一步追问MS-S1 MAX在训练场景的可行性。",
      real_world_anchor:
        "MS-S1 MAX整机约1.5万元，A100单卡8-15万元，价格相差5-10倍",
    },
  ],
  key_insights: [
    {
      term: "定位差异",
      definition:
        "MS-S1 MAX定位个人AI工作站，A100定位数据中心训练集群，两者并非直接替代关系",
    },
    {
      term: "内存带宽瓶颈",
      definition:
        "LPDDR5X内存带宽(~256GB/s)仅为A100 HBM2e(2TB/s)的约1/8，这是限制训练性能的关键因素",
    },
  ],
  unresolved_threads: [
    "MS-S1 MAX在实际7B-13B模型LoRA微调中的具体训练速度和效果数据尚缺乏第三方验证",
    "双机集群运行2350亿参数模型的实际推理延迟和稳定性表现未知",
  ],
  meta_observations: {
    thinking_style: "从价格入手逐步深入到技术对比和场景适配分析，层层递进",
    emotional_tone: "务实好奇，带着有限预算寻找最优AI硬件解决方案的紧迫感",
    depth_level: "Deep", // WRONG: should be lowercase
  },
  actionable_next_steps: [
    "使用Unsloth或LLaMA-Factory框架在MS-S1 MAX上实际测试7B模型LoRA微调速度",
    "计算云端A100按时租用与本地MS-S1 MAX的3年总拥有成本(TCO)对比",
    "关注双机集群方案的第三方评测以验证2350亿参数模型的实际推理能力",
  ],
};

const realisticResult = parseConversationSummaryV2Object(realisticLlm);
assert(
  realisticResult.success === true,
  "Realistic mixed-issue LLM output passes"
);
if (realisticResult.success) {
  assert(
    realisticResult.data.thinking_journey[1].speaker === "AI",
    '"assistant" → "AI"'
  );
  assert(
    realisticResult.data.thinking_journey[1].real_world_anchor === null,
    '"" → null'
  );
  assert(
    realisticResult.data.thinking_journey[2].step === 3,
    '"3" → 3'
  );
  assert(
    realisticResult.data.meta_observations.depth_level === "deep",
    '"Deep" → "deep"'
  );
}

// ════════════════════════════════════════════════════════════════
// 3. Weekly Lite Report — common LLM output quirks
// ════════════════════════════════════════════════════════════════
section("Weekly Lite — valid baseline");

const validWeekly = {
  time_range: {
    start: "2026-03-17",
    end: "2026-03-23",
    total_conversations: 5,
  },
  highlights: [
    "本周深入对比了消费级AI工作站与专业GPU的性价比差异",
    "讨论了Agent架构从API调用到自主计算实体的演进路径",
  ],
  recurring_questions: [
    "如何在有限预算下选择最优的本地AI硬件方案？",
  ],
  cross_domain_echoes: [],
  unresolved_threads: [
    "MS-S1 MAX在实际LoRA微调场景下的训练速度数据尚未验证",
  ],
  suggested_focus: [
    "下周实际测试MS-S1 MAX的LoRA微调性能并记录基准数据",
  ],
  evidence: [
    { conversation_id: 3, note: "MS-S1 MAX vs A100 价格和性能对比" },
  ],
  insufficient_data: false,
};

const weeklyBaseline = parseWeeklyLiteReportObject(validWeekly);
assert(weeklyBaseline.success === true, "Valid weekly baseline passes");

// ─── 3a. total_conversations as string ───
section("Weekly Lite — type coercion");
const stringTotal = structuredClone(validWeekly);
(stringTotal.time_range as any).total_conversations = "5";
const stringTotalResult = parseWeeklyLiteReportObject(stringTotal);
assert(stringTotalResult.success === true, "String total_conversations accepted");

// ─── 3b. conversation_id as string ───
const stringConvId = structuredClone(validWeekly);
(stringConvId.evidence[0] as any).conversation_id = "3";
const stringConvIdResult = parseWeeklyLiteReportObject(stringConvId);
assert(stringConvIdResult.success === true, "String conversation_id accepted");

// ─── 3c. insufficient_data as string "false" ───
const stringBool = structuredClone(validWeekly);
(stringBool as any).insufficient_data = "false";
const stringBoolResult = parseWeeklyLiteReportObject(stringBool);
assert(stringBoolResult.success === true, 'String "false" → boolean false');

// ─── 3d. Missing optional arrays ───
const missingWeeklyArrays: any = {
  time_range: validWeekly.time_range,
  highlights: validWeekly.highlights,
  insufficient_data: false,
};
const missingWeeklyResult = parseWeeklyLiteReportObject(missingWeeklyArrays);
assert(
  missingWeeklyResult.success === true,
  "Missing optional weekly arrays default to []"
);

// ─── 3e. evidence_ids as strings ───
const stringEvidenceIds = structuredClone(validWeekly);
stringEvidenceIds.cross_domain_echoes = [
  {
    domain_a: "硬件",
    domain_b: "软件",
    shared_logic: "都需要内存带宽优化",
    evidence_ids: ["3", "4"] as any,
  },
];
const stringEvidenceIdsResult = parseWeeklyLiteReportObject(stringEvidenceIds);
assert(
  stringEvidenceIdsResult.success === true,
  "String evidence_ids coerced to numbers"
);

// ════════════════════════════════════════════════════════════════
// 4. isLowSignalNarrativeItem edge cases
// ════════════════════════════════════════════════════════════════
section("isLowSignalNarrativeItem");

assert(isLowSignalNarrativeItem("") === true, "Empty string is low signal");
assert(isLowSignalNarrativeItem("n/a") === true, "n/a is low signal");
assert(isLowSignalNarrativeItem("获取") === true, "Single CJK verb is low signal");
assert(isLowSignalNarrativeItem("确认对齐") === true, "Short CJK verb phrase is low signal");
assert(
  isLowSignalNarrativeItem("check build") === true,
  "Short English phrase is low signal"
);
assert(
  isLowSignalNarrativeItem("本周深入对比了消费级AI工作站与专业GPU的性价比差异") === false,
  "Full Chinese sentence is NOT low signal"
);
assert(
  isLowSignalNarrativeItem(
    "MS-S1 MAX在实际LoRA微调场景下的训练速度数据尚未验证"
  ) === false,
  "Technical Chinese sentence is NOT low signal"
);

// ════════════════════════════════════════════════════════════════
// 5. End-to-end: parseJsonObjectFromText → parseConversationSummaryV2Object
// ════════════════════════════════════════════════════════════════
section("End-to-end: raw LLM text → structured summary");

// Simulate realistic LLM output with think block + json fence
const rawLlmOutput = `<think>
Let me analyze this conversation about MS-S1 MAX and A100...
The user wants to compare price and capabilities.
</think>

\`\`\`json
${JSON.stringify(realisticLlm)}
\`\`\``;

try {
  const parsedJson = parseJsonObjectFromText(rawLlmOutput);
  const e2eResult = parseConversationSummaryV2Object(parsedJson);
  assert(e2eResult.success === true, "E2E: <think> + ```json → valid summary");
} catch (e) {
  assert(false, "E2E: <think> + ```json → valid summary", String(e));
}

// Simulate LLM that outputs JSON with no wrapper
const rawJsonOnly = JSON.stringify(realisticLlm);
try {
  const parsedJson2 = parseJsonObjectFromText(rawJsonOnly);
  const e2eResult2 = parseConversationSummaryV2Object(parsedJson2);
  assert(e2eResult2.success === true, "E2E: raw JSON only → valid summary");
} catch (e) {
  assert(false, "E2E: raw JSON only → valid summary", String(e));
}

// Simulate LLM that adds explanatory text
const rawWithText = `以下是对话摘要的JSON输出：

${JSON.stringify(realisticLlm, null, 2)}

希望这个摘要对您有帮助。`;
try {
  const parsedJson3 = parseJsonObjectFromText(rawWithText);
  const e2eResult3 = parseConversationSummaryV2Object(parsedJson3);
  assert(
    e2eResult3.success === true,
    "E2E: text + JSON + text → valid summary"
  );
} catch (e) {
  assert(false, "E2E: text + JSON + text → valid summary", String(e));
}

// ════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

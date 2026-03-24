/**
 * Extended edge-case tests: LLM output patterns that historically cause
 * validation failures in production.
 */
import {
  parseConversationSummaryV2Object,
  parseJsonObjectFromText,
  parseWeeklyLiteReportObject,
  validateWeeklySemanticQuality,
  normalizeWeeklyLiteReport,
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

// ════════════════════════════════════════════════════════════════
// 1. Deeply malformed but salvageable LLM outputs
// ════════════════════════════════════════════════════════════════
section("Salvageable malformed outputs");

// 1a. key_insights as array of strings (not {term, definition})
const stringInsights = {
  core_question: "关于Agent架构设计",
  thinking_journey: [
    { step: 1, speaker: "User", assertion: "用户询问Agent架构的核心设计要素和实现方法。", real_world_anchor: null },
    { step: 2, speaker: "AI", assertion: "AI系统讲解了ReAct、Plan-and-Solve、Multi-Agent等主流架构模式。", real_world_anchor: null },
  ],
  key_insights: ["ReAct模式是推理+行动的循环", "MCP协议正在成为工具发现标准"],
  unresolved_threads: [],
  meta_observations: {
    thinking_style: "系统化梳理各架构模式的差异和适用场景",
    emotional_tone: "知识输出型，结构清晰",
    depth_level: "deep",
  },
  actionable_next_steps: [],
};
const stringInsightsResult = parseConversationSummaryV2Object(stringInsights);
assert(
  stringInsightsResult.success === true,
  "String array key_insights coerced to {term, definition}"
);
if (stringInsightsResult.success) {
  assert(
    stringInsightsResult.data.key_insights.length > 0,
    `Coerced insights count: ${stringInsightsResult.data.key_insights.length}`
  );
}

// 1b. thinking_journey as string narrative (not array)
const narrativeJourney = {
  core_question: "如何选择AI硬件",
  thinking_journey: "用户先问价格，然后对比A100，最后问训练可行性",
  key_insights: [],
  unresolved_threads: [],
  meta_observations: {
    thinking_style: "逐步深入",
    emotional_tone: "好奇务实",
    depth_level: "moderate",
  },
  actionable_next_steps: [],
};
const narrativeResult = parseConversationSummaryV2Object(narrativeJourney);
assert(
  narrativeResult.success === true,
  "String thinking_journey coerced to step array"
);

// 1c. meta_observations as array (some LLMs wrap in array)
const arrayMeta = {
  core_question: "测试元观察数组",
  thinking_journey: [
    { step: 1, speaker: "User", assertion: "用户提问测试。", real_world_anchor: null },
  ],
  key_insights: [],
  unresolved_threads: [],
  meta_observations: [{
    thinking_style: "渐进式",
    emotional_tone: "中性",
    depth_level: "moderate",
  }],
  actionable_next_steps: [],
};
const arrayMetaResult = parseConversationSummaryV2Object(arrayMeta);
assert(
  arrayMetaResult.success === true,
  "Array-wrapped meta_observations unwrapped"
);

// 1d. unresolved_threads as semicolon-separated string
const semicolonThreads = {
  core_question: "测试分号分割",
  thinking_journey: [
    { step: 1, speaker: "User", assertion: "用户提问了一个问题。", real_world_anchor: null },
  ],
  key_insights: [],
  unresolved_threads: "MS-S1 MAX实际微调速度未验证；双机集群2350亿参数推理延迟未知；长期功耗成本缺乏数据",
  meta_observations: {
    thinking_style: "直接",
    emotional_tone: "中性",
    depth_level: "moderate",
  },
  actionable_next_steps: "使用Unsloth框架测试7B模型LoRA微调性能；计算云端A100租用与本地MS-S1的三年总拥有成本",
};
const semicolonResult = parseConversationSummaryV2Object(semicolonThreads);
assert(
  semicolonResult.success === true,
  "Semicolon-separated strings split into arrays"
);
if (semicolonResult.success) {
  assert(
    semicolonResult.data.unresolved_threads.length >= 2,
    `Split unresolved count: ${semicolonResult.data.unresolved_threads.length}`
  );
  assert(
    semicolonResult.data.actionable_next_steps.length >= 2,
    `Split next_steps count: ${semicolonResult.data.actionable_next_steps.length}`
  );
}

// ════════════════════════════════════════════════════════════════
// 2. Weekly report edge cases
// ════════════════════════════════════════════════════════════════
section("Weekly — edge cases");

// 2a. cross_domain_echoes completely missing
const noEchoes: any = {
  time_range: { start: "2026-03-17", end: "2026-03-23", total_conversations: 5 },
  highlights: ["一个有效高亮"],
  recurring_questions: [],
  unresolved_threads: [],
  suggested_focus: [],
  evidence: [],
  insufficient_data: false,
};
const noEchoesResult = parseWeeklyLiteReportObject(noEchoes);
assert(
  noEchoesResult.success === true,
  "Missing cross_domain_echoes defaults to []"
);

// 2b. insufficient_data as string "true"
const stringTrue: any = {
  ...noEchoes,
  insufficient_data: "true",
};
const stringTrueResult = parseWeeklyLiteReportObject(stringTrue);
assert(stringTrueResult.success === true, '"true" string → boolean true');
if (stringTrueResult.success) {
  assert(
    stringTrueResult.data.insufficient_data === true,
    "insufficient_data is boolean true"
  );
}

// ════════════════════════════════════════════════════════════════
// 3. Weekly semantic quality validation
// ════════════════════════════════════════════════════════════════
section("Weekly semantic quality");

const goodReport = normalizeWeeklyLiteReport({
  time_range: { start: "2026-03-17", end: "2026-03-23", total_conversations: 5 },
  highlights: [
    "本周深入对比了消费级AI工作站与专业GPU的性价比差异，明确了MS-S1 MAX适合个人开发者本地推理的定位",
    "讨论了主流Agent架构从ReAct到Multi-Agent的演进，梳理了工程化关键要素",
  ],
  recurring_questions: ["如何在有限预算下选择最优的本地AI硬件方案？"],
  cross_domain_echoes: [],
  unresolved_threads: ["MS-S1 MAX在实际LoRA微调场景下的训练速度未验证"],
  suggested_focus: ["下周实际测试MS-S1 MAX的微调性能并记录基准数据"],
  evidence: [
    { conversation_id: 3, note: "MS-S1 MAX vs A100 价格和性能对比分析" },
  ],
  insufficient_data: false,
});
const quality = validateWeeklySemanticQuality(goodReport);
assert(quality.passed === true, "Good report passes semantic quality");
assert(
  quality.hardIssueCodes.length === 0,
  `No hard issues (got ${quality.hardIssueCodes.join(",")})`
);

// ════════════════════════════════════════════════════════════════
// 4. Deeply nested JSON extraction
// ════════════════════════════════════════════════════════════════
section("JSON extraction — extreme cases");

// 4a. Multiple JSON objects in output (should take first)
const multiJson = '{"a":1}\n\nSome text\n\n{"b":2}';
const multiResult = parseJsonObjectFromText(multiJson);
assert(
  multiResult !== null && typeof multiResult === "object",
  "Multiple JSON objects: first one extracted"
);

// 4b. JSON with unicode escapes
const unicodeJson = '{"core_question":"\\u6d4b\\u8bd5"}';
const unicodeResult = parseJsonObjectFromText(unicodeJson);
assert(
  unicodeResult !== null,
  "JSON with unicode escapes parsed"
);

// 4c. Very deeply nested JSON
const deepNested = JSON.stringify({
  core_question: "test",
  thinking_journey: [{ step: 1, speaker: "User", assertion: "test assertion for deep nesting scenario", real_world_anchor: null }],
  key_insights: [],
  unresolved_threads: [],
  meta_observations: { thinking_style: "test", emotional_tone: "test", depth_level: "moderate" },
  actionable_next_steps: [],
});
const wrappedDeep = `I'll analyze the conversation now.\n\nHere is my analysis:\n\n${deepNested}\n\nI hope this helps.`;
try {
  const deepResult = parseJsonObjectFromText(wrappedDeep);
  const deepParsed = parseConversationSummaryV2Object(deepResult);
  assert(deepParsed.success === true, "Deeply wrapped JSON: full pipeline passes");
} catch (e) {
  assert(false, "Deeply wrapped JSON: full pipeline passes", String(e));
}

// ════════════════════════════════════════════════════════════════
// 5. Legacy v2 format (object thinking_journey)
// ════════════════════════════════════════════════════════════════
section("Legacy v2 format");

const legacyV2 = {
  core_question: "铭凡MS-S1 MAX性价比分析",
  thinking_journey: {
    initial_state: "用户想了解MS-S1 MAX的价格和与A100的对比",
    key_turns: [
      "AI提供了详细的价格配置信息",
      "用户追问与A100的性价比对比",
      "AI深入分析了两者的定位差异",
    ],
    final_understanding: "MS-S1 MAX适合个人开发者推理，A100适合企业级训练",
  },
  key_insights: [
    "MS-S1 MAX价格仅为A100的1/5到1/10",
    "内存带宽是训练性能的关键瓶颈",
  ],
  unresolved_threads: ["实际LoRA微调的性能数据尚缺"],
  meta_observations: {
    thinking_style: "逐步从价格深入到技术对比",
    emotional_tone: "务实好奇",
    depth_level: "moderate",
  },
  actionable_next_steps: ["测试MS-S1 MAX的实际微调性能"],
};

const legacyResult = parseConversationSummaryV2Object(legacyV2);
assert(legacyResult.success === true, "Legacy v2 (object journey) accepted");
if (legacyResult.success) {
  assert(
    Array.isArray(legacyResult.data.thinking_journey),
    "Legacy journey converted to array"
  );
  assert(
    legacyResult.data.thinking_journey.length >= 3,
    `Journey steps: ${legacyResult.data.thinking_journey.length}`
  );
}

// ════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

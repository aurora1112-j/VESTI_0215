import type {
  ConversationSummaryV1,
  ConversationSummaryV2,
  SummaryRecord,
  WeeklyLiteReportV1,
  WeeklyReportRecord,
  WeeklyReportV1,
} from "../types";
import type {
  ChatSummaryData,
  WeeklySummaryData,
} from "../types/insightsPresentation";
import { resolveTechTags } from "./tagging";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function inferTags(explicitTags: string[] | undefined, fallbackText: string): string[] {
  return resolveTechTags(explicitTags, fallbackText);
}

function toLines(text: string): string[] {
  return dedupe(
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((line) => line.length > 0)
  );
}

function toIsoTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function toRangeLabel(rangeStart: number, rangeEnd: number): string {
  const start = new Date(rangeStart).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
  const end = new Date(rangeEnd).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
  return `${start} - ${end}`;
}

function isConversationSummaryV2(value: unknown): value is ConversationSummaryV2 {
  if (!value || typeof value !== "object") return false;
  return "core_question" in value && "thinking_journey" in value;
}

function isConversationSummaryV1(value: unknown): value is ConversationSummaryV1 {
  if (!value || typeof value !== "object") return false;
  return "topic_title" in value && "key_takeaways" in value;
}

function isWeeklyLiteReportV1(value: unknown): value is WeeklyLiteReportV1 {
  if (!value || typeof value !== "object") return false;
  return "time_range" in value && "highlights" in value;
}

function isWeeklyReportV1(value: unknown): value is WeeklyReportV1 {
  if (!value || typeof value !== "object") return false;
  return "period_title" in value && "main_themes" in value;
}

function inferUnresolved(lines: string[]): string[] {
  return lines
    .filter((line) => /未决|未解决|待确认|pending|risk|风险|疑问/i.test(line))
    .slice(0, 4);
}

export function toChatSummaryData(
  summary: SummaryRecord,
  options?: { conversationTitle?: string }
): ChatSummaryData {
  const fallbackLines = toLines(summary.content);
  const structured = summary.structured;

  if (isConversationSummaryV2(structured)) {
    return {
      meta: {
        title: options?.conversationTitle ?? structured.core_question,
        generated_at: toIsoTime(summary.createdAt),
        tags: inferTags([], `${structured.core_question}\n${structured.key_insights.join("\n")}`),
        fallback: summary.status === "fallback",
      },
      core_question: structured.core_question,
      thinking_journey: {
        initial_state: structured.thinking_journey.initial_state,
        key_turns: dedupe(structured.thinking_journey.key_turns).slice(0, 5),
        final_understanding: structured.thinking_journey.final_understanding,
      },
      key_insights: dedupe(structured.key_insights).slice(0, 6),
      unresolved_threads: dedupe(structured.unresolved_threads).slice(0, 5),
      meta_observations: structured.meta_observations,
      actionable_next_steps: dedupe(structured.actionable_next_steps).slice(0, 6),
      plain_text: summary.content,
    };
  }

  if (isConversationSummaryV1(structured)) {
    const keyInsights = dedupe(structured.key_takeaways).slice(0, 6);
    const actionItems = dedupe(structured.action_items ?? []).slice(0, 6);
    const linesSource = [...keyInsights, ...actionItems];

    return {
      meta: {
        title: options?.conversationTitle ?? structured.topic_title,
        generated_at: toIsoTime(summary.createdAt),
        tags: inferTags(
          structured.tech_stack_detected,
          `${structured.topic_title}\n${keyInsights.join("\n")}`
        ),
        fallback: summary.status === "fallback",
      },
      core_question: options?.conversationTitle ?? structured.topic_title,
      thinking_journey: {
        initial_state: "你从一个需要澄清的问题出发，逐步展开讨论。",
        key_turns: linesSource.slice(0, 4),
        final_understanding: keyInsights[0] ?? "你获得了阶段性结论。",
      },
      key_insights: keyInsights,
      unresolved_threads: inferUnresolved(linesSource),
      meta_observations: {
        thinking_style: "你倾向通过分点拆解来推进理解。",
        emotional_tone: "整体语气偏理性探索。",
        depth_level: "moderate",
      },
      actionable_next_steps: actionItems,
      plain_text: summary.content,
    };
  }

  const firstLine = fallbackLines[0] ?? options?.conversationTitle ?? "Conversation Summary";
  const secondLine = fallbackLines[1] ?? fallbackLines[0] ?? "暂无可提取结论";

  return {
    meta: {
      title: options?.conversationTitle ?? firstLine,
      generated_at: toIsoTime(summary.createdAt),
      tags: inferTags([], summary.content),
      fallback: true,
    },
    core_question: options?.conversationTitle
      ? `你在这次对话中想解决的问题：${options.conversationTitle}`
      : firstLine,
    thinking_journey: {
      initial_state: firstLine,
      key_turns: fallbackLines.slice(0, 4),
      final_understanding: secondLine,
    },
    key_insights: fallbackLines.slice(0, 5),
    unresolved_threads: inferUnresolved(fallbackLines),
    meta_observations: {
      thinking_style: "样本不足，无法稳定识别思维风格。",
      emotional_tone: "样本不足，默认中性。",
      depth_level: "superficial",
    },
    actionable_next_steps: fallbackLines
      .filter((line) => /下一步|TODO|行动|待办|next/i.test(line))
      .slice(0, 4),
    plain_text: summary.content,
  };
}

export function toWeeklySummaryData(report: WeeklyReportRecord): WeeklySummaryData {
  const fallbackLines = toLines(report.content);
  const rangeLabel = toRangeLabel(report.rangeStart, report.rangeEnd);
  const structured = report.structured;

  if (isWeeklyLiteReportV1(structured)) {
    return {
      meta: {
        title: `Weekly Lite ${rangeLabel}`,
        generated_at: toIsoTime(report.createdAt),
        tags: inferTags([], `${structured.highlights.join("\n")}\n${structured.suggested_focus.join("\n")}`),
        fallback: report.status === "fallback",
        range_label: rangeLabel,
      },
      highlights: dedupe(structured.highlights).slice(0, 6),
      recurring_questions: dedupe(structured.recurring_questions).slice(0, 4),
      unresolved_threads: dedupe(structured.unresolved_threads).slice(0, 6),
      suggested_focus: dedupe(structured.suggested_focus).slice(0, 6),
      evidence: (structured.evidence || []).slice(0, 8),
      insufficient_data: structured.insufficient_data,
      plain_text: report.content,
    };
  }

  if (isWeeklyReportV1(structured)) {
    const themes = dedupe(structured.main_themes).slice(0, 6);
    const keyInsights = dedupe(structured.key_takeaways).slice(0, 8);
    const actionItems = dedupe(structured.action_items ?? []).slice(0, 6);

    return {
      meta: {
        title: structured.period_title || `Weekly Summary ${rangeLabel}`,
        generated_at: toIsoTime(report.createdAt),
        tags: inferTags(
          structured.tech_stack_detected,
          `${structured.period_title}\n${themes.join("\n")}\n${keyInsights.join("\n")}`
        ),
        fallback: report.status === "fallback",
        range_label: rangeLabel,
      },
      highlights: keyInsights.length ? keyInsights : themes,
      recurring_questions: [],
      unresolved_threads: inferUnresolved([...themes, ...keyInsights]),
      suggested_focus: actionItems,
      evidence: [],
      insufficient_data: false,
      plain_text: report.content,
    };
  }

  const highlights = fallbackLines.slice(0, 5);

  return {
    meta: {
      title: `Weekly Lite ${rangeLabel}`,
      generated_at: toIsoTime(report.createdAt),
      tags: inferTags([], report.content),
      fallback: true,
      range_label: rangeLabel,
    },
    highlights,
    recurring_questions: fallbackLines
      .filter((line) => /反复|重复|question|why|如何/i.test(line))
      .slice(0, 3),
    unresolved_threads: inferUnresolved(fallbackLines),
    suggested_focus: fallbackLines
      .filter((line) => /下一步|建议|focus|priority|行动/i.test(line))
      .slice(0, 4),
    evidence: [],
    insufficient_data: true,
    plain_text: report.content,
  };
}

// ============================================================
// --- pages/InsightsPage.tsx ---
// AI Insights: conversation summaries + weekly reports
// ============================================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, RefreshCw, CalendarRange, Loader2 } from "lucide-react";
import type {
  Conversation,
  InsightStatus,
  SummaryRecord,
  WeeklyReportRecord,
} from "@/types";
import { getConversations } from "@/services/mockService";
import {
  getConversationSummary,
  generateConversationSummary,
  getWeeklyReport,
  generateWeeklyReport,
} from "@/services/insightsService";
import { SearchInput } from "@/components/SearchInput";
import { PlatformTag } from "@/components/PlatformTag";

const DEFAULT_RANGE_DAYS = 7;

function formatDateInput(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDateInput(value: string): number {
  const [yyyy, mm, dd] = value.split("-").map((v) => Number(v));
  if (!yyyy || !mm || !dd) return Date.now();
  return new Date(yyyy, mm - 1, dd).getTime();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function InsightsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [summary, setSummary] = useState<SummaryRecord | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<InsightStatus>("idle");
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const today = Date.now();
  const defaultStart = today - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000;
  const [rangeStartInput, setRangeStartInput] = useState(
    formatDateInput(defaultStart)
  );
  const [rangeEndInput, setRangeEndInput] = useState(formatDateInput(today));
  const [rangeStart, setRangeStart] = useState(defaultStart);
  const [rangeEnd, setRangeEnd] = useState(today);

  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportRecord | null>(null);
  const [weeklyStatus, setWeeklyStatus] = useState<InsightStatus>("idle");
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  useEffect(() => {
    getConversations().then((data) => {
      setConversations(data);
      setSelectedId((current) => current ?? (data[0]?.id ?? null));
    });
  }, []);

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.snippet.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  useEffect(() => {
    if (!selectedId) {
      setSummary(null);
      setSummaryStatus("idle");
      return;
    }
    setSummaryStatus("loading");
    setSummaryError(null);
    getConversationSummary(selectedId)
      .then((data) => {
        setSummary(data);
        setSummaryStatus(data ? "ready" : "idle");
      })
      .catch((error) => {
        setSummary(null);
        setSummaryError(getErrorMessage(error));
        setSummaryStatus("error");
      });
  }, [selectedId]);

  useEffect(() => {
    setWeeklyStatus("loading");
    setWeeklyError(null);
    getWeeklyReport(rangeStart, rangeEnd)
      .then((data) => {
        setWeeklyReport(data);
        setWeeklyStatus(data ? "ready" : "idle");
      })
      .catch((error) => {
        setWeeklyReport(null);
        setWeeklyError(getErrorMessage(error));
        setWeeklyStatus("error");
      });
  }, [rangeStart, rangeEnd]);

  const handleGenerateSummary = async () => {
    if (!selectedId) return;
    setSummaryStatus("loading");
    setSummaryError(null);
    try {
      const data = await generateConversationSummary(selectedId);
      setSummary(data);
      setSummaryStatus("ready");
    } catch (error) {
      setSummaryError(getErrorMessage(error));
      setSummaryStatus("error");
    }
  };

  const handleApplyRange = () => {
    const start = parseDateInput(rangeStartInput);
    const end = parseDateInput(rangeEndInput) + 24 * 60 * 60 * 1000 - 1;
    setRangeStart(start);
    setRangeEnd(end);
  };

  const handleGenerateWeekly = async () => {
    setWeeklyStatus("loading");
    setWeeklyError(null);
    try {
      const data = await generateWeeklyReport(rangeStart, rangeEnd);
      setWeeklyReport(data);
      setWeeklyStatus("ready");
    } catch (error) {
      setWeeklyError(getErrorMessage(error));
      setWeeklyStatus("error");
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex h-full flex-col overflow-y-auto vesti-scroll bg-bg-tertiary">
      <header className="flex h-8 shrink-0 items-center px-4">
        <h1 className="text-vesti-xl font-semibold text-text-primary">灵感</h1>
      </header>

      <div className="flex flex-col gap-5 p-4">
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-vesti-sm font-medium text-text-secondary">
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            AI 摘要
          </h2>

          <div className="rounded-md bg-surface-card p-3">
            <SearchInput value={search} onChange={setSearch} />
            <div className="mt-3 flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${
                    selectedId === conversation.id
                      ? "border-accent-primary bg-accent-primary-light"
                      : "border-border-subtle bg-bg-primary hover:bg-surface-card"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-vesti-sm font-medium text-text-primary">
                        {conversation.title}
                      </span>
                      <PlatformTag platform={conversation.platform} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-vesti-xs text-text-tertiary">
                      {conversation.snippet}
                    </p>
                  </div>
                </button>
              ))}
              {filteredConversations.length === 0 && (
                <p className="text-vesti-xs text-text-tertiary">暂无匹配对话</p>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-md bg-surface-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-vesti-sm font-medium text-text-primary">
                  {selectedConversation ? selectedConversation.title : "未选择对话"}
                </p>
                <p className="text-vesti-xs text-text-tertiary">
                  {selectedConversation
                    ? `对话轮数 ${selectedConversation.message_count}`
                    : "请选择一条对话生成摘要"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={!selectedId || summaryStatus === "loading"}
                className="flex items-center gap-1 rounded-sm border border-border-default bg-bg-primary px-3 py-1.5 text-vesti-xs font-medium text-text-primary transition-colors duration-[120ms] hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-60"
              >
                {summaryStatus === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {summary ? "重新生成" : "生成摘要"}
              </button>
            </div>

            <div className="mt-3 min-h-[120px] rounded-md bg-bg-primary p-3 text-vesti-sm text-text-primary">
              {summaryStatus === "loading" && !summary && (
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在生成摘要...
                </div>
              )}
              {summaryStatus === "error" && (
                <p className="text-vesti-xs text-danger">{summaryError}</p>
              )}
              {!summary && summaryStatus !== "loading" && summaryStatus !== "error" && (
                <p className="text-vesti-xs text-text-tertiary">暂无摘要内容</p>
              )}
              {summary && (
                <pre className="whitespace-pre-wrap font-sans text-vesti-sm leading-[1.7] text-text-primary">
                  {summary.content}
                </pre>
              )}
            </div>

            {summary && (
              <div className="mt-2 text-vesti-xs text-text-tertiary">
                模型：{summary.modelId} · 生成时间：{formatDateTime(summary.createdAt)}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-vesti-sm font-medium text-text-secondary">
            <CalendarRange className="h-4 w-4" strokeWidth={1.75} />
            周报生成
          </h2>

          <div className="rounded-md bg-surface-card p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-text-tertiary">开始日期</label>
                <input
                  type="date"
                  value={rangeStartInput}
                  onChange={(e) => setRangeStartInput(e.target.value)}
                  className="h-8 rounded-sm border border-border-default bg-bg-primary px-2 text-vesti-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-text-tertiary">结束日期</label>
                <input
                  type="date"
                  value={rangeEndInput}
                  onChange={(e) => setRangeEndInput(e.target.value)}
                  className="h-8 rounded-sm border border-border-default bg-bg-primary px-2 text-vesti-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyRange}
                className="h-8 rounded-sm border border-border-default bg-bg-primary px-3 text-vesti-xs font-medium text-text-primary transition-colors duration-[120ms] hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                应用
              </button>
              <button
                type="button"
                onClick={handleGenerateWeekly}
                disabled={weeklyStatus === "loading"}
                className="ml-auto flex h-8 items-center gap-1 rounded-sm border border-border-default bg-bg-primary px-3 text-vesti-xs font-medium text-text-primary transition-colors duration-[120ms] hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-60"
              >
                {weeklyStatus === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {weeklyReport ? "重新生成" : "生成周报"}
              </button>
            </div>

            <div className="mt-3 min-h-[120px] rounded-md bg-bg-primary p-3 text-vesti-sm text-text-primary">
              {weeklyStatus === "loading" && !weeklyReport && (
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在生成周报...
                </div>
              )}
              {weeklyStatus === "error" && (
                <p className="text-vesti-xs text-danger">{weeklyError}</p>
              )}
              {!weeklyReport && weeklyStatus !== "loading" && weeklyStatus !== "error" && (
                <p className="text-vesti-xs text-text-tertiary">暂无周报内容</p>
              )}
              {weeklyReport && (
                <pre className="whitespace-pre-wrap font-sans text-vesti-sm leading-[1.7] text-text-primary">
                  {weeklyReport.content}
                </pre>
              )}
            </div>

            {weeklyReport && (
              <div className="mt-2 text-vesti-xs text-text-tertiary">
                模型：{weeklyReport.modelId} · 生成时间：
                {formatDateTime(weeklyReport.createdAt)}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { ArrowRight, Loader2 } from "lucide-react";
import type { RagResponse, RelatedConversation, StorageApi } from "../types";

const sampleQuestions = [
  "What React performance optimization techniques have I discussed?",
  "Summarize all conversations about database architecture",
  "Find all discussions involving TypeScript type system",
];

const SEARCH_STAGES = [
  { label: "Understanding your question...", progress: 22 },
  { label: "Searching relevant conversations...", progress: 48 },
  { label: "Cross-checking related evidence...", progress: 72 },
  { label: "Drafting final answer...", progress: 88 },
];

type ExploreTabProps = {
  askKnowledgeBase?: StorageApi["askKnowledgeBase"];
  onOpenConversation?: (conversationId: number) => void;
};

export function ExploreTab({ askKnowledgeBase, onOpenConversation }: ExploreTabProps) {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<RelatedConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStageIndex, setSearchStageIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setSearchStageIndex(0);
      return;
    }

    setSearchStageIndex(0);
    const timer = setInterval(() => {
      setSearchStageIndex((prev) => (prev + 1) % SEARCH_STAGES.length);
    }, 900);
    return () => clearInterval(timer);
  }, [loading]);

  const renderedAnswer = useMemo(() => {
    if (!answer) return "";
    const html = marked.parse(answer, { gfm: true, breaks: false }) as string;
    return DOMPurify.sanitize(html);
  }, [answer]);

  const activeSearchStage = SEARCH_STAGES[searchStageIndex];

  const handleSubmit = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setSubmittedQuestion(trimmed);
    setLoading(true);
    setError(null);
    setAnswer("");
    setSources([]);

    if (!askKnowledgeBase) {
      setLoading(false);
      setError("Explore is unavailable in the current environment.");
      return;
    }

    try {
      const result = (await askKnowledgeBase(trimmed, 5)) as RagResponse;
      setAnswer(result.answer);
      setSources(result.sources ?? []);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to retrieve answer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-3xl px-8 py-16">
        {!submittedQuestion ? (
          <>
            <h1 className="text-[32px] font-serif font-normal text-text-primary text-center mb-12">
              What do you want to explore?
            </h1>

            <div className="mb-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask your knowledge base..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && question.trim()) {
                      void handleSubmit(question);
                    }
                  }}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-border-default bg-bg-primary text-base font-sans text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                />
                <button
                  onClick={() => question.trim() && void handleSubmit(question)}
                  disabled={!question.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-sans text-text-tertiary uppercase tracking-wide mb-4">
                Sample Questions
              </p>
              {sampleQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => void handleSubmit(q)}
                  className="block w-full text-left px-3.5 py-2.5 rounded-md bg-bg-surface-card hover:bg-bg-surface-card-hover text-[13px] font-sans text-text-secondary hover:text-text-primary transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Question */}
            <div className="mb-8 pb-6 border-b border-border-subtle">
              <h2 className="text-xl font-serif font-normal text-text-primary">
                {submittedQuestion}
              </h2>
            </div>

            {/* Answer */}
            <div className="mb-8">
              <div className="prose prose-slate prose-lg max-w-none prose-p:leading-relaxed prose-li:leading-relaxed prose-p:text-text-primary prose-li:text-text-primary">
                {loading ? (
                  <div className="rounded-lg border border-border-subtle bg-bg-surface-card p-4">
                    <div className="flex items-center gap-2 text-text-primary">
                      <Loader2 className="h-4 w-4 animate-spin text-accent-primary" />
                      <span className="text-[14px] font-sans font-medium">
                        {activeSearchStage.label}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
                      <div
                        className="h-full rounded-full bg-accent-primary transition-all duration-500 ease-out"
                        style={{ width: `${activeSearchStage.progress}%` }}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-3 w-[92%] animate-pulse rounded bg-bg-secondary" />
                      <div className="h-3 w-[88%] animate-pulse rounded bg-bg-secondary" />
                      <div className="h-3 w-[76%] animate-pulse rounded bg-bg-secondary" />
                    </div>
                  </div>
                ) : error ? (
                  <div className="text-base font-serif text-text-primary leading-relaxed">
                    {error}
                  </div>
                ) : answer ? (
                  <div
                    className="text-text-primary"
                    dangerouslySetInnerHTML={{ __html: renderedAnswer }}
                  />
                ) : (
                  <div className="text-base font-serif text-text-primary leading-relaxed">
                    在知识库中暂未找到相关记录
                  </div>
                )}
              </div>
            </div>

            {/* Sources */}
            <div className="pt-6 border-t border-border-subtle">
              <h3 className="text-[11px] font-sans font-medium text-text-tertiary uppercase tracking-wider mb-4">
                Sources
              </h3>
              <div className="space-y-2">
                {loading && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[13px] font-sans text-text-tertiary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-primary" />
                      <span>Retrieving sources...</span>
                    </div>
                    <div className="h-10 w-full animate-pulse rounded-lg bg-bg-surface-card" />
                    <div className="h-10 w-full animate-pulse rounded-lg bg-bg-surface-card" />
                  </div>
                )}
                {!loading && sources.length === 0 && (
                  <div className="text-[13px] font-sans text-text-tertiary">
                    No sources found yet.
                  </div>
                )}
                {!loading &&
                  sources.map((source) => {
                    return (
                      <button
                        key={source.id}
                        onClick={() => onOpenConversation?.(source.id)}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-bg-surface-card hover:bg-bg-surface-card-hover transition-all group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-sm font-sans text-text-primary truncate">
                            {source.title}
                          </span>
                        </div>
                        <span className="text-xs font-sans text-accent-primary font-medium">
                          {source.similarity}% Match
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* New Question Button */}
            <div className="mt-8 text-center">
              <button
                onClick={() => {
                  setQuestion("");
                  setSubmittedQuestion(null);
                  setAnswer("");
                  setSources([]);
                  setError(null);
                }}
                className="px-4 py-2 rounded-lg bg-bg-surface-card hover:bg-bg-surface-card-hover text-sm font-sans text-text-primary transition-all"
              >
                Ask a new question
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

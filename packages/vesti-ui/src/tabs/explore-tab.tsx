
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  CheckSquare,
  ChevronRight,
  Clipboard,
  Download,
  FileText,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Send,
  Square,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import type {
  ExploreMessage,
  ExploreMode,
  ExploreSession,
  ExploreToolCall,
  StorageApi,
  UiThemeMode,
} from "../types";

const MODE_STAGES: Record<ExploreMode, string[]> = {
  agent: [
    "Planning tools...",
    "Searching conversations...",
    "Compiling context draft...",
    "Synthesizing answer...",
  ],
  classic: ["Understanding query...", "Searching conversations...", "Synthesizing answer..."],
};

const sampleQuestions = [
  "What React performance optimization techniques have I discussed?",
  "Summarize all conversations about database architecture",
  "Find all discussions involving TypeScript type system",
];

type ExploreTabProps = {
  storage: StorageApi;
  themeMode?: UiThemeMode;
  onOpenConversation?: (conversationId: number) => void;
};

type DrawerTab = "tool_calls" | "context_draft";
type ContextSaveStatus = "idle" | "saving" | "saved" | "error";

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function groupSessionsByTime(sessions: ExploreSession[]): {
  today: ExploreSession[];
  yesterday: ExploreSession[];
  earlier: ExploreSession[];
} {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;

  return sessions.reduce(
    (groups, session) => {
      if (session.updatedAt >= startOfToday) {
        groups.today.push(session);
      } else if (session.updatedAt >= startOfYesterday) {
        groups.yesterday.push(session);
      } else {
        groups.earlier.push(session);
      }
      return groups;
    },
    { today: [], yesterday: [], earlier: [] } as {
      today: ExploreSession[];
      yesterday: ExploreSession[];
      earlier: ExploreSession[];
    }
  );
}

function summarizeToolCalls(toolCalls: ExploreToolCall[]): string {
  if (!toolCalls.length) return "No tool calls";
  const failed = toolCalls.filter((toolCall) => toolCall.status === "failed").length;
  const totalMs = toolCalls.reduce((sum, toolCall) => sum + (toolCall.durationMs || 0), 0);
  if (failed > 0) {
    return `${toolCalls.length} steps · ${failed} failed · ${(totalMs / 1000).toFixed(1)}s`;
  }
  return `${toolCalls.length} steps · ${(totalMs / 1000).toFixed(1)}s`;
}

function triggerTxtDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExploreTab({
  storage,
  themeMode = "light",
  onOpenConversation,
}: ExploreTabProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<ExploreMode>("agent");
  const [sessions, setSessions] = useState<ExploreSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExploreMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const justCreatedSessionRef = useRef<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchStageIndex, setSearchStageIndex] = useState(0);
  const [submitMode, setSubmitMode] = useState<ExploreMode>("agent");

  const [error, setError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<ExploreSession | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [drawerMessageId, setDrawerMessageId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("tool_calls");
  const [contextDraft, setContextDraft] = useState("");
  const [selectedContextConversationIds, setSelectedContextConversationIds] = useState<
    number[]
  >([]);
  const [contextSaveStatus, setContextSaveStatus] = useState<ContextSaveStatus>("idle");
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const groupedSessions = useMemo(() => groupSessionsByTime(sessions), [sessions]);
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const drawerMessage = messages.find((message) => message.id === drawerMessageId) ?? null;
  const drawerCandidates = drawerMessage?.agentMeta?.contextCandidates ?? [];
  const drawerToolCalls = drawerMessage?.agentMeta?.toolCalls ?? [];

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      if (justCreatedSessionRef.current === currentSessionId) {
        justCreatedSessionRef.current = null;
        return;
      }
      loadMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (renameTarget && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameTarget]);

  useEffect(() => {
    if (!isSubmitting) {
      setSearchStageIndex(0);
      return;
    }
    const stages = MODE_STAGES[submitMode];
    const timer = setInterval(() => {
      setSearchStageIndex((prev) => (prev + 1) % stages.length);
    }, 900);
    return () => clearInterval(timer);
  }, [isSubmitting, submitMode]);

  const loadSessions = async () => {
    if (!storage.listExploreSessions) return;
    setSessionsLoading(true);
    try {
      const data = await storage.listExploreSessions(50);
      setSessions(data);
    } catch (err) {
      console.error("[Explore] Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    if (!storage.getExploreMessages) return;
    setMessagesLoading(true);
    try {
      const data = await storage.getExploreMessages(sessionId);
      setMessages(data || []);
    } catch (err) {
      console.error("[Explore] Failed to load messages:", err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInputValue("");
    setError(null);
    setDrawerMessageId(null);
    setDrawerNotice(null);
  };

  const openDrawer = (message: ExploreMessage, tab: DrawerTab) => {
    setDrawerMessageId(message.id);
    setDrawerTab(tab);
    setDrawerNotice(null);
    setContextSaveStatus("idle");
    const nextDraft = message.agentMeta?.contextDraft ?? "";
    const candidates = message.agentMeta?.contextCandidates ?? [];
    const selectedFromMessage = message.agentMeta?.selectedContextConversationIds ?? [];
    const selected =
      selectedFromMessage.length > 0
        ? selectedFromMessage
        : candidates.map((candidate) => candidate.conversationId);
    setContextDraft(nextDraft);
    setSelectedContextConversationIds(selected);
  };

  const handleSubmit = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSubmitting) return;

    if (!storage.askKnowledgeBase) {
      setError("Explore is unavailable in the current environment.");
      return;
    }

    setSubmitMode(mode);
    setIsSubmitting(true);
    setError(null);

    const optimisticUserMessage: ExploreMessage = {
      id: generateId(),
      sessionId: currentSessionId || "temp",
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setInputValue("");

    try {
      const result = await storage.askKnowledgeBase(
        trimmed,
        currentSessionId || undefined,
        5,
        mode
      );

      if (!currentSessionId) {
        justCreatedSessionRef.current = result.sessionId;
        setCurrentSessionId(result.sessionId);
      }

      const aiMessage: ExploreMessage = {
        id: generateId(),
        sessionId: result.sessionId,
        role: "assistant",
        content: result.answer,
        sources: result.sources,
        agentMeta: result.agent,
        timestamp: Date.now(),
      };

      if (!currentSessionId) {
        setMessages([optimisticUserMessage, aiMessage]);
      } else {
        setMessages((prev) => [...prev, aiMessage]);
      }

      await loadSessions();
    } catch (err) {
      console.error("[Explore] Submit error:", err);
      setError((err as Error)?.message ?? "Failed to retrieve answer.");
      setMessages((prev) => prev.filter((message) => message.id !== optimisticUserMessage.id));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!storage.deleteExploreSession) return;
    if (!confirm("Delete this conversation?")) return;

    try {
      await storage.deleteExploreSession(sessionId);
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      await loadSessions();
    } catch (err) {
      console.error("[Explore] Failed to delete session:", err);
    }
  };

  const handleStartRename = (session: ExploreSession, event: React.MouseEvent) => {
    event.stopPropagation();
    setRenameTarget(session);
    setRenameValue(session.title);
  };

  const handleSubmitRename = async () => {
    if (!renameTarget || !storage.renameExploreSession) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renameTarget.title) {
      setRenameTarget(null);
      return;
    }

    try {
      await storage.renameExploreSession(renameTarget.id, trimmed);
      await loadSessions();
      setRenameTarget(null);
    } catch (err) {
      console.error("[Explore] Failed to rename session:", err);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const toggleContextSelection = (conversationId: number) => {
    setSelectedContextConversationIds((prev) => {
      if (prev.includes(conversationId)) {
        return prev.filter((id) => id !== conversationId);
      }
      return [...prev, conversationId];
    });
  };

  const handleSaveContextDraft = async () => {
    if (!drawerMessage) return;
    const agentMeta = drawerMessage.agentMeta;
    if (!agentMeta) return;

    const normalizedIds = selectedContextConversationIds.filter((id) =>
      drawerCandidates.some((candidate) => candidate.conversationId === id)
    );

    setContextSaveStatus("saving");
    setDrawerNotice(null);
    try {
      if (storage.updateExploreMessageContext) {
        await storage.updateExploreMessageContext(
          drawerMessage.id,
          contextDraft,
          normalizedIds
        );
      }

      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== drawerMessage.id) return message;
          return {
            ...message,
            agentMeta: {
              ...agentMeta,
              contextDraft,
              selectedContextConversationIds: normalizedIds,
            },
          };
        })
      );

      setContextSaveStatus("saved");
      setDrawerNotice(
        storage.updateExploreMessageContext
          ? "Context draft saved."
          : "Saved locally for this view (storage adapter unavailable)."
      );
    } catch (err) {
      console.error("[Explore] Failed to save context draft:", err);
      setContextSaveStatus("error");
      setDrawerNotice((err as Error)?.message ?? "Failed to save context draft.");
    }
  };

  const handleCopyContextDraft = async () => {
    if (!contextDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(contextDraft);
      setDrawerNotice("Copied to clipboard.");
    } catch {
      setDrawerNotice("Clipboard is unavailable in this environment.");
    }
  };

  const handleDownloadContextDraft = () => {
    if (!contextDraft.trim()) return;
    const filename = `explore-context-${Date.now()}.txt`;
    triggerTxtDownload(contextDraft, filename);
    setDrawerNotice(`Downloaded ${filename}.`);
  };

  const handleStartChatWithContext = () => {
    handleNewChat();
    setInputValue(contextDraft);
    setDrawerNotice(null);
    textareaRef.current?.focus();
  };
  const renderSessionItem = (session: ExploreSession) => {
    const isActive = session.id === currentSessionId;
    const isRenaming = renameTarget?.id === session.id;

    return (
      <div
        key={session.id}
        onClick={() => setCurrentSessionId(session.id)}
        className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
          isActive ? "bg-bg-surface-card-active" : "cursor-pointer hover:bg-bg-surface-card"
        }`}
      >
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSubmitRename();
                  if (event.key === "Escape") setRenameTarget(null);
                }}
                onBlur={handleSubmitRename}
                className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-sm font-sans text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-sans text-text-primary">{session.title || "Untitled"}</p>
              <p className="truncate text-xs font-sans text-text-tertiary">
                {session.preview || "No messages"}
              </p>
            </>
          )}
        </div>

        {!isRenaming && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(event) => handleStartRename(session, event)}
              className="rounded p-1 text-text-tertiary hover:bg-bg-surface-card hover:text-text-primary"
              title="Rename"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={(event) => handleDeleteSession(session.id, event)}
              className="rounded p-1 text-text-tertiary hover:bg-bg-surface-card hover:text-[#B42318]"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderToolCallItem = (toolCall: ExploreToolCall, index: number) => {
    const statusTone =
      toolCall.status === "failed"
        ? "text-danger"
        : toolCall.status === "completed"
          ? "text-success"
          : "text-text-tertiary";

    return (
      <div key={toolCall.id} className="rounded-lg border border-border-subtle bg-bg-surface-card p-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[13px] font-medium text-text-primary">
            {index + 1}. {toolCall.name}
          </p>
          <span className={`text-[11px] font-sans uppercase ${statusTone}`}>
            {toolCall.status}
          </span>
        </div>
        <p className="mb-2 text-[11px] font-sans text-text-tertiary">
          {(toolCall.durationMs / 1000).toFixed(2)}s
        </p>
        {toolCall.inputSummary && (
          <p className="mb-1 text-xs font-sans text-text-secondary">
            <span className="font-medium text-text-primary">Input:</span> {toolCall.inputSummary}
          </p>
        )}
        {toolCall.outputSummary && (
          <p className="text-xs font-sans text-text-secondary">
            <span className="font-medium text-text-primary">Output:</span> {toolCall.outputSummary}
          </p>
        )}
        {toolCall.error && (
          <p className="mt-1 text-xs font-sans text-danger">
            <span className="font-medium">Error:</span> {toolCall.error}
          </p>
        )}
      </div>
    );
  };

  const renderMessage = useCallback(
    (message: ExploreMessage) => {
      const isUser = message.role === "user";
      const html = isUser
        ? null
        : DOMPurify.sanitize(marked.parse(message.content, { gfm: true, breaks: false }) as string);

      const hasSources = message.sources && message.sources.length > 0;
      const toolCalls = message.agentMeta?.toolCalls ?? [];
      const hasToolCalls = message.agentMeta?.mode === "agent" && toolCalls.length > 0;

      return (
        <div key={message.id} className={`py-4 ${isUser ? "bg-bg-tertiary/50" : ""}`}>
          <div className="mx-auto max-w-3xl px-4">
            <div className="flex gap-4">
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                  isUser
                    ? "bg-accent-primary text-white"
                    : "border border-border-subtle bg-bg-surface-card"
                }`}
              >
                {isUser ? (
                  <span className="text-sm font-sans font-medium">U</span>
                ) : (
                  <span className="text-sm">V</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-sans text-text-tertiary">{isUser ? "You" : "Vesti"}</p>

                {isUser ? (
                  <p className="whitespace-pre-wrap text-base font-sans text-text-primary">
                    {message.content}
                  </p>
                ) : (
                  <div
                    className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-text-primary prose-li:leading-relaxed prose-li:text-text-primary"
                    dangerouslySetInnerHTML={{ __html: html || "" }}
                  />
                )}

                {!isUser && hasToolCalls && (
                  <div className="mt-3 rounded-lg border border-border-subtle bg-bg-surface-card px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() => openDrawer(message, "tool_calls")}
                        className="inline-flex items-center gap-1.5 text-xs font-sans text-text-secondary hover:text-text-primary"
                      >
                        <Wrench className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Tool Calls
                      </button>
                      <p className="text-xs font-sans text-text-tertiary">
                        {summarizeToolCalls(toolCalls)}
                      </p>
                    </div>
                    {message.agentMeta?.contextDraft && (
                      <button
                        onClick={() => openDrawer(message, "context_draft")}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-sans text-accent-primary hover:text-accent-primary/80"
                      >
                        <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open Context Draft
                      </button>
                    )}
                  </div>
                )}

                {!isUser && (
                  <div className="mt-4 border-t border-border-subtle pt-4">
                    <p className="mb-2 text-[11px] font-sans uppercase tracking-wider text-text-tertiary">
                      Sources
                    </p>
                    {hasSources ? (
                      <div className="flex flex-wrap gap-2">
                        {message.sources!.map((source) => (
                          <button
                            key={source.id}
                            onClick={() => onOpenConversation?.(source.id)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-bg-surface-card px-2.5 py-1 text-xs font-sans text-text-secondary transition-colors hover:bg-bg-surface-card-hover"
                          >
                            <span className="max-w-[120px] truncate">{source.title}</span>
                            <span className="text-accent-primary">{source.similarity}%</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-sans italic text-text-tertiary">
                        No relevant conversations found
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    },
    [onOpenConversation]
  );

  const renderEmptyState = () => (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-2xl text-center">
        <h1 className="mb-4 text-[32px] font-serif font-normal text-text-primary">
          What do you want to explore?
        </h1>
        <p className="mb-8 font-sans text-text-secondary">
          Ask questions about your conversation history
        </p>

        <div className="mx-auto max-w-lg space-y-3 text-left">
          {sampleQuestions.map((question) => (
            <button
              key={question}
              onClick={() => {
                setInputValue(question);
                textareaRef.current?.focus();
              }}
              className="w-full rounded-lg bg-bg-surface-card px-4 py-3 text-left text-[14px] font-sans text-text-secondary transition-all hover:bg-bg-surface-card-hover hover:text-text-primary"
            >
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-accent-primary" />
                {question}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full">
      <div
        className={`border-r border-border-subtle bg-bg-tertiary transition-all duration-200 ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border-subtle p-3">
            <button
              onClick={handleNewChat}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                themeMode === "dark"
                  ? "bg-bg-secondary text-text-primary hover:bg-bg-surface-card-hover"
                  : "bg-accent-primary text-white hover:bg-accent-primary/90"
              }`}
            >
              <MessageSquarePlus className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-sm font-sans font-medium">New Chat</span>
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-2">
            {sessionsLoading ? (
              <div className="py-4 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-accent-primary" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-4 text-center text-xs font-sans text-text-tertiary">
                No conversations yet
              </div>
            ) : (
              <>
                {groupedSessions.today.length > 0 && (
                  <div>
                    <p className="px-3 py-1 text-[10px] font-sans uppercase tracking-wider text-text-tertiary">
                      Today
                    </p>
                    <div className="space-y-0.5">{groupedSessions.today.map(renderSessionItem)}</div>
                  </div>
                )}
                {groupedSessions.yesterday.length > 0 && (
                  <div>
                    <p className="px-3 py-1 text-[10px] font-sans uppercase tracking-wider text-text-tertiary">
                      Yesterday
                    </p>
                    <div className="space-y-0.5">
                      {groupedSessions.yesterday.map(renderSessionItem)}
                    </div>
                  </div>
                )}
                {groupedSessions.earlier.length > 0 && (
                  <div>
                    <p className="px-3 py-1 text-[10px] font-sans uppercase tracking-wider text-text-tertiary">
                      Earlier
                    </p>
                    <div className="space-y-0.5">{groupedSessions.earlier.map(renderSessionItem)}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col bg-bg-primary ${drawerMessage ? "pr-[390px]" : ""}`}>
        <div className="flex h-12 items-center justify-between border-b border-border-subtle px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-bg-surface-card hover:text-text-primary"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
            {currentSession && (
              <h2 className="max-w-[200px] truncate text-sm font-sans text-text-primary">
                {currentSession.title}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border-subtle bg-bg-surface-card p-0.5">
              <button
                onClick={() => setMode("agent")}
                className={`rounded px-2.5 py-1 text-xs font-sans transition-colors ${
                  mode === "agent"
                    ? "bg-accent-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Agent
              </button>
              <button
                onClick={() => setMode("classic")}
                className={`rounded px-2.5 py-1 text-xs font-sans transition-colors ${
                  mode === "classic"
                    ? "bg-accent-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Classic
              </button>
            </div>
            {currentSessionId && (
              <button
                onClick={handleNewChat}
                className="rounded-lg bg-bg-surface-card px-3 py-1.5 text-sm font-sans text-text-primary transition-colors hover:bg-bg-surface-card-hover"
              >
                New Chat
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !currentSessionId ? (
            renderEmptyState()
          ) : messagesLoading && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
            </div>
          ) : (
            <>
              {messages.map(renderMessage)}

              {isSubmitting && (
                <div className="py-4">
                  <div className="mx-auto max-w-3xl px-4">
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-bg-surface-card">
                        <span className="text-sm">V</span>
                      </div>
                      <div className="flex-1">
                        <p className="mb-1 text-xs font-sans text-text-tertiary">Vesti</p>
                        <div className="flex items-center gap-2 text-text-primary">
                          <Loader2 className="h-4 w-4 animate-spin text-accent-primary" />
                          <span className="text-sm font-sans">
                            {MODE_STAGES[submitMode][searchStageIndex]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="py-4">
                  <div className="mx-auto max-w-3xl px-4">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-sans text-red-700">{error}</p>
                      <button
                        onClick={() => setError(null)}
                        className="mt-2 text-xs font-sans text-red-600 hover:text-red-800"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        <div className="border-t border-border-subtle p-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative flex items-end gap-2 rounded-lg border border-border-default bg-bg-primary transition-all focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === "agent"
                    ? "Ask your knowledge base (Agent mode)..."
                    : "Ask your knowledge base (Classic mode)..."
                }
                rows={1}
                className="max-h-32 flex-1 resize-none bg-transparent px-4 py-3 text-base font-sans text-text-primary placeholder:text-text-tertiary focus:outline-none"
                style={{ minHeight: "48px" }}
              />
              <div className="p-2">
                <button
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || isSubmitting}
                  className="rounded-md bg-accent-primary p-2 text-white transition-all hover:bg-accent-primary/90 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-xs font-sans text-text-tertiary">
              {mode === "agent"
                ? "Agent mode shows tool calls and lets you edit/export context drafts."
                : "Classic mode searches your history and returns concise source-grounded answers."}
            </p>
          </div>
        </div>
      </div>

      {drawerMessage && (
        <aside className="absolute bottom-0 right-0 top-0 z-20 flex w-[390px] flex-col border-l border-border-subtle bg-bg-primary shadow-[0_0_24px_rgba(0,0,0,0.12)]">
          <div className="flex h-12 items-center justify-between border-b border-border-subtle px-3">
            <div className="flex min-w-0 items-center gap-2">
              <Wrench className="h-4 w-4 text-text-secondary" strokeWidth={1.7} />
              <p className="truncate text-sm font-sans text-text-primary">Execution Details</p>
            </div>
            <button
              onClick={() => setDrawerMessageId(null)}
              className="rounded-md p-1 text-text-tertiary hover:bg-bg-surface-card hover:text-text-primary"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>

          <div className="border-b border-border-subtle px-3 py-2">
            <div className="inline-flex rounded-md border border-border-subtle bg-bg-surface-card p-0.5">
              <button
                onClick={() => setDrawerTab("tool_calls")}
                className={`rounded px-2.5 py-1 text-xs font-sans transition-colors ${
                  drawerTab === "tool_calls"
                    ? "bg-accent-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Tool Calls
              </button>
              <button
                onClick={() => setDrawerTab("context_draft")}
                className={`rounded px-2.5 py-1 text-xs font-sans transition-colors ${
                  drawerTab === "context_draft"
                    ? "bg-accent-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Context Draft
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {drawerTab === "tool_calls" ? (
              <div className="space-y-3">
                {drawerToolCalls.length > 0 ? (
                  drawerToolCalls.map(renderToolCallItem)
                ) : (
                  <p className="text-sm font-sans text-text-tertiary">
                    No tool calls were recorded for this answer.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-sans uppercase tracking-wider text-text-tertiary">
                    Candidate Sources
                  </p>
                  {drawerCandidates.length > 0 ? (
                    <div className="space-y-2">
                      {drawerCandidates.map((candidate) => {
                        const selected = selectedContextConversationIds.includes(
                          candidate.conversationId
                        );
                        return (
                          <div
                            key={candidate.conversationId}
                            className="rounded-lg border border-border-subtle bg-bg-surface-card p-2.5"
                          >
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <button
                                onClick={() => toggleContextSelection(candidate.conversationId)}
                                className="inline-flex items-center gap-1.5 text-left text-xs font-sans text-text-secondary hover:text-text-primary"
                              >
                                {selected ? (
                                  <CheckSquare className="h-3.5 w-3.5 text-accent-primary" />
                                ) : (
                                  <Square className="h-3.5 w-3.5" />
                                )}
                                <span className="line-clamp-2">{candidate.title}</span>
                              </button>
                              <span className="text-[11px] font-sans text-accent-primary">
                                {candidate.similarity}%
                              </span>
                            </div>
                            {candidate.summarySnippet && (
                              <p className="mb-1 text-xs font-sans text-text-secondary">
                                {candidate.summarySnippet}
                              </p>
                            )}
                            {candidate.excerpt && (
                              <p className="text-[11px] font-sans text-text-tertiary">
                                {candidate.excerpt}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm font-sans text-text-tertiary">
                      No context candidates for this answer.
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-sans uppercase tracking-wider text-text-tertiary">
                    Draft (Editable)
                  </p>
                  <textarea
                    value={contextDraft}
                    onChange={(event) => {
                      setContextDraft(event.target.value);
                      setContextSaveStatus("idle");
                    }}
                    rows={14}
                    className="w-full resize-y rounded-lg border border-border-default bg-bg-primary p-3 text-sm font-sans text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                </div>

                {drawerNotice && (
                  <p
                    className={`text-xs font-sans ${
                      contextSaveStatus === "error" ? "text-danger" : "text-text-secondary"
                    }`}
                  >
                    {drawerNotice}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveContextDraft}
                    disabled={contextSaveStatus === "saving"}
                    className="rounded-md bg-accent-primary px-3 py-1.5 text-xs font-sans text-white transition-colors hover:bg-accent-primary/90 disabled:opacity-50"
                  >
                    {contextSaveStatus === "saving" ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCopyContextDraft}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-xs font-sans text-text-secondary hover:bg-bg-surface-card"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    onClick={handleDownloadContextDraft}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-xs font-sans text-text-secondary hover:bg-bg-surface-card"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download TXT
                  </button>
                  <button
                    onClick={handleStartChatWithContext}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-xs font-sans text-text-secondary hover:bg-bg-surface-card"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    New Chat (Prefill)
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

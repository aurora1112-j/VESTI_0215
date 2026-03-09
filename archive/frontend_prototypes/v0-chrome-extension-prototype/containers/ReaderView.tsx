// ============================================================
// --- containers/ReaderView.tsx ---
// Container: fetches messages for a conversation, renders stream.
// Sticky header with back button, platform tag, turn count.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare } from "lucide-react";
import type { Conversation, Message } from "@/types";
import { getMessages } from "@/services/mockService";
import { PlatformTag } from "@/components/PlatformTag";
import { MessageBubble } from "@/components/MessageBubble";

interface ReaderViewProps {
  conversation: Conversation;
  onBack: () => void;
}

export function ReaderView({ conversation, onBack }: ReaderViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMessages(conversation.id).then((data) => {
      if (!cancelled) {
        setMessages(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [conversation.id]);

  return (
    <div className="flex h-full flex-col">
      {/* Sticky Header — 44px */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle bg-bg-primary px-4">
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-sm text-text-secondary transition-colors duration-[120ms] hover:bg-accent-primary-light hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <h2 className="min-w-0 flex-1 truncate text-vesti-base font-semibold text-text-primary tracking-tight">
          {conversation.title}
        </h2>

        <PlatformTag platform={conversation.platform} />

        <span className="flex items-center gap-1 text-vesti-xs text-text-tertiary">
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
          {conversation.message_count}
        </span>
      </header>

      {/* Message stream */}
      <div className="flex-1 overflow-y-auto vesti-scroll">
        {loading ? (
          <div className="flex flex-col gap-4 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-12 animate-pulse rounded bg-surface-card" />
                <div className="h-20 animate-pulse rounded-md bg-surface-card" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-vesti-sm text-text-tertiary">
              暂无消息记录
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                platform={conversation.platform}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

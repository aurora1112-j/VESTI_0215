// ============================================================
// --- containers/ConversationList.tsx ---
// Container: fetches data from mockService, renders card list.
// ============================================================
"use client";

import { useEffect, useState, useMemo } from "react";
import type { Conversation } from "@/types";
import { getConversations } from "@/services/mockService";
import { ConversationCard } from "@/components/ConversationCard";

interface ConversationListProps {
  searchQuery: string;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationList({
  searchQuery,
  onSelect,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getConversations({ search: searchQuery || undefined }).then((data) => {
      if (!cancelled) {
        setConversations(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const grouped = useMemo(() => {
    const now = Date.now();
    const today: Conversation[] = [];
    const week: Conversation[] = [];
    const older: Conversation[] = [];

    for (const c of conversations) {
      const diff = now - c.updated_at;
      if (diff < 86_400_000) today.push(c);
      else if (diff < 604_800_000) week.push(c);
      else older.push(c);
    }

    const groups: { label: string; items: Conversation[] }[] = [];
    if (today.length > 0) groups.push({ label: "今天", items: today });
    if (week.length > 0) groups.push({ label: "本周", items: week });
    if (older.length > 0) groups.push({ label: "更早", items: older });
    return groups;
  }, [conversations]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-md bg-surface-card"
          />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-vesti-sm text-text-tertiary">
          {searchQuery ? "没有找到匹配的对话" : "暂无对话记录"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 vesti-scroll overflow-y-auto px-4 pb-4">
      {grouped.map((group) => (
        <div key={group.label}>
          <h4 className="sticky top-0 z-10 bg-bg-tertiary pb-1 pt-3 -mx-4 px-4 text-vesti-xs font-medium text-text-tertiary">
            {group.label}
          </h4>
          <div className="flex flex-col gap-2">
            {group.items.map((c) => (
              <ConversationCard
                key={c.id}
                conversation={c}
                onClick={() => onSelect(c)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

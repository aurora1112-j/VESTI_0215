// ============================================================
// --- pages/TimelinePage.tsx ---
// Home page: Status Bar + Search + Conversation List
// ============================================================
"use client";

import { useState } from "react";
import { LOGO_BASE64 } from "@/constants/logo";
import type { Conversation } from "@/types";
import { SearchInput } from "@/components/SearchInput";
import { ConversationList } from "@/containers/ConversationList";

interface TimelinePageProps {
  onSelectConversation: (conversation: Conversation) => void;
}

export function TimelinePage({ onSelectConversation }: TimelinePageProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-full flex-col bg-bg-tertiary">
      {/* Status Bar — 32px */}
      <header className="flex h-8 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-1.5">
          {/* Logo + App name */}
          <img src={LOGO_BASE64} alt="心迹 Vesti" width={20} height={20} />
          <span className="text-vesti-base font-semibold text-text-primary tracking-tight">
            心迹
          </span>
          <span className="text-vesti-xs text-accent-primary font-medium">
            Vesti
          </span>
        </div>
        <span className="text-vesti-xs text-text-tertiary">
          10 conversations · +3 today
        </span>
      </header>

      {/* Search */}
      <div className="shrink-0 px-4 pb-2">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Conversation card list (scrollable) */}
      <div className="min-h-0 flex-1">
        <ConversationList
          searchQuery={searchQuery}
          onSelect={onSelectConversation}
        />
      </div>
    </div>
  );
}

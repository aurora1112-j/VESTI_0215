import { useEffect, useState } from "react";
import { LOGO_BASE64 } from "~lib/ui/logo";
import type { Conversation, DashboardStats } from "~lib/types";
import { getDashboardStats } from "~lib/services/storageService";
import { SearchInput } from "../components/SearchInput";
import { ConversationList } from "../containers/ConversationList";

interface TimelinePageProps {
  onSelectConversation: (conversation: Conversation) => void;
  refreshToken: number;
}

export function TimelinePage({ onSelectConversation, refreshToken }: TimelinePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDashboardStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const totalConversations = stats?.totalConversations ?? 0;
  const todayCount = stats?.todayCount ?? 0;

  return (
    <div className="flex h-full flex-col bg-bg-app">
      <header className="flex h-8 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={LOGO_BASE64} alt="Vesti" width={20} height={20} />
          <span className="vesti-brand-wordmark text-[14px] text-text-primary">
            Vesti
          </span>
        </div>
        <span className="text-vesti-xs text-text-tertiary">
          {totalConversations} conversations · +{todayCount} today
        </span>
      </header>

      <div className="shrink-0 px-4 pb-2">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
      </div>

      <div className="min-h-0 flex-1">
        <ConversationList
          searchQuery={searchQuery}
          onSelect={onSelectConversation}
          refreshToken={refreshToken}
        />
      </div>
    </div>
  );
}

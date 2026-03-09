// ============================================================
// --- pages/DashboardPage.tsx ---
// Analytics: KPI cards + Heatmap + Platform Distribution
// ============================================================
"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Type,
  Flame,
  CalendarDays,
} from "lucide-react";
import type { DashboardStats, Platform } from "@/types";
import { getDashboardStats } from "@/services/mockService";
import { KpiCard } from "@/components/KpiCard";

const PLATFORM_COLORS: Record<Platform, string> = {
  ChatGPT: "bg-chatgpt-bg",
  Claude: "bg-claude-bg",
  Gemini: "bg-gemini-bg",
  DeepSeek: "bg-deepseek-bg",
};

const HEATMAP_LEVELS = [
  "bg-border-subtle",
  "heatmap-l1",
  "heatmap-l2",
  "heatmap-l3",
  "heatmap-l4",
];

function getHeatmapClass(count: number): string {
  if (count === 0) return HEATMAP_LEVELS[0];
  if (count <= 1) return HEATMAP_LEVELS[1];
  if (count <= 3) return HEATMAP_LEVELS[2];
  if (count <= 5) return HEATMAP_LEVELS[3];
  return HEATMAP_LEVELS[4];
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
      </div>
    );
  }

  const totalPlatform = Object.values(stats.platformDistribution).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto vesti-scroll bg-bg-tertiary">
      {/* Header */}
      <header className="flex h-8 shrink-0 items-center px-4">
        <h1 className="text-vesti-xl font-semibold text-text-primary">
          Dashboard
        </h1>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            icon={<BookOpen className="h-4 w-4" strokeWidth={1.75} />}
            label="Knowledge Base"
            value={stats.totalConversations}
            suffix="conversations"
          />
          <KpiCard
            icon={<Type className="h-4 w-4" strokeWidth={1.75} />}
            label="Tokens"
            value={`${(stats.totalTokens / 1_000_000).toFixed(1)}M`}
          />
          <KpiCard
            icon={<Flame className="h-4 w-4" strokeWidth={1.75} />}
            label="Active Streak"
            value={stats.activeStreak}
            suffix="days"
          />
          <KpiCard
            icon={<CalendarDays className="h-4 w-4" strokeWidth={1.75} />}
            label="Today"
            value={stats.todayCount}
            suffix="conversations"
          />
        </div>

        {/* Contribution Heatmap */}
        <section>
          <h2 className="mb-2 text-vesti-sm font-medium text-text-secondary">
            Activity Heatmap
          </h2>
          <div className="rounded-md bg-surface-card p-3">
            <div
              className="grid gap-[3px]"
              style={{
                gridTemplateColumns: "repeat(52, 1fr)",
                gridAutoRows: "10px",
              }}
            >
              {stats.heatmapData.slice(-364).map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count} conversations`}
                  className={`rounded-[2px] ${getHeatmapClass(d.count)}`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="mt-2 flex items-center justify-end gap-1">
              <span className="text-[10px] text-text-tertiary">Less</span>
              {HEATMAP_LEVELS.map((cls) => (
                <div
                  key={cls}
                  className={`h-[10px] w-[10px] rounded-[2px] ${cls}`}
                />
              ))}
              <span className="text-[10px] text-text-tertiary">More</span>
            </div>
          </div>
        </section>

        {/* Platform Distribution */}
        <section>
          <h2 className="mb-2 text-vesti-sm font-medium text-text-secondary">
            Platform Distribution
          </h2>
          <div className="flex flex-col gap-2 rounded-md bg-surface-card p-3">
            {(
              Object.entries(stats.platformDistribution) as [
                Platform,
                number,
              ][]
            ).map(([platform, count]) => (
              <div key={platform} className="flex items-center gap-2">
                <span className="w-16 text-vesti-xs font-medium text-text-primary">
                  {platform}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-border-subtle">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${PLATFORM_COLORS[platform]}`}
                    style={{
                      width: `${(count / totalPlatform) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-vesti-xs text-text-tertiary tabular-nums">
                  {count}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

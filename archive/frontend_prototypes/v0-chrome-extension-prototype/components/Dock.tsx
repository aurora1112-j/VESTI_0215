// ============================================================
// --- components/Dock.tsx ---
// Right-side navigation dock. 48px wide, bg-secondary.
// Icons: 20px, default text-secondary, selected accent-primary.
// ============================================================
"use client";

import React from "react";

import { LOGO_BASE64 } from "@/constants/logo";
import {
  Home,
  Sparkles,
  BarChart3,
  Settings,
  HardDrive,
} from "lucide-react";
import type { PageId } from "@/types";

interface DockItem {
  id: PageId;
  icon: React.ReactNode;
  label: string;
}

const DOCK_ITEMS_TOP: DockItem[] = [
  {
    id: "timeline",
    icon: <Home className="h-5 w-5" strokeWidth={1.75} />,
    label: "??",
  },
  {
    id: "insights",
    icon: <Sparkles className="h-5 w-5" strokeWidth={1.75} />,
    label: "??",
  },
  {
    id: "dashboard",
    icon: <BarChart3 className="h-5 w-5" strokeWidth={1.75} />,
    label: "??",
  },
];

const DOCK_ITEMS_BOTTOM: DockItem[] = [
  {
    id: "settings",
    icon: <Settings className="h-5 w-5" strokeWidth={1.75} />,
    label: "??",
  },
];

interface DockProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export function Dock({ currentPage, onNavigate }: DockProps) {
  return (
    <nav
      aria-label="???"
      className="flex w-12 flex-col items-center justify-between border-l border-border-subtle bg-bg-secondary py-3"
    >
      {/* Top items */}
      <div className="flex flex-col items-center gap-1">
        <div className="mb-2 flex items-center justify-center">
          <img src={LOGO_BASE64} alt="心迹 Vesti" width={24} height={24} />
        </div>
        {DOCK_ITEMS_TOP.map((item) => (
          <DockButton
            key={item.id}
            item={item}
            isActive={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label="??"
          className="flex h-9 w-9 items-center justify-center rounded-sm text-text-secondary transition-colors duration-[120ms] hover:bg-accent-primary-light hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <HardDrive className="h-5 w-5" strokeWidth={1.75} />
        </button>
        {DOCK_ITEMS_BOTTOM.map((item) => (
          <DockButton
            key={item.id}
            item={item}
            isActive={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>
    </nav>
  );
}

function DockButton({
  item,
  isActive,
  onClick,
}: {
  item: DockItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-sm transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${
        isActive
          ? "bg-accent-primary-light text-accent-primary"
          : "text-text-secondary hover:bg-accent-primary-light hover:text-accent-primary"
      }`}
    >
      {item.icon}
    </button>
  );
}

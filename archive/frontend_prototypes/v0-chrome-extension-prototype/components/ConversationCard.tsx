// ============================================================
// --- components/ConversationCard.tsx ---
// Pure display component: renders a single conversation card.
// Default: compact (title + tag + time). Hover: expand snippet + actions.
// ============================================================
"use client";

import React from "react";

import { useState } from "react";
import { MessageSquare, Pencil, ExternalLink, Trash2 } from "lucide-react";
import type { Conversation } from "@/types";
import { PlatformTag } from "@/components/PlatformTag";

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  return `${months} 个月前`;
}

interface ConversationCardProps {
  conversation: Conversation;
  onClick: () => void;
  onDelete?: (id: number) => void;
}

export function ConversationCard({
  conversation,
  onClick,
  onDelete,
}: ConversationCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onFocus={() => setIsHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsHovered(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group w-full cursor-pointer rounded-md p-3 text-left transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${
        isHovered
          ? "bg-surface-card-hover shadow-card-hover"
          : "bg-surface-card"
      }`}
    >
      {/* Top row: platform tag + relative time */}
      <div className="flex items-center justify-between">
        <PlatformTag platform={conversation.platform} />
        <span className="text-vesti-xs text-text-tertiary">
          {formatRelativeTime(conversation.updated_at)}
        </span>
      </div>

      {/* Title */}
      <h3 className="mt-1.5 truncate text-vesti-base font-medium text-text-primary tracking-tight">
        {conversation.title}
      </h3>

      {/* Hover expansion: snippet + actions */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-150 ease-in-out ${
          isHovered
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          {/* Snippet */}
          <p className="mt-1.5 line-clamp-2 text-vesti-sm text-text-secondary leading-[1.5]">
            {conversation.snippet}
          </p>

          {/* Bottom row: turn count + action buttons */}
          <div className="mt-2 flex items-center justify-between">
            <span className="flex items-center gap-1 text-vesti-xs text-text-tertiary">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
              {conversation.message_count} 轮
            </span>

            <div className="flex items-center gap-0.5">
              <GhostIconButton
                icon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}
                label="编辑"
                onClick={(e) => e.stopPropagation()}
              />
              <GhostIconButton
                icon={
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                }
                label="在原平台打开"
                onClick={(e) => e.stopPropagation()}
              />
              <GhostIconButton
                icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />}
                label="删除"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(conversation.id);
                }}
                danger
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GhostIconButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${
        danger
          ? "text-text-tertiary hover:bg-danger/10 hover:text-danger"
          : "text-text-tertiary hover:bg-accent-primary-light hover:text-accent-primary"
      }`}
    >
      {icon}
    </button>
  );
}

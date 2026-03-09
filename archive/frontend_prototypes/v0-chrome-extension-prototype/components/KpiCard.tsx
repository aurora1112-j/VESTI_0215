// ============================================================
// --- components/KpiCard.tsx ---
// Dashboard KPI card: icon + large number + label
// ============================================================
"use client";

import React from "react"

interface KpiCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  suffix?: string;
}

export function KpiCard({ icon, value, label, suffix }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-card p-4">
      <div className="flex items-center gap-2 text-text-tertiary">
        {icon}
        <span className="text-vesti-xs font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-vesti-2xl font-bold text-text-primary tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {suffix && (
          <span className="text-vesti-xs text-text-tertiary">{suffix}</span>
        )}
      </div>
    </div>
  );
}

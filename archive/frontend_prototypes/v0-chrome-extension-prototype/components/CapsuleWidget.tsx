// ============================================================
// --- components/CapsuleWidget.tsx ---
// Preview component simulating the injected capsule floating bar.
// Shows different states: RECORDING, STANDBY, PAUSED, SAVED.
// ============================================================
"use client";

import { Save } from "lucide-react";
import { LOGO_BASE64 } from "@/constants/logo";
import type { CapsuleState } from "@/types";

const STATE_CONFIG: Record<
  CapsuleState,
  { label: string; dotColor: string; dotAnimate: boolean }
> = {
  RECORDING: {
    label: "自动保存中",
    dotColor: "bg-success",
    dotAnimate: true,
  },
  STANDBY: {
    label: "待命中",
    dotColor: "bg-text-tertiary",
    dotAnimate: false,
  },
  PAUSED: {
    label: "已暂停",
    dotColor: "bg-warning",
    dotAnimate: false,
  },
  SAVED: {
    label: "已保存",
    dotColor: "bg-success",
    dotAnimate: false,
  },
};

interface CapsuleWidgetProps {
  state: CapsuleState;
}

export function CapsuleWidget({ state }: CapsuleWidgetProps) {
  const config = STATE_CONFIG[state];
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full bg-capsule-bg px-4 py-2 shadow-capsule backdrop-blur-[12px] z-[2147483646]">
      {/* Logo */}
      <img
        src={LOGO_BASE64}
        alt="心迹 Vesti"
        width={20}
        height={20}
        style={{ filter: "invert(1)" }}
      />

      {/* Status dot */}
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inset-0 rounded-full ${config.dotColor} ${
            config.dotAnimate ? "animate-breathing" : ""
          }`}
        />
      </span>

      {/* Status text */}
      <span className="text-vesti-xs text-text-inverse/80">
        {config.label}
      </span>

      {/* Save icon */}
      <button
        type="button"
        aria-label="保存"
        className="flex h-5 w-5 items-center justify-center rounded-full text-text-inverse/60 transition-colors duration-[120ms] hover:text-text-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-inverse/30"
      >
        <Save className="h-3 w-3" strokeWidth={1.75} />
      </button>
    </div>
  );
}

// ============================================================
// --- App.tsx ---
// Main Shell: SidePanel container (380px) + Dock + Page routing.
// Conditional rendering via currentPage state (no router needed).
// ============================================================
"use client";

import { useState } from "react";
import type { Conversation, PageId } from "@/types";
import { Dock } from "@/components/Dock";
import { CapsuleWidget } from "@/components/CapsuleWidget";
import { TimelinePage } from "@/pages/TimelinePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { InsightsPage } from "@/pages/InsightsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ReaderView } from "@/containers/ReaderView";

export function VestiApp() {
  const [currentPage, setCurrentPage] = useState<PageId>("timeline");
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  const handleNavigate = (page: PageId) => {
    setCurrentPage(page);
    setSelectedConversation(null);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-bg-tertiary px-4 py-6">
      {/* SidePanel Container ? simulates Chrome 380px side panel */}
      <div className="flex h-screen w-[380px] overflow-hidden rounded-lg border border-border-default bg-bg-primary shadow-popover">
        {/* Main content area */}
        <main className="min-w-0 flex-1">
          {selectedConversation && currentPage === "timeline" ? (
            <ReaderView
              conversation={selectedConversation}
              onBack={handleBack}
            />
          ) : currentPage === "timeline" ? (
            <TimelinePage
              onSelectConversation={handleSelectConversation}
            />
          ) : currentPage === "dashboard" ? (
            <DashboardPage />
          ) : currentPage === "insights" ? (
            <InsightsPage />
          ) : currentPage === "settings" ? (
            <SettingsPage />
          ) : null}
        </main>

        {/* Dock ? fixed right side, 48px */}
        <Dock currentPage={currentPage} onNavigate={handleNavigate} />
      </div>

      {/* Capsule Widget Demo ? below the panel for preview */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-vesti-xs font-medium text-text-tertiary">
          Capsule Widget Preview
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <CapsuleWidget state="RECORDING" />
          <CapsuleWidget state="STANDBY" />
          <CapsuleWidget state="SAVED" />
          <CapsuleWidget state="PAUSED" />
        </div>
      </div>
    </div>
  );
}

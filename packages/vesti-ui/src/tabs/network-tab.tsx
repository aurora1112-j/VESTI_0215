"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StorageApi, UiThemeMode } from "../types";
import { useLibraryData } from "../contexts/library-data";
import { GraphLegend } from "./network/GraphLegend";
import { TemporalGraph } from "./network/TemporalGraph";
import { TimeBar } from "./network/TimeBar";
import {
  GRAPH_HEIGHT,
  buildTemporalNetworkDataset,
  dayToProgress,
  getVisibleConversationCount,
  progressToDay,
  type GraphEdge,
} from "./network/temporal-graph-utils";

interface NetworkTabProps {
  storage: StorageApi;
  themeMode?: UiThemeMode;
  isActive?: boolean;
  onSelectConversation?: (id: number) => void;
}

type EdgeStatus = "idle" | "loading" | "ready" | "error";

const PLAYBACK_DURATION_MS = 8_000;

function formatDefaultInfo(totalDays: number) {
  if (totalDays <= 0) return "No conversations captured yet.";
  return "This replay runs the full timeline in 8 seconds, even when everything was captured today.";
}

function formatBirthInfo(label: string, platform: string) {
  if (label.trim().toLowerCase() === platform.trim().toLowerCase()) {
    return `+ New conversation on ${platform}`;
  }
  return `+ ${label} \u00b7 ${platform}`;
}

export function NetworkTab({
  storage,
  themeMode = "light",
  isActive = true,
  onSelectConversation,
}: NetworkTabProps) {
  const { conversations } = useLibraryData();
  const [currentDay, setCurrentDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [playbackToken, setPlaybackToken] = useState(0);
  const [infoText, setInfoText] = useState("No conversations captured yet.");
  const [graphResetToken, setGraphResetToken] = useState(0);
  const [scrubToken, setScrubToken] = useState(0);
  const [edgeStatus, setEdgeStatus] = useState<EdgeStatus>("idle");
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const playbackOriginRef = useRef<number | null>(null);
  const playbackStartProgressRef = useRef(0);
  const currentDayRef = useRef(0);
  const previousDayRef = useRef(0);
  const previousScrubTokenRef = useRef(0);
  const previousIsActiveRef = useRef(isActive);
  const previousTotalDaysRef = useRef(0);

  const dataset = useMemo(
    () => buildTemporalNetworkDataset(conversations, edges),
    [conversations, edges]
  );
  const baseDataset = useMemo(
    () => buildTemporalNetworkDataset(conversations, []),
    [conversations]
  );
  const totalDays = dataset.data.totalDays;
  const conversationIdsKey = useMemo(
    () => baseDataset.data.nodes.map((node) => node.id).join(","),
    [baseDataset.data.nodes]
  );
  const visibleCount = useMemo(
    () => getVisibleConversationCount(dataset.data.nodes, currentDay),
    [currentDay, dataset.data.nodes]
  );

  useEffect(() => {
    currentDayRef.current = currentDay;
  }, [currentDay]);

  const stopPlayback = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    playbackOriginRef.current = null;
    setPlaying(false);
  }, []);

  const resetTimeline = useCallback(
    (
      nextDay = 0,
      options: {
        hardReset?: boolean;
        scrub?: boolean;
        nextInfoText?: string;
      } = {}
    ) => {
      const { hardReset = true, scrub = false, nextInfoText } = options;
      const clampedDay = Math.max(0, Math.min(totalDays, nextDay));

      stopPlayback();
      setCurrentDay(clampedDay);
      currentDayRef.current = clampedDay;
      previousDayRef.current = clampedDay;

      if (hardReset) {
        setGraphResetToken((token) => token + 1);
      }

      if (scrub) {
        setScrubToken((token) => token + 1);
      } else {
        previousScrubTokenRef.current = 0;
        setScrubToken(0);
      }

      if (typeof nextInfoText === "string") {
        setInfoText(nextInfoText);
      }
    },
    [stopPlayback, totalDays]
  );

  const startReplay = useCallback(() => {
    if (totalDays <= 0) return;

    resetTimeline(0, {
      hardReset: true,
      scrub: false,
      nextInfoText: formatDefaultInfo(totalDays),
    });
    setScrubbing(false);
    playbackStartProgressRef.current = 0;
    setPlaybackToken((token) => token + 1);
    setPlaying(true);
  }, [resetTimeline, totalDays]);

  useEffect(() => {
    const conversationIds = baseDataset.data.nodes.map((node) => node.id);
    let cancelled = false;

    if (conversationIds.length < 2) {
      setEdges([]);
      setEdgeStatus("ready");
      setEdgeError(null);
      return () => {
        cancelled = true;
      };
    }

    if (!storage.getAllEdges) {
      setEdges([]);
      setEdgeStatus("error");
      setEdgeError("Semantic edge loading is unavailable in this environment.");
      return () => {
        cancelled = true;
      };
    }

    setEdgeStatus("loading");
    setEdgeError(null);

    storage
      .getAllEdges({ threshold: 0.4, conversationIds })
      .then((result) => {
        if (cancelled) return;
        setEdges((result ?? []).map((edge) => ({ ...edge })));
        setEdgeStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[Network] getAllEdges error:", error);
        setEdges([]);
        setEdgeStatus("error");
        setEdgeError("Semantic edge playback is temporarily unavailable.");
      });

    return () => {
      cancelled = true;
    };
  }, [baseDataset.data.nodes, conversationIdsKey, storage]);

  useEffect(() => {
    const previousTotalDays = previousTotalDaysRef.current;
    previousTotalDaysRef.current = totalDays;

    if (totalDays <= 0) {
      resetTimeline(0, {
        hardReset: true,
        scrub: false,
        nextInfoText: formatDefaultInfo(0),
      });
      return;
    }

    if (currentDayRef.current > totalDays) {
      setCurrentDay(totalDays);
      currentDayRef.current = totalDays;
      previousDayRef.current = totalDays;
    }

    if (isActive && previousTotalDays <= 0 && totalDays > 0) {
      startReplay();
      return;
    }

    if (!playing && currentDayRef.current === 0 && scrubToken === 0) {
      setInfoText(formatDefaultInfo(totalDays));
    }
  }, [isActive, playing, resetTimeline, scrubToken, startReplay, totalDays]);

  useEffect(() => {
    const wasActive = previousIsActiveRef.current;
    previousIsActiveRef.current = isActive;

    if (!isActive) {
      stopPlayback();
      return;
    }

    if (!wasActive && totalDays > 0) {
      startReplay();
    }
  }, [isActive, startReplay, stopPlayback, totalDays]);

  useEffect(() => {
    if (!playing || totalDays <= 0) return;

    playbackOriginRef.current = null;
    playbackStartProgressRef.current = dayToProgress(currentDayRef.current, totalDays);

    const tick = (timestamp: number) => {
      if (playbackOriginRef.current === null) {
        playbackOriginRef.current =
          timestamp - playbackStartProgressRef.current * PLAYBACK_DURATION_MS;
      }

      const progress = Math.max(
        0,
        Math.min(1, (timestamp - playbackOriginRef.current) / PLAYBACK_DURATION_MS)
      );
      const nextDay = progressToDay(progress, totalDays);

      currentDayRef.current = nextDay;
      setCurrentDay(nextDay);

      if (progress >= 1) {
        animationFrameRef.current = null;
        playbackOriginRef.current = null;
        setPlaying(false);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      playbackOriginRef.current = null;
    };
  }, [playbackToken, playing, totalDays]);

  useEffect(() => {
    const previousDay = previousDayRef.current;
    const didScrub = previousScrubTokenRef.current !== scrubToken;

    if (totalDays > 0 && !playing && currentDay === 0 && scrubToken === 0) {
      previousDayRef.current = 0;
      setInfoText(formatDefaultInfo(totalDays));
      return;
    }

    if (didScrub) {
      previousScrubTokenRef.current = scrubToken;
      previousDayRef.current = currentDay;
      setInfoText(`${visibleCount} conversations visible`);
      return;
    }

    if (currentDay > previousDay) {
      let latestBirth: (typeof dataset.data.nodes)[number] | undefined;
      for (let index = dataset.data.nodes.length - 1; index >= 0; index -= 1) {
        const node = dataset.data.nodes[index];
        if (node.timelineDay <= previousDay) break;
        if (node.timelineDay <= currentDay) {
          latestBirth = node;
          break;
        }
      }

      if (latestBirth) {
        setInfoText(formatBirthInfo(latestBirth.label, latestBirth.platform));
      } else if (!playing) {
        setInfoText(`${visibleCount} conversations visible`);
      }
    } else if (!playing && totalDays > 0 && currentDay > 0) {
      setInfoText(`${visibleCount} conversations visible`);
    }

    previousDayRef.current = currentDay;
  }, [
    currentDay,
    dataset.data.nodes,
    playing,
    scrubToken,
    totalDays,
    visibleCount,
  ]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const handleReplay = useCallback(() => {
    startReplay();
  }, [startReplay]);

  const handleScrubStart = useCallback(() => {
    stopPlayback();
    setScrubbing(true);
  }, [stopPlayback]);

  const handleScrubChange = useCallback(
    (day: number) => {
      const nextDay = Math.max(0, Math.min(totalDays, day));
      stopPlayback();
      setCurrentDay(nextDay);
      currentDayRef.current = nextDay;
      setScrubToken((token) => token + 1);
    },
    [stopPlayback, totalDays]
  );

  const handleScrubEnd = useCallback(() => {
    setScrubbing(true);
  }, []);

  const edgeMessage =
    edgeStatus === "error"
      ? edgeError
      : edgeStatus === "ready" && dataset.data.nodes.length > 1 && dataset.data.edges.length === 0
        ? "No semantic links yet. Playback still shows how conversations accumulated over time."
        : null;

  if (dataset.data.nodes.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-bg-tertiary">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-3 px-4 py-8">
          <div className="max-w-sm">
            <p className="text-sm font-medium text-text-primary">
              Your temporal network will appear here.
            </p>
            <p className="mt-2 text-sm font-sans text-text-secondary">
              Capture a few conversations first, then reopen Network to watch the graph
              evolve over time.
            </p>
          </div>
          <GraphLegend />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-bg-tertiary">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-4 px-4 py-8">
        <div className="relative h-[360px] bg-bg-tertiary">
          {edgeStatus === "loading" && (
            <div className="pointer-events-none absolute left-0 top-0 z-10 rounded-full bg-bg-primary/85 px-2.5 py-1 text-[11px] font-sans text-text-tertiary backdrop-blur-sm">
              Building graph...
            </div>
          )}
          <TemporalGraph
            data={dataset.data}
            currentDay={currentDay}
            height={GRAPH_HEIGHT}
            themeMode={themeMode}
            scrubbing={scrubbing}
            resetToken={graphResetToken}
            onNodeClick={onSelectConversation}
          />
        </div>

        <div className="text-[11px] font-sans text-text-tertiary">
          Trend · daily new conversations
        </div>

        <TimeBar
          totalDays={totalDays}
          dayCounts={dataset.dayCounts}
          currentDay={currentDay}
          themeMode={themeMode}
          onChange={handleScrubChange}
          onScrubStart={handleScrubStart}
          onScrubEnd={handleScrubEnd}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={handleReplay}
            className="rounded-full border border-border-subtle bg-bg-primary px-3 py-1.5 text-[12px] font-sans text-text-primary transition-colors hover:bg-bg-secondary"
          >
            Replay
          </button>

          <span className="text-[11px] font-sans text-text-tertiary">
            Drag the trend line to pause on a moment.
          </span>
        </div>

        {edgeMessage && (
          <div className="text-[11px] font-sans text-text-secondary">{edgeMessage}</div>
        )}

        <div className="min-h-[16px] text-[11px] font-sans text-text-tertiary">{infoText}</div>

        <GraphLegend />
      </div>
    </div>
  );
}

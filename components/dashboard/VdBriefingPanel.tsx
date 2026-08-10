"use client";

import { useEffect, useRef, useState } from "react";
import { fetchVdBriefingAction } from "@/app/dashboard/briefing-actions";
import {
  VdBriefing,
  type VdBriefingLinkHint,
  type VdBriefingStats,
} from "@/components/dashboard/VdBriefing";

type VdBriefingPanelProps = {
  /** Instant content shown on first paint (cache or local briefing). */
  initialContent?: string | null;
  /** When true, skip OpenAI — initial content is already a fresh AI cache hit. */
  hasAiCache?: boolean;
  /** Compact status strip counts from live dashboard data. */
  stats?: VdBriefingStats | null;
  /** Link targets for making briefing rows clickable when names match. */
  linkHints?: VdBriefingLinkHint[] | null;
};

/**
 * Shows a usable briefing immediately, then optionally upgrades via OpenAI.
 * OpenAI failures/timeouts keep the local briefing — never show an error state.
 */
export function VdBriefingPanel({
  initialContent,
  hasAiCache = false,
  stats = null,
  linkHints = null,
}: VdBriefingPanelProps) {
  const safeInitial = initialContent?.trim() ? initialContent : "";
  const [content, setContent] = useState(safeInitial);
  const startedRef = useRef(false);

  useEffect(() => {
    setContent(initialContent?.trim() ? initialContent : "");
  }, [initialContent]);

  useEffect(() => {
    if (hasAiCache) {
      return;
    }
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const aiBriefing = await fetchVdBriefingAction();
        if (!cancelled && typeof aiBriefing === "string" && aiBriefing.trim()) {
          setContent(aiBriefing);
        }
      } catch (err) {
        console.error(err);
        // Keep local briefing — never surface OpenAI errors in the UI.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasAiCache]);

  return (
    <VdBriefing content={content} stats={stats} linkHints={linkHints} />
  );
}

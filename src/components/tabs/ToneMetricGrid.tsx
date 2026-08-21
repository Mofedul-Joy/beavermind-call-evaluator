"use client";

import { useState } from "react";
import type { DeliveryMetric } from "@/delivery/types";
import { outsideBenchmark } from "@/delivery/types";
import { ToneMetricPanel } from "./ToneMetricPanel";
import "./tone-tab.css";

/**
 * Scannable summary row over the up-to-9 delivery metrics. Hick's Law: show the metrics
 * that are actually outside their benchmark first, cap the rest behind a "Show N more"
 * disclosure, keep the granular numbers one click away rather than walling the tab.
 */
export function ToneMetricGrid({
  metrics,
  coachSpeakerId,
  speakerOrder,
  initialCount = 4,
}: {
  metrics: DeliveryMetric[];
  coachSpeakerId: string | null;
  speakerOrder: string[];
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const ordered = [...metrics].sort((a, b) => {
    const aOutside = outsideBenchmark(a) === true ? 0 : 1;
    const bOutside = outsideBenchmark(b) === true ? 0 : 1;
    return aOutside - bOutside;
  });

  const shown = expanded ? ordered : ordered.slice(0, initialCount);
  const hidden = ordered.length - initialCount;

  return (
    <div className="tone-tab flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((metric) => (
          <ToneMetricPanel key={metric.key} metric={metric} coachSpeakerId={coachSpeakerId} speakerOrder={speakerOrder} />
        ))}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-fit text-xs font-medium underline decoration-[var(--tone-border)] underline-offset-4 transition-colors hover:opacity-80"
          style={{ color: "var(--tone-muted)" }}
        >
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}

"use client";

import type { PresenceMetric, PresenceMetricKey } from "./types";
import { formatMetricValue, formatMetricUnit, metricTone } from "./format";
import { METRIC_ICON, METRIC_ORDER } from "./metricMeta";
import { toneClasses, card, ink, muted } from "./theme";
import { MicroLabel } from "./MicroLabel";

/**
 * The scannable row Hick's Law asks for: eight numbers, no prose, no decisions to make.
 * Detail — method, benchmark sentence, evidence — lives one click away in `MetricList`.
 * Clicking a tile scrolls to and opens its row there rather than duplicating the detail here.
 */
export function SummaryStrip({
  metrics,
  onSelect,
}: {
  metrics: PresenceMetric[];
  onSelect: (key: PresenceMetricKey) => void;
}) {
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {METRIC_ORDER.map((key) => {
        const m = byKey[key] as PresenceMetric | undefined;
        if (!m) return null;
        const Icon = METRIC_ICON[key];
        const tone = toneClasses[metricTone(m)];
        const unit = formatMetricUnit(m);

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`${card} flex flex-col items-start gap-2 rounded-xl px-3.5 py-3 text-left transition-colors hover:border-black/20 dark:hover:border-white/25`}
          >
            <span className="flex w-full items-center justify-between">
              <Icon className={muted} size={15} />
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
            </span>
            <span className="flex items-baseline gap-1">
              <span className={`text-xl font-semibold tabular-nums ${ink}`}>{formatMetricValue(m)}</span>
              {unit && <span className={`text-xs ${muted}`}>{unit}</span>}
            </span>
            <MicroLabel className="text-left">{m.label}</MicroLabel>
          </button>
        );
      })}
    </div>
  );
}

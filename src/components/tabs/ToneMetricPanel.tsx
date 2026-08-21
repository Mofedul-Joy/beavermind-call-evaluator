"use client";

import { useState } from "react";
import type { DeliveryMetric } from "@/delivery/types";
import { outsideBenchmark } from "@/delivery/types";
import { ToneMoments } from "./ToneMoments";
import "./tone-tab.css";

/**
 * One measured quantity, one card. No composite score, no emotion label — a number, its
 * unit, and (where one exists) how it compares to a published benchmark. `outsideBenchmark`
 * is the single source of truth for the in/out call; this file never re-derives it.
 */

function withUnit(value: string, unit: string): string {
  return unit === "%" ? `${value}${unit}` : `${value} ${unit}`;
}

function formatMetricValue(value: number, unit: string): string {
  const u = unit.toLowerCase();
  if (u.includes("%")) return Math.round(value).toString();
  if (u.includes("sec")) return value < 10 ? value.toFixed(1) : Math.round(value).toString();
  // Standard-deviation units (semitone SD, dB SD, …) carry their signal in the decimal —
  // rounding "1.1 st SD" to "1" erases most of what the number is there to show.
  if (u.includes("sd") || u.includes("semitone") || u.includes("db")) return value.toFixed(1);
  return Math.round(value).toString();
}

function benchmarkCaption(metric: DeliveryMetric): string | null {
  const { benchmark, interpretation, unit } = metric;
  if (benchmark.kind === "range" && benchmark.low !== null && benchmark.high !== null) {
    const range = `${formatMetricValue(benchmark.low, unit)}–${formatMetricValue(benchmark.high, unit)}`;
    return `Benchmark: ${withUnit(range, unit)}`;
  }
  if (benchmark.kind === "target" && benchmark.target !== null) {
    const t = withUnit(formatMetricValue(benchmark.target, unit), unit);
    return interpretation === "lower_is_better" ? `Target: under ${t}` : `Target: at least ${t}`;
  }
  return null;
}

/**
 * `speakerOrder` is turn-appearance order, shared with `ToneTimeline` — both derive it
 * from the same `report.turns`, so "Speaker A" means the same physical speaker in a
 * metric card as it does on the timeline strip. `perSpeaker`'s own key order is not used
 * for this: nothing guarantees it matches turn order.
 */
function speakerLabel(key: string, speakerOrder: string[], coachSpeakerId: string | null): string {
  if (coachSpeakerId !== null) return key === coachSpeakerId ? "Coach" : "Client";
  const index = speakerOrder.indexOf(key);
  return index === 0 ? "Speaker A" : "Speaker B";
}

export function ToneMetricPanel({
  metric,
  coachSpeakerId,
  speakerOrder,
}: {
  metric: DeliveryMetric;
  coachSpeakerId: string | null;
  speakerOrder: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const outside = outsideBenchmark(metric);
  const perSpeakerEntries = Object.entries(metric.perSpeaker);

  let chipClass = "tone-chip-neutral";
  let chipText = "No benchmark";
  if (outside === true) {
    chipClass = "tone-chip-amber";
    if (metric.benchmark.kind === "range") {
      chipText = "Outside range";
    } else {
      chipText = metric.interpretation === "lower_is_better" ? "Above target" : "Below target";
    }
  } else if (outside === false) {
    chipClass = "tone-chip-green";
    chipText = metric.benchmark.kind === "range" ? "In range" : "On target";
  }

  const caption = benchmarkCaption(metric);

  return (
    <div className="tone-tab tone-card flex flex-col gap-3 p-4">
      <p className="tone-micro-label">{metric.label}</p>

      <div className="flex items-baseline gap-1.5">
        {metric.value === null ? (
          <span className="text-2xl font-medium tabular-nums" style={{ color: "var(--tone-ink)" }}>
            &mdash;
          </span>
        ) : (
          <>
            <span className="text-2xl font-medium tabular-nums" style={{ color: "var(--tone-ink)" }}>
              {formatMetricValue(metric.value, metric.unit)}
            </span>
            <span className="text-sm" style={{ color: "var(--tone-muted)" }}>
              {metric.unit}
            </span>
          </>
        )}
      </div>

      {metric.value === null && metric.unavailableReason !== null && (
        <p className="text-sm" style={{ color: "var(--tone-body)" }}>
          {metric.unavailableReason}
        </p>
      )}

      {metric.value !== null && (
        <div className="flex flex-col gap-1">
          <span className={`tone-chip ${chipClass} w-fit`}>{chipText}</span>
          {outside === null ? (
            <p className="text-xs leading-relaxed" style={{ color: "var(--tone-muted)" }}>
              {metric.benchmark.source}
            </p>
          ) : (
            caption !== null && (
              <p className="text-xs" style={{ color: "var(--tone-muted)" }}>
                {caption}
              </p>
            )
          )}
        </div>
      )}

      {perSpeakerEntries.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: "var(--tone-border)" }}>
          {perSpeakerEntries.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--tone-body)" }}>{speakerLabel(key, speakerOrder, coachSpeakerId)}</span>
              <span className="tabular-nums" style={{ color: "var(--tone-ink)" }}>
                {withUnit(formatMetricValue(value, metric.unit), metric.unit)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-xs font-medium underline decoration-[var(--tone-border)] underline-offset-4 transition-colors hover:opacity-80"
          style={{ color: "var(--tone-muted)" }}
        >
          {expanded ? "Hide method" : "Show method"}
        </button>
        {expanded && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm leading-relaxed" style={{ color: "var(--tone-body)" }}>
              {metric.method}
            </p>
            <ToneMoments moments={metric.evidence} />
          </div>
        )}
      </div>
    </div>
  );
}

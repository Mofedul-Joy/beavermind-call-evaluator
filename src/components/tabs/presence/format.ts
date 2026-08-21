import type { PresenceMetric } from "./types";
import { outsidePresenceBenchmark } from "./types";

export function formatMmSs(sec: number): string {
  let m = Math.floor(sec / 60);
  let s = Math.round(sec % 60);
  if (s === 60) {
    s = 0;
    m += 1;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatMetricValue(m: PresenceMetric): string {
  if (m.value === null) return "—";
  const v = Number.isInteger(m.value) ? m.value.toString() : m.value.toFixed(1);
  return `${v}${m.unit === "%" ? "%" : ""}`;
}

export function formatMetricUnit(m: PresenceMetric): string | null {
  return m.unit === "%" ? null : m.unit;
}

export type MetricTone = "green" | "amber" | "neutral";

/** Presence metrics never render red — a reading outside benchmark is a coaching note, not a failure. */
export function metricTone(m: PresenceMetric): MetricTone {
  const outside = outsidePresenceBenchmark(m);
  if (outside === null) return "neutral";
  return outside ? "amber" : "green";
}

export function benchmarkSentence(m: PresenceMetric): string {
  const { kind, low, high, target } = m.benchmark;
  if (kind === "range" && low !== null && high !== null) {
    return `Typical range is ${low}–${high}${m.unit === "%" ? "%" : ` ${m.unit}`}.`;
  }
  if (kind === "target" && target !== null) {
    const dir = m.interpretation === "lower_is_better" ? "at or below" : "at or above";
    return `Target is ${dir} ${target}${m.unit === "%" ? "%" : ` ${m.unit}`}.`;
  }
  return "No published benchmark — reported for context.";
}

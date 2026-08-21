"use client";

import { useState } from "react";
import type { PresenceMetric, PresenceMetricKey } from "./types";
import { benchmarkSentence, formatMetricValue, formatMmSs, metricTone } from "./format";
import { METRIC_ICON, METRIC_ORDER } from "./metricMeta";
import { card, hairline, ink, body, muted, subtleFill, toneClasses } from "./theme";
import { MicroLabel } from "./MicroLabel";
import { ChevronDown } from "./icons";

/**
 * Granular numbers behind disclosure, per D9's Hick's-law cap — one row per metric,
 * collapsed by default. `openKey` lets `SummaryStrip` drive which row opens on tap.
 */
export function MetricList({
  metrics,
  openKey,
  onOpenKey,
}: {
  metrics: PresenceMetric[];
  openKey: PresenceMetricKey | null;
  onOpenKey: (key: PresenceMetricKey | null) => void;
}) {
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));

  return (
    <div className={`overflow-hidden rounded-xl ${card}`}>
      {METRIC_ORDER.map((key, i) => {
        const m = byKey[key] as PresenceMetric | undefined;
        if (!m) return null;
        return (
          <MetricRow
            key={key}
            metric={m}
            open={openKey === key}
            last={i === METRIC_ORDER.length - 1}
            onToggle={() => onOpenKey(openKey === key ? null : key)}
          />
        );
      })}
    </div>
  );
}

function MetricRow({
  metric: m,
  open,
  last,
  onToggle,
}: {
  metric: PresenceMetric;
  open: boolean;
  last: boolean;
  onToggle: () => void;
}) {
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const Icon = METRIC_ICON[m.key];
  const tone = toneClasses[metricTone(m)];
  const unavailable = m.value === null;

  return (
    <div id={`presence-metric-${m.key}`} className={`scroll-mt-24 ${last ? "" : `border-b ${hairline}`}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`presence-metric-${m.key}-panel`}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[.015] dark:hover:bg-white/[.03]"
      >
        <Icon className={muted} size={16} />
        <span className={`flex-1 text-sm font-medium ${ink}`}>{m.label}</span>
        {unavailable ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${subtleFill} ${muted}`}>
            Not available
          </span>
        ) : (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${tone.bg} ${tone.text}`}>
            {formatMetricValue(m)}
            {m.unit !== "%" ? ` ${m.unit}` : ""}
          </span>
        )}
        <ChevronDown open={open} className={muted} />
      </button>

      {open && (
        <div id={`presence-metric-${m.key}-panel`} className="space-y-3 px-4 pb-4 pl-[2.6rem]">
          {unavailable ? (
            <div className={`rounded-lg px-4 py-3 text-sm ${subtleFill} ${body}`}>
              <span className={`font-medium ${ink}`}>Not measured — deliberately.</span> {m.unavailableReason}
            </div>
          ) : (
            <p className={`text-sm leading-relaxed ${body}`}>{benchmarkSentence(m)}</p>
          )}

          <div>
            <MicroLabel>Method</MicroLabel>
            <p className={`mt-1 text-sm leading-relaxed ${body}`}>{m.method}</p>
          </div>

          {m.evidence.length > 0 && (
            <div className="space-y-2">
              <MicroLabel>Moments</MicroLabel>
              <ul className={`space-y-1.5 border-l pl-3 ${hairline}`}>
                {(showAllEvidence ? m.evidence : m.evidence.slice(0, 2)).map((e, i) => (
                  <li key={i} className={`text-sm leading-relaxed ${body}`}>
                    <span className={`mr-1.5 font-medium tabular-nums ${ink}`}>
                      {formatMmSs(e.startSec)}
                      {e.endSec !== null ? `–${formatMmSs(e.endSec)}` : ""}
                    </span>
                    {e.note}
                  </li>
                ))}
              </ul>
              {m.evidence.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllEvidence((v) => !v)}
                  className={`text-xs font-medium underline decoration-current/30 underline-offset-4 ${muted} hover:text-[#111111] dark:hover:text-[#f3f1ea]`}
                >
                  {showAllEvidence ? "Show fewer" : `Show ${m.evidence.length - 2} more`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

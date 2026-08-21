"use client";

import { useState } from "react";
import type { ScoreTrace } from "@/scoring/types";
import { EvidenceQuotes } from "./EvidenceQuotes";

export function ScoringTrace({ trace, forceOpen = false }: { trace: ScoreTrace; forceOpen?: boolean }) {
  const [openState, setOpenState] = useState(forceOpen);
  const open = forceOpen || openState;

  return (
    <div className="card">
      <button
        type="button"
        disabled={forceOpen}
        aria-expanded={open}
        aria-controls="scoring-trace-panel"
        onClick={() => setOpenState((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left disabled:cursor-default"
      >
        <span className="micro-label">Scoring trace</span>
        <span className="text-sm text-muted">{open ? "Hide" : "How this number was reached"}</span>
      </button>

      {open && (
        <div id="scoring-trace-panel" className="space-y-4 border-t border-border px-5 py-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TraceStat label="Raw total" value={String(trace.rawTotal)} />
            <TraceStat label="Denominator" value={String(trace.denominator)} />
            <TraceStat label="After caps" value={String(trace.totalAfterDimensionCaps)} />
            <TraceStat label="Final" value={`${trace.normalised}/100`} />
          </div>

          {trace.excluded.length > 0 && (
            <div>
              <p className="micro-label mb-1.5">Excluded dimensions</p>
              <ul className="space-y-1 text-body">
                {trace.excluded.map((ex) => (
                  <li key={ex.n}>
                    D{ex.n} {ex.title} (max {ex.max}) — {ex.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {trace.capsApplied.length > 0 && (
            <div className="space-y-3">
              <p className="micro-label">Caps applied</p>
              {trace.capsApplied.map((cap) => (
                <div key={cap.capId} className="rounded-lg bg-amber-bg px-4 py-3">
                  <p className="font-medium text-amber-ink">{cap.change}</p>
                  <p className="mt-1 text-body">{cap.condition}</p>
                  <p className="mt-1 text-body">{cap.reasoning}</p>
                  {cap.evidence.length > 0 && (
                    <div className="mt-2">
                      <EvidenceQuotes evidence={cap.evidence} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {trace.totalCapApplied && (
            <p className="text-body">
              <span className="font-medium text-ink">Total cap:</span> capped at {trace.totalCapApplied.value}{" "}
              ({trace.totalCapApplied.capId})
            </p>
          )}

          <p className="text-body">
            {trace.rawTotal}/{trace.denominator} normalised onto a 100-point scale, rounded, → {trace.normalised}.
          </p>
        </div>
      )}
    </div>
  );
}

function TraceStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

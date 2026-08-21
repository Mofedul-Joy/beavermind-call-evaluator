"use client";

import { useState } from "react";
import type { AppliedCap, DimensionResult } from "@/scoring/types";
import { EvidenceQuotes } from "./EvidenceQuotes";
import { ScorePill } from "./BandChip";
import { Chevron } from "./Icons";

export function DimensionRow({
  dim,
  cap,
  forceOpen = false,
  id,
}: {
  dim: DimensionResult;
  cap?: AppliedCap;
  forceOpen?: boolean;
  id: string;
}) {
  const [openState, setOpenState] = useState(forceOpen);
  const open = forceOpen || openState;
  const panelId = `${id}-panel`;

  return (
    <div id={id} className="scroll-mt-24 border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={forceOpen}
        onClick={() => setOpenState((v) => !v)}
        className="group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-black/[.015] disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className="micro-label mt-0.5 w-6 shrink-0 tabular-nums">{String(dim.n).padStart(2, "0")}</span>
        <span className="flex-1">
          <span className="block font-medium text-ink">{dim.title}</span>
          {!open && (
            <span className="mt-0.5 block text-sm text-body leading-snug line-clamp-2">
              {dim.status === "scored" ? dim.rationale : dim.statusReason ?? dim.rationale}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex shrink-0 items-center gap-2">
          {dim.capped && (
            <span className="rounded-full bg-amber-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-ink">
              Capped
            </span>
          )}
          {dim.status === "not_evidenced" ? (
            <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-muted">
              Not evidenced
            </span>
          ) : dim.status === "disabled" ? (
            <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-muted">Disabled</span>
          ) : (
            <ScorePill score={dim.score} max={dim.max} />
          )}
          {!forceOpen && <Chevron open={open} />}
        </span>
      </button>

      {open && (
        <div id={panelId} className="space-y-4 px-5 pb-5 pl-[3.75rem]">
          {dim.status === "not_evidenced" && (
            <div className="rounded-lg bg-black/[.03] px-4 py-3 text-sm text-body">
              <span className="font-medium text-ink">Not scored — deliberately.</span>{" "}
              {dim.statusReason ?? "Nothing in this transcript speaks to this dimension."} The rubric requires
              scoring conservatively when a behaviour is absent, so this dimension is held at its floor rather
              than guessed.
            </div>
          )}

          {dim.status === "disabled" && (
            <div className="rounded-lg bg-black/[.03] px-4 py-3 text-sm text-body">
              {dim.statusReason ?? "This dimension did not apply to this call and was excluded from scoring."}
            </div>
          )}

          {dim.status === "scored" && <p className="text-sm text-body leading-relaxed">{dim.rationale}</p>}

          {dim.capped && cap && (
            <div className="rounded-lg bg-amber-bg px-4 py-3 text-sm text-amber-ink">
              <span className="font-medium">
                Capped: {dim.rawScore} → {dim.score}
              </span>{" "}
              — {cap.condition}. {cap.reasoning}
            </div>
          )}

          <EvidenceQuotes evidence={dim.evidence} initial={3} showAll={forceOpen} />

          {dim.quickFix && (
            <div className="space-y-1">
              <p className="micro-label">Quick fix</p>
              <div className="rounded-lg bg-black/[.03] px-4 py-3 text-sm text-body">{dim.quickFix}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

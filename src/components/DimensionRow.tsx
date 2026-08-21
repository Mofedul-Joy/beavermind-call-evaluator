"use client";

import { useState } from "react";
import type { AppliedCap, DimensionResult } from "@/scoring/types";
import { EvidenceQuotes } from "./EvidenceQuotes";
import { ScorePill } from "./BandChip";
import { Chevron } from "./Icons";

/**
 * The two rows that are actually interesting to read are the two that currently look
 * like the other ten. A capped dimension is one the rubric overrode, and a not-evidenced
 * one is a refusal to guess — both are the scorer showing its working. Each gets a
 * hairline in its own tone down the leading edge and a faint ground, drawn as an inset
 * shadow so the row does not shift by a pixel against its neighbours.
 */
function rowSignature(dim: DimensionResult): string {
  if (dim.capped) return "bg-amber-bg/35 shadow-[inset_1px_0_0_0_var(--color-amber-ink)]";
  if (dim.status === "not_evidenced" || dim.status === "disabled") {
    return "bg-black/[.015] shadow-[inset_1px_0_0_0_var(--color-muted)]";
  }
  return "";
}

/**
 * What a closed row says about itself.
 *
 * It used to be two clamped lines of the rationale, which is a sentence cut mid-clause —
 * the reader gets the opening of an argument and no way to judge whether opening the row
 * is worth it. When the scorer produced beats, their titles are the better preview:
 * three noun phrases naming what the coach actually did, scannable down the whole list
 * without opening anything. Old reports have no beats and fall back to the clamp.
 */
function Preview({ dim }: { dim: DimensionResult }) {
  if (dim.status !== "scored") {
    return (
      <span className="mt-1 text-sm leading-snug text-body line-clamp-2">
        {dim.statusReason ?? dim.rationale}
      </span>
    );
  }

  if (dim.points?.length) {
    return (
      <span className="mt-1.5 text-sm leading-snug text-body line-clamp-2">
        {dim.points.map((p, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1.5 text-muted">·</span>}
            {p.title}
          </span>
        ))}
      </span>
    );
  }

  return <span className="mt-1 text-sm leading-snug text-body line-clamp-2">{dim.rationale}</span>;
}

export function DimensionRow({
  dim,
  cap,
  forceOpen = false,
  id,
  index,
}: {
  dim: DimensionResult;
  cap?: AppliedCap;
  forceOpen?: boolean;
  id: string;
  /** Position in the list, for the entrance stagger. Omitted in print. */
  index?: number;
}) {
  const [openState, setOpenState] = useState(forceOpen);
  const open = forceOpen || openState;
  const panelId = `${id}-panel`;

  return (
    <div
      id={id}
      className={`scroll-mt-24 border-b border-border last:border-b-0 ${rowSignature(dim)} ${
        index === undefined ? "" : "stagger-row"
      }`}
      style={index === undefined ? undefined : ({ "--i": index } as React.CSSProperties)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={forceOpen}
        onClick={() => setOpenState((v) => !v)}
        className="group flex w-full items-start gap-4 px-5 py-5 text-left transition-colors hover:bg-black/[.015] disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className="micro-label mt-1 w-6 shrink-0 tabular-nums">{String(dim.n).padStart(2, "0")}</span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-ink">{dim.title}</span>
          {!open && <Preview dim={dim} />}
        </span>
        <span className="mt-0.5 flex shrink-0 items-center gap-2">
          {dim.capped && (
            <span className="rounded-full bg-amber-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-ink">
              Capped
            </span>
          )}
          {dim.status === "not_evidenced" ? (
            <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-body">
              Not evidenced
            </span>
          ) : dim.status === "disabled" ? (
            <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-body">Disabled</span>
          ) : (
            <ScorePill score={dim.score} max={dim.max} />
          )}
          {!forceOpen && (
            <Chevron open={open} className="text-muted transition-colors group-hover:text-ink" />
          )}
        </span>
      </button>

      {/* The panel stays mounted so it can grow rather than appear. `inert` keeps its
          buttons out of the tab order while it is closed, which `display: none` used
          to do for free. */}
      <div id={panelId} className="disclosure" data-open={open} inert={!open}>
        <div>
          <div className="space-y-7 px-5 pb-7 pl-[3.75rem]">
            {dim.status === "not_evidenced" && (
              <div className="rounded-lg bg-black/[.03] px-4 py-3.5 text-sm leading-relaxed text-body">
                <span className="font-semibold text-ink">Not scored — deliberately.</span>{" "}
                {dim.statusReason ?? "Nothing in this transcript speaks to this dimension."} The rubric requires
                scoring conservatively when a behaviour is absent, so this dimension is held at its floor rather
                than guessed.
              </div>
            )}

            {dim.status === "disabled" && (
              <div className="rounded-lg bg-black/[.03] px-4 py-3.5 text-sm leading-relaxed text-body">
                {dim.statusReason ?? "This dimension did not apply to this call and was excluded from scoring."}
              </div>
            )}

            {dim.status === "scored" && <Reasoning dim={dim} />}

            {dim.capped && cap && (
              <div className="rounded-lg bg-amber-bg px-4 py-3.5 text-sm leading-relaxed text-amber-ink">
                <span className="font-semibold">
                  Capped: {dim.rawScore} → {dim.score}
                </span>{" "}
                — {cap.condition}. {cap.reasoning}
              </div>
            )}

            <EvidenceQuotes evidence={dim.evidence} initial={3} showAll={forceOpen} />

            {dim.quickFix && (
              <div className="rounded-lg bg-black/[.03] px-4 py-4">
                <p className="micro-label">Quick fix</p>
                <p className="mt-1.5 text-sm leading-relaxed text-body">{dim.quickFix}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The reasoning, as separated beats when the scorer produced them.
 *
 * The complaint this answers is that a dimension's detail arrived as one unbroken
 * paragraph of clauses and citations — correct, and nobody read it. The beats carry the
 * same content with a title on each, so the reader can find the one they care about
 * instead of reading all of it. Nothing here invents a title: no beats, no headings, and
 * the paragraph renders as it always did.
 *
 * Grouping is proximity, not boxes. 4px between a title and its own body against 24px
 * between beats is what makes them read as separate points; a card around each would put
 * four containers inside a container inside a card.
 */
function Reasoning({ dim }: { dim: DimensionResult }) {
  if (!dim.points?.length) {
    return <p className="max-w-[55ch] text-sm leading-[1.7] text-body print:max-w-none">{dim.rationale}</p>;
  }

  return (
    <ul className="space-y-6">
      {dim.points.map((point, i) => (
        <li key={i} className="max-w-[55ch] print:max-w-none">
          <p className="text-sm font-semibold tracking-[-0.005em] text-ink">{point.title}</p>
          <p className="mt-1 text-sm leading-[1.7] text-body">{point.body}</p>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useState } from "react";
import type { Evidence } from "@/scoring/types";

/**
 * Verbatim transcript lines, bounded.
 *
 * Every quote here was copied out of the transcript by the server — the model only ever
 * returned line numbers — so this never reformats or truncates the text itself.
 *
 * It does bound how many show at once. The scorer can cite eighteen lines for a single
 * finding, and three findings citing overlapping lines will bury the page in repeated
 * transcript before the reader reaches a single score. Two lines carry the point; the
 * rest are one click away and always countable, so nothing is hidden, only deferred.
 */
export function EvidenceQuotes({
  evidence,
  initial = 2,
  showAll = false,
}: {
  evidence: Evidence[];
  initial?: number;
  showAll?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (evidence.length === 0) return null;

  const open = showAll || expanded;
  const shown = open ? evidence : evidence.slice(0, initial);
  const hidden = evidence.length - shown.length;

  return (
    <div className="space-y-2">
      <p className="micro-label">Evidence</p>
      <ul className="space-y-2 border-l border-border pl-4">
        {shown.map((e) => (
          <li key={e.line} className="text-sm italic leading-relaxed text-body">
            <span className="mr-1.5 text-xs font-medium tabular-nums not-italic text-muted">L{e.line}</span>
            <span className="font-medium not-italic text-ink">{e.speaker}:</span> &ldquo;{e.text}&rdquo;
          </li>
        ))}
      </ul>
      {!showAll && (hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-muted underline decoration-border underline-offset-4 transition-colors hover:text-ink"
        >
          {hidden > 0 ? `Show ${hidden} more line${hidden === 1 ? "" : "s"}` : "Show fewer"}
        </button>
      )}
    </div>
  );
}

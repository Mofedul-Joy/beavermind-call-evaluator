"use client";

import { useState } from "react";
import type { Report } from "@/scoring/types";
import { EvidenceQuotes } from "./EvidenceQuotes";

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M3 2v12M3 2.5h8.2c.6 0 .9.7.5 1.1L9.5 6l2.2 2.4c.4.4.1 1.1-.5 1.1H3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The risks, as one tight strip rather than a stack of full-bleed panels.
 *
 * Four findings, each previously rendering its own tinted card with a dozen quotes inside,
 * turned the middle of the report into an unreadable wall of pink. They are the second
 * thing a reader needs, not the largest, so they now share one container: title and reason
 * always visible, the transcript behind a disclosure.
 */
export function RedFlags({ redFlags, showAll = false }: { redFlags: Report["redFlags"]; showAll?: boolean }) {
  if (redFlags.length === 0) return null;

  return (
    <section aria-label="Red flags" className="overflow-hidden rounded-xl bg-red-bg">
      <ul>
        {redFlags.map((flag, i) => (
          <Flag key={i} flag={flag} showAll={showAll} />
        ))}
      </ul>
    </section>
  );
}

function Flag({ flag, showAll }: { flag: Report["redFlags"][number]; showAll: boolean }) {
  const [open, setOpen] = useState(false);
  const expanded = showAll || open;
  const hasEvidence = flag.evidence.length > 0;

  return (
    <li className="border-b border-red-ink/10 last:border-b-0">
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-2 text-red-ink">
          <span className="mt-0.5">
            <FlagIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{flag.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-red-ink">{flag.why}</p>

            {hasEvidence && !showAll && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen((v) => !v)}
                className="mt-2 text-xs font-medium text-red-ink underline decoration-red-ink/30 underline-offset-4 transition-colors hover:decoration-red-ink"
              >
                {expanded ? "Hide the transcript" : `Show the ${flag.evidence.length} line${flag.evidence.length === 1 ? "" : "s"} this rests on`}
              </button>
            )}

            {hasEvidence && expanded && (
              <div className="mt-3">
                <EvidenceQuotes evidence={flag.evidence} showAll />
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

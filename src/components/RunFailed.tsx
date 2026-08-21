"use client";

import { useState } from "react";
import Link from "next/link";
import type { RunError } from "@/scoring/types";
import { Flag } from "./Icons";

const NEXT_ACTION: Record<RunError["code"], string> = {
  transcript_too_long: "Trim the transcript below 80,000 characters and run it again.",
  transcript_unparseable: "Check the transcript has speaker labels on each line, then run it again.",
  model_refused: "Review the transcript for anything that may have triggered a refusal, then try again.",
  invalid_evidence: "This is a scorer bug, not a transcript problem — try running it again.",
  schema_violation: "This is a scorer bug, not a transcript problem — try running it again.",
  rate_limited: "Wait a few minutes before submitting another run.",
  daily_cap_reached: "The daily run cap has been reached — try again tomorrow.",
  model_error: "The model provider had an issue — try running it again.",
  timeout: "The run took too long — try again, or with a shorter transcript.",
  unknown: "Try running it again.",
};

/**
 * A failed run already said the true thing; it just said it in a shape that looked
 * like the page had broken. Now it is composed like the report it stands in for:
 * a labelled band, the problem, then the one move that fixes it, then a way out.
 * The detail opens with the same disclosure the dimensions use, so the screen reads
 * as part of the product rather than as its wreckage.
 */
export function RunFailed({ error }: { error: RunError }) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 px-6 py-6">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-bg text-red-ink">
          <Flag size={14} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="micro-label text-red-ink">Run failed</p>
          <p className="text-lg font-medium leading-snug text-ink">{error.message}</p>
        </div>
      </div>

      <div className="border-t border-border px-6 py-5">
        <p className="micro-label">What to do</p>
        <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-body">{NEXT_ACTION[error.code]}</p>

        {error.detail && (
          <>
            <button
              type="button"
              aria-expanded={showDetail}
              aria-controls="run-error-detail"
              onClick={() => setShowDetail((v) => !v)}
              className="mt-3 text-xs font-medium text-muted underline decoration-border underline-offset-4 transition-colors hover:text-ink"
            >
              {showDetail ? "Hide what the scorer returned" : "Show what the scorer returned"}
            </button>
            <div id="run-error-detail" className="disclosure" data-open={showDetail} inert={!showDetail}>
              <div>
                <pre className="scroll-x mt-2 rounded-lg bg-black/[.03] px-4 py-3 text-xs whitespace-pre-wrap text-body">
                  {error.detail}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border bg-black/[.015] px-6 py-5">
        <Link
          href="/run"
          className="pill-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85"
        >
          Run another evaluation
        </Link>
        <Link
          href="/"
          className="text-sm text-muted underline decoration-border underline-offset-4 transition-colors hover:text-ink"
        >
          Back to all evaluations
        </Link>
      </div>
    </div>
  );
}

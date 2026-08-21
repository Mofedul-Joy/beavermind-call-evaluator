"use client";

import { useState } from "react";
import Link from "next/link";
import type { RunError } from "@/scoring/types";

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

export function RunFailed({ error }: { error: RunError }) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <div className="card space-y-4 px-6 py-8">
      <div>
        <p className="micro-label text-red-ink">Run failed</p>
        <p className="mt-1.5 text-lg font-medium text-ink">{error.message}</p>
      </div>

      {error.detail && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="text-sm text-muted underline underline-offset-2 hover:text-ink"
          >
            {showDetail ? "Hide detail" : "Show detail"}
          </button>
          {showDetail && (
            <pre className="scroll-x mt-2 rounded-lg bg-black/[.03] px-4 py-3 text-xs text-body whitespace-pre-wrap">
              {error.detail}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-border pt-4">
        <p className="text-sm text-body">{NEXT_ACTION[error.code]}</p>
      </div>

      <Link
        href="/run"
        className="pill-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium hover:opacity-85"
      >
        Run another evaluation
      </Link>
    </div>
  );
}

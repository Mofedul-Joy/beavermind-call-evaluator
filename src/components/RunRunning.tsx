"use client";

import { useEffect, useState } from "react";

/**
 * Two to four minutes of nothing, on the screen where trust is won or lost.
 *
 * The arc is the gauge's own track with a short travelling dash on it, so the wait
 * looks like the score being drawn rather than a generic spinner borrowed from some
 * other product. It is the only looping animation in the app.
 *
 * Everything it claims is true. `queued` and `running` are the two real states the
 * API reports, the clock counts real elapsed time, and the step list describes what
 * the run actually does without pretending to know which step it is on. A fake
 * progress bar would be the one dishonest thing in a product whose whole argument
 * is that it never asserts more than it can evidence.
 */
export function RunRunning({ status, startedAt }: { status: "queued" | "running"; startedAt?: string }) {
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const from = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - from) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="card flex flex-col items-center gap-5 px-6 py-16 text-center">
      <SweepingArc />

      <div className="space-y-1.5">
        <p className="font-medium text-ink" aria-live="polite">
          {status === "queued" ? "Waiting for a scorer slot…" : "Scoring this call against its rubric…"}
        </p>
        <p className="text-sm tabular-nums text-muted">
          {elapsed === null ? "Two to four minutes" : `${formatElapsed(elapsed)} elapsed, of two to four minutes`}
        </p>
      </div>

      <ol className="max-w-sm space-y-1.5 text-left text-sm text-body">
        {[
          "Numbering the transcript so every quote has a line",
          "Scoring twelve dimensions against the rubric",
          "Checking each cited line back to the transcript",
          "Applying caps and normalising onto 100",
        ].map((step) => (
          <li key={step} className="flex gap-2.5">
            <span className="mt-[0.5em] h-1 w-1 shrink-0 rounded-full bg-border" aria-hidden="true" />
            {step}
          </li>
        ))}
      </ol>

      <p className="max-w-sm text-sm text-muted">
        You can close this tab. The run keeps going, and this page picks up exactly where it left off when
        you come back to this URL.
      </p>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The gauge's arc, half-length, travelling. Same geometry and same stroke weight as
 *  ScoreGauge, so the shape the reader is waiting for is the shape they are watching. */
function SweepingArc() {
  const r = 80;
  const circumference = Math.PI * r;
  const dash = circumference * 0.28;

  return (
    <svg width="132" height="77" viewBox="0 0 200 116" aria-hidden="true">
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="#EAE8E3"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="#111111"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        className="sweep"
        style={{ ["--sweep-travel" as string]: `${circumference + dash}` }}
      />
    </svg>
  );
}

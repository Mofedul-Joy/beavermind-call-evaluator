"use client";

/**
 * Attach a recording to a run: drag/drop or pick a file, upload it straight to Supabase
 * Storage, hand it to the delivery worker, and show what happened.
 *
 * States: idle → uploading → processing → done | failed. `uploading` and `processing` are
 * both indeterminate on purpose — see `src/lib/delivery-client.ts`'s header for why there is
 * no real byte-progress percentage to show, and `processing` has none *by design* even if
 * there were: it's server-side analysis on Modal, not a browser transfer.
 *
 * `POST /recording/complete` returning is NOT the same as analysis being done — it means the
 * worker took the job. A 'processing' result there is a mid-flight status; the real finish
 * lands minutes later via the worker's callback into the run row. This component polls the
 * run (same shape as `RunPageClient`'s scoring poll) until `deliveryStatus` reaches `done` or
 * `failed`, and never treats "the worker started" as "the worker finished".
 *
 * One primary action per state (Hick's Law): in `idle` the whole dropzone IS the action, no
 * competing button; in `failed` there is exactly one "Try again" pill. Client-side
 * validation errors (wrong type, too big) never leave `idle` — they render as a dismissable
 * inline banner beside the dropzone, distinct from a server-side `failed` state.
 *
 * `checking` runs once on mount, before `idle` — this component only takes a `runId`, and a
 * run can already have a delivery in progress (or finished) from an earlier visit, so it has
 * to ask before assuming there's nothing there. Skipping this would both lose the operator's
 * "Analysing… 4:32" state on every refresh AND let them start a second upload on top of a
 * still-`processing` one — the server refuses that (`startDelivery` in `src/server/delivery.ts`),
 * but the honest fix is to never offer the dropzone in the first place when one is already
 * running.
 */
import { useEffect, useRef, useState } from "react";
import {
  describeValidationError,
  uploadRecording,
  validateRecording,
  type UploadPhase,
} from "@/lib/delivery-client";
import { fetchRun } from "@/lib/run-client";
import type { Run } from "@/scoring/types";
import { FileIcon, Upload, X } from "./Icons";

type Phase = "checking" | "idle" | UploadPhase | "done" | "failed";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function UploadCapture({
  runId,
  onRun,
}: {
  runId: string;
  /**
   * Every run this component fetches, handed up as it arrives.
   *
   * It already polls the run to completion, and the page around it needs the same row to
   * know whether the TONE tab exists yet. Without this the parent would either run a second
   * poll loop against the same endpoint or sit on a stale row until a manual refresh.
   */
  onRun?: (run: Run) => void;
}) {
  const report = onRun ?? (() => {});
  const [phase, setPhase] = useState<Phase>("checking");
  const [filename, setFilename] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped on every retry so a poll loop from a previous attempt recognizes it's stale and
  // stops writing state, without needing a cleanup-effect/unmount dance for a loop that
  // outlives any single render (it runs across a `/complete` response landing well before
  // the worker's callback, sometimes minutes later).
  const attemptId = useRef(0);

  // Ticks only — `elapsed` is reset to 0 in `startUpload`'s phase callback (an event
  // handler, not this effect) the moment the "processing" phase actually begins.
  useEffect(() => {
    if (phase !== "processing") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Orphan any in-flight poll loop if the component leaves the tree — `pollUntilSettled`'s
  // own `attemptId` check would eventually stop it anyway, but not until its next tick.
  useEffect(() => () => void attemptId.current++, []);

  // Resume whatever this run's delivery is actually doing, once, on mount. `runId` is the
  // only prop this component takes, so a mount is not necessarily a fresh start.
  useEffect(() => {
    const myAttempt = ++attemptId.current;
    (async () => {
      let run;
      try {
        run = await fetchRun(runId);
      } catch {
        // Couldn't even check — fall back to idle rather than stranding the operator on a
        // permanent spinner. A genuinely in-flight delivery is still safe: the server-side
        // guard in `startDelivery` refuses a second upload while one is `processing`.
        if (attemptId.current === myAttempt) setPhase("idle");
        return;
      }
      if (attemptId.current !== myAttempt) return;
      if (!run) {
        setPhase("idle");
        return;
      }
      report(run);

      if (run.deliveryStatus === "none") {
        setPhase("idle");
        return;
      }
      setFilename(run.recordingFilename);
      if (run.deliveryStatus === "processing") {
        setElapsed(0); // no started-at timestamp on the client; the count restarts, not the job
        setPhase("processing");
        pollUntilSettled(myAttempt);
      } else if (run.deliveryStatus === "done") {
        setPhase("done");
      } else {
        setFailMessage(run.deliveryError?.message ?? "Delivery analysis failed for an unknown reason.");
        setPhase("failed");
      }
    })();
    // `pollUntilSettled` closes over `runId` (already a dep) and reads `attemptId` fresh via
    // `.current` on every call, so it needs no dependency entry of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  /**
   * `POST /recording/complete` returns as soon as the worker acknowledges the job, not when
   * it finishes — analysis is 5-12 minutes of Modal compute, delivered later through the
   * worker's callback into the DB. A `deliveryStatus: 'processing'` result is a mid-flight
   * status, not a terminal one, so it has to be polled the same way `RunPageClient` polls a
   * run's scoring status, or every recording would flash "analysis complete" the instant the
   * worker was merely handed the file.
   */
  function pollUntilSettled(myAttempt: number, attempt = 1) {
    const delay = Math.min(2000 * attempt, 10000);
    setTimeout(async () => {
      if (attemptId.current !== myAttempt) return;
      let run;
      try {
        run = await fetchRun(runId);
      } catch {
        pollUntilSettled(myAttempt, attempt + 1);
        return;
      }
      if (attemptId.current !== myAttempt || !run) return;
      report(run);

      if (run.deliveryStatus === "done") {
        setPhase("done");
      } else if (run.deliveryStatus === "failed") {
        setFailMessage(run.deliveryError?.message ?? "Delivery analysis failed for an unknown reason.");
        setPhase("failed");
      } else {
        pollUntilSettled(myAttempt, attempt + 1);
      }
    }, delay);
  }

  async function startUpload(file: File) {
    const invalid = validateRecording(file);
    if (invalid) {
      setValidationError(describeValidationError(file, invalid));
      return;
    }
    const myAttempt = ++attemptId.current;
    setValidationError(null);
    setFailMessage(null);
    setFilename(file.name);
    setPhase("uploading");

    const result = await uploadRecording(runId, file, (p) => {
      if (p === "processing") setElapsed(0);
      setPhase(p);
    });
    if (attemptId.current !== myAttempt) return;

    if (!result.ok) {
      setFailMessage(result.message);
      setPhase("failed");
      return;
    }
    if (result.deliveryStatus === "failed") {
      setFailMessage(result.deliveryError?.message ?? "Delivery analysis failed for an unknown reason.");
      setPhase("failed");
      return;
    }
    // 'processing': the worker took the job but hasn't finished. Keep polling instead of
    // declaring victory on "started".
    pollUntilSettled(myAttempt);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void startUpload(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void startUpload(file);
  }

  function retry() {
    attemptId.current++; // orphans any in-flight poll loop from the previous attempt
    setPhase("idle");
    setFailMessage(null);
    setFilename(null);
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <p className="micro-label">Recording</p>
      </div>

      <div className="p-6">
        {phase === "checking" && (
          <div className="flex items-center justify-center px-6 py-12" aria-live="polite" aria-label="Checking recording status">
            <span
              className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-ink"
              aria-hidden="true"
            />
          </div>
        )}

        {phase === "idle" && (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose or drop a recording to upload"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-lg border border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 ${
                dragOver ? "border-ink/40 bg-black/[.02]" : "border-border hover:border-ink/25"
              }`}
            >
              <Upload className="text-muted" size={20} />
              <p className="text-sm font-medium text-ink">Drop a recording here, or click to choose a file</p>
              <p className="text-xs text-muted">Zoom, Fathom or Fireflies export — audio or video, up to 50MB</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,video/*"
              onChange={onPick}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />

            {validationError && (
              <div className="mt-3 flex items-start justify-between gap-3 rounded-lg bg-red-bg px-3.5 py-2.5 text-sm text-red-ink">
                <span>{validationError}</span>
                <button
                  type="button"
                  onClick={() => setValidationError(null)}
                  aria-label="Dismiss"
                  className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </>
        )}

        {busy && (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" aria-live="polite">
            <span
              className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-ink"
              aria-hidden="true"
            />
            {phase === "uploading" ? (
              <>
                <p className="text-sm font-medium text-ink">Uploading {filename}…</p>
                <p className="text-xs text-muted">Sent straight to storage — this page never sees the bytes.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">
                  Analysing {filename}… <span className="tabular-nums text-muted">{formatElapsed(elapsed)}</span>
                </p>
                <p className="max-w-sm text-xs text-muted">
                  The delivery analyser is measuring tone from the recording. This runs in the background — you
                  don&apos;t need to keep this open.
                </p>
              </>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
            <FileIcon className="text-muted" size={20} />
            <p className="text-sm font-medium text-ink">{filename} attached — analysis complete.</p>
            <button
              type="button"
              onClick={retry}
              className="pill-secondary mt-1.5 px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-85"
            >
              Upload a different recording
            </button>
          </div>
        )}

        {phase === "failed" && (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="micro-label text-red-ink">Delivery analysis failed</p>
            <p className="max-w-sm text-sm text-ink">{failMessage}</p>
            <p className="text-xs text-muted">The transcript report above is unaffected.</p>
            <button
              type="button"
              onClick={retry}
              className="pill-primary mt-1 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

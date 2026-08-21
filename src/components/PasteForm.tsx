"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CallType } from "@/scoring/types";
import { numberTranscript } from "@/scoring/engine";
import { createRun } from "@/lib/run-client";
import { callTypeLabel } from "@/lib/format";

const MAX_CHARS = 80_000;

export type SampleOption = {
  id: string;
  label: string;
  callType: CallType;
  transcript: string;
};

export function PasteForm({ samples }: { samples: SampleOption[] }) {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [coachName, setCoachName] = useState("");
  const [clientName, setClientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overLimit = transcript.length > MAX_CHARS;

  /* The same parser the server runs, so what this reports is what will actually be
     scored rather than a second guess at it. Unlabelled lines are the one failure
     the operator can fix, and finding out about it here costs a second instead of
     the four minutes it takes a run to come back as transcript_unparseable. */
  const parsed = useMemo(() => (transcript.trim() ? numberTranscript(transcript) : null), [transcript]);
  const named = parsed?.speakers.filter((s) => s !== "Unknown") ?? [];
  const unlabelled = parsed !== null && named.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim() || overLimit || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await createRun({
      transcript,
      callType,
      coachName: coachName.trim() || undefined,
      clientName: clientName.trim() || undefined,
    });
    if (result.ok) {
      router.push(`/runs/${result.id}`);
    } else {
      setError(result.message);
      setSubmitting(false);
    }
  }

  function loadSample(sample: SampleOption) {
    setTranscript(sample.transcript);
    setCallType(sample.callType);
  }

  const field =
    "w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink transition-colors " +
    "placeholder:text-muted focus:border-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/10";

  return (
    /* One card, hairline-divided into groups. The fields were previously loose on the page
       ground with a native <select> among them, which renders as the operating system's
       control and reads as a different product from everything beside it. */
    <form onSubmit={handleSubmit} className="card overflow-hidden">
      <div className="p-6">
        {/* Not a <legend>. A legend is laid out by the fieldset, not by normal flow, and
            the float-and-full-width workaround for that made a 100%-wide float that the
            radio group — a flex container, so its own formatting context — could not
            overlap: the two pills rendered off the right edge of the card, clipped. The
            group is already named for assistive technology by its own aria-label. */}
        <p className="micro-label mb-3">Which rubric</p>
        <div className="flex gap-2" role="radiogroup" aria-label="Call type">
          {(["kickoff", "coaching"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={callType === t}
              onClick={() => setCallType(t)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 ${
                callType === t ? "bg-ink text-white" : "border border-border bg-white text-body hover:border-ink/25"
              }`}
            >
              {callTypeLabel(t)}
            </button>
          ))}
        </div>
      </div>

      {samples.length > 0 && (
        <div className="space-y-3 border-t border-border px-6 py-5">
          <p className="micro-label">Or start from a sample</p>
          <div className="flex flex-wrap gap-2">
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s)}
                className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-body transition-colors hover:border-ink/25 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border p-6">
        <label className="micro-label" htmlFor="transcript">
          Transcript
        </label>
        <textarea
          id="transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste the call transcript here, one speaking turn per line…"
          rows={14}
          className={`scroll-x mt-2 resize-y leading-relaxed ${field}`}
        />
        {/* A transcript landing in an empty box is the only event on this page.
            Acknowledging it with what was actually read back turns a blind paste
            into a check the operator can make before committing four minutes. */}
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
          <p className={parsed ? "text-body" : "text-muted"} key={parsed ? "read" : "empty"}>
            {parsed ? (
              <span className="inline-flex flex-wrap items-baseline gap-x-1.5 motion-safe:animate-[rise_240ms_var(--ease-out-expo)_both]">
                <span className="font-medium tabular-nums text-ink">{parsed.lines.length}</span>
                <span>turn{parsed.lines.length === 1 ? "" : "s"} read.</span>
                {named.length > 0 ? (
                  <span className="text-muted">
                    Speakers: <span className="text-body">{named.join(", ")}</span>.
                  </span>
                ) : (
                  <span className="text-amber-ink">
                    No speaker labels found. Each line should read{" "}
                    <code className="font-mono">[Name]: what they said</code>.
                  </span>
                )}
                <span className="text-muted">Scoring against the {callTypeLabel(callType).toLowerCase()} rubric.</span>
              </span>
            ) : (
              "One speaking turn per line."
            )}
          </p>
          <p className={`ml-auto tabular-nums ${overLimit ? "text-red-ink" : "text-muted"}`}>
            {transcript.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-border p-6 sm:grid-cols-2">
        <label className="block">
          <span className="micro-label">Client (optional)</span>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={`mt-2 ${field}`} />
        </label>
        <label className="block">
          <span className="micro-label">Coach (optional)</span>
          <input value={coachName} onChange={(e) => setCoachName(e.target.value)} className={`mt-2 ${field}`} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-black/[.015] px-6 py-5">
        <button
          type="submit"
          disabled={!transcript.trim() || overLimit || submitting}
          className="pill-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25 disabled:opacity-35"
        >
          {submitting && (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          {submitting ? "Starting the run…" : "Score this call"}
        </button>
        <p className="text-xs text-muted">
          {unlabelled
            ? "Without speaker labels the scorer cannot tell coach from client, and the run will fail."
            : "Scoring takes two to four minutes. You can close the tab: the report keeps its own URL."}
        </p>
        {error && <p className="w-full text-sm text-red-ink">{error}</p>}
      </div>
    </form>
  );
}

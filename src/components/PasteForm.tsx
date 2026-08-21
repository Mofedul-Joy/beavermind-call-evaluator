"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CallType } from "@/scoring/types";
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="radiogroup" aria-label="Call type">
          {(["kickoff", "coaching"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={callType === t}
              onClick={() => setCallType(t)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                callType === t ? "bg-ink text-white" : "bg-white text-body border border-border"
              }`}
            >
              {callTypeLabel(t)}
            </button>
          ))}
        </div>

        {samples.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Load a sample transcript:</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const sample = samples.find((s) => s.id === e.target.value);
                if (sample) loadSample(sample);
                e.target.value = "";
              }}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-sm text-ink"
            >
              <option value="" disabled>
                Choose one…
              </option>
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste the call transcript here, one speaking turn per line…"
          rows={16}
          className="scroll-x w-full resize-y rounded-xl border border-border bg-white px-4 py-3.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:border-ink/40 focus:outline-none"
        />
        <p className={`mt-1.5 text-right text-xs tabular-nums ${overLimit ? "text-red-ink" : "text-muted"}`}>
          {transcript.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="micro-label">Client (optional)</span>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="micro-label">Coach (optional)</span>
          <input
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-ink">{error}</p>}

      <button
        type="submit"
        disabled={!transcript.trim() || overLimit || submitting}
        className="pill-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium hover:opacity-85 disabled:opacity-40"
      >
        {submitting ? "Starting…" : "Score this call"}
      </button>
    </form>
  );
}

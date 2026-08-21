import type { CallType, Run } from "@/scoring/types";

export type CreateRunInput = {
  transcript: string;
  callType: CallType;
  coachName?: string;
  clientName?: string;
};

export type CreateRunResult =
  | { ok: true; id: string }
  | { ok: false; message: string; detail?: string };

/** Runs in the browser. Posts a new run to the real API — fixtures have nothing to submit to. */
export async function createRun(input: CreateRunInput): Promise<CreateRunResult> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      message: body?.message ?? `The evaluator could not accept this call (${res.status}).`,
      detail: body?.detail,
    };
  }
  return { ok: true, id: body.id };
}

export function transcriptRawText(run: Pick<Run, "transcript">): string {
  return run.transcript.lines.map((l) => l.raw).join("\n");
}

/** Client-side poll of a single run, used by the running-state view. */
export async function fetchRun(id: string): Promise<Run | null> {
  const res = await fetch(`/api/runs/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load run (${res.status})`);
  return res.json();
}

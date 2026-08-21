export function formatUsd(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Timestamps are pinned to UTC and say so.
 *
 * Two reasons, and the second one is a bug this had. A report is a link people send
 * each other, so "evaluated Aug 22, 12:03 AM" has to mean the same instant to the
 * coach reading it as to the reviewer who sent it. And these render inside the client
 * tree: without a fixed zone the server formatted in its own timezone and the browser
 * reformatted in the reader's, which React counted as a hydration mismatch and threw
 * away the server's markup for that subtree on every report page.
 */
const UTC = "UTC";

export function formatDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: UTC,
  }).format(new Date(iso));
  /* Appended rather than asked for as `timeZoneName`, because Intl rejects that
     option alongside dateStyle/timeStyle and throws at format time. */
  return `${formatted} UTC`;
}

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: UTC }).format(
    new Date(iso)
  );
}

export type Tone = "green" | "amber" | "red" | "neutral";

export function bandTone(bandName: string | null): Tone {
  if (!bandName) return "neutral";
  const name = bandName.toUpperCase();
  if (name === "ELITE" || name === "STRONG") return "green";
  if (name === "INCONSISTENT") return "amber";
  if (name === "AT RISK" || name === "FAIL") return "red";
  return "neutral";
}

export function ratioTone(ratio: number): Tone {
  if (ratio >= 0.75) return "green";
  if (ratio >= 0.4) return "amber";
  return "red";
}

export const toneClasses: Record<Tone, { bg: string; text: string }> = {
  green: { bg: "bg-green-bg", text: "text-green-ink" },
  amber: { bg: "bg-amber-bg", text: "text-amber-ink" },
  red: { bg: "bg-red-bg", text: "text-red-ink" },
  neutral: { bg: "bg-black/5", text: "text-muted" },
};

export function callTypeLabel(callType: "coaching" | "kickoff"): string {
  return callType === "coaching" ? "Coaching" : "Kick-off";
}

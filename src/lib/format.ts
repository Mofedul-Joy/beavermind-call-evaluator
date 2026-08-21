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

/**
 * The same instant, short enough for a list column.
 *
 * The full form runs to "Aug 21, 2026, 8:59 PM UTC" — 25 characters in a column that has
 * to share a row with five others, which pushed the table past its container and left it
 * scrolling sideways at full desktop width. The year goes, since every run in the list is
 * recent and the full timestamp is on the report itself; the time stays, because several
 * runs a day is the normal case and a date alone would not order them.
 */
export function formatDateShort(iso: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: UTC,
  }).format(new Date(iso));
  return `${formatted} UTC`;
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
  neutral: { bg: "bg-black/5", text: "text-body" },
};

export function callTypeLabel(callType: "coaching" | "kickoff"): string {
  return callType === "coaching" ? "Coaching" : "Kick-off";
}

/**
 * The name the report saves under. Shared by the API route's Content-Disposition and by
 * the download button, which saves the blob itself and so sets the name a second time —
 * a browser saving a blob: URL has no header to read it from.
 */
export function pdfFilename(clientName: string | null | undefined): string {
  const stem = (clientName ?? "evaluation").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `${stem || "evaluation"}-report.pdf`;
}

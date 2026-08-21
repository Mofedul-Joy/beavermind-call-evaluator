export function formatUsd(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso));
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

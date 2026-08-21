import { bandTone, toneClasses } from "@/lib/format";

export function BandChip({ band }: { band: string }) {
  const tone = toneClasses[bandTone(band)];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${tone.bg} ${tone.text}`}
    >
      {band}
    </span>
  );
}

export function ScorePill({ score, max }: { score: number | null; max: number }) {
  if (score === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-muted">
        —
      </span>
    );
  }
  const ratio = max > 0 ? score / max : 0;
  const tone = toneClasses[ratio >= 0.75 ? "green" : ratio >= 0.4 ? "amber" : "red"];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${tone.bg} ${tone.text}`}
    >
      {score}/{max}
    </span>
  );
}

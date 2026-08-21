import type { Evidence } from "@/scoring/types";

export function EvidenceQuotes({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="micro-label">Evidence</p>
      <ul className="space-y-2 border-l-2 border-border pl-4">
        {evidence.map((e) => (
          <li key={e.line} className="text-sm italic text-body leading-relaxed">
            <span className="not-italic text-xs font-medium text-muted mr-1.5 tabular-nums">
              L{e.line}
            </span>
            <span className="not-italic font-medium text-ink">{e.speaker}:</span> &ldquo;{e.text}&rdquo;
          </li>
        ))}
      </ul>
    </div>
  );
}

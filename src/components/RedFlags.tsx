import type { Report } from "@/scoring/types";
import { EvidenceQuotes } from "./EvidenceQuotes";

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 2v12M3 2.5h8.2c.6 0 .9.7.5 1.1L9.5 6l2.2 2.4c.4.4.1 1.1-.5 1.1H3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RedFlags({ redFlags }: { redFlags: Report["redFlags"] }) {
  if (redFlags.length === 0) return null;
  return (
    <div className="space-y-3">
      {redFlags.map((flag, i) => (
        <div key={i} className="rounded-xl bg-red-bg px-4 py-3.5">
          <div className="flex items-center gap-2 text-red-ink">
            <FlagIcon />
            <span className="text-sm font-semibold">{flag.title}</span>
          </div>
          <p className="mt-1.5 text-sm text-red-ink/90 leading-relaxed">{flag.why}</p>
          {flag.evidence.length > 0 && (
            <div className="mt-2.5">
              <EvidenceQuotes evidence={flag.evidence} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

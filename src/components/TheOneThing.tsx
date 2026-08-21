import type { Report } from "@/scoring/types";
import { EvidenceQuotes } from "./EvidenceQuotes";

export function TheOneThing({ theOneThing }: { theOneThing: Report["theOneThing"] }) {
  return (
    <div className="space-y-3">
      <p className="text-[28px] leading-[1.15] font-medium tracking-tight text-ink">
        &ldquo;{theOneThing.change}&rdquo;
      </p>
      <p className="text-sm text-muted">
        Do this and the call would have scored <span className="font-semibold text-ink">{theOneThing.wouldScore}</span>.
      </p>
      {theOneThing.evidence.length > 0 && <EvidenceQuotes evidence={theOneThing.evidence} />}
    </div>
  );
}

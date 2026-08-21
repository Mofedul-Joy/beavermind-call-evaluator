import type { Report } from "@/scoring/types";
import { EvidenceQuotes } from "./EvidenceQuotes";

/**
 * The single change that moves the number most, set as a quote.
 *
 * It is the hero of the report and carries no label above it — the quotation marks and
 * the size say what it is. The uplift line only renders when the scorer's projection is
 * actually above what the call scored: it returned 15 for a call that scored 56 on one
 * run, and printing that verbatim reads as a broken page rather than as a finding.
 */
export function TheOneThing({
  theOneThing,
  currentScore,
  showAllEvidence = false,
}: {
  theOneThing: Report["theOneThing"];
  currentScore: number;
  showAllEvidence?: boolean;
}) {
  const uplift =
    theOneThing.wouldScore > currentScore && theOneThing.wouldScore <= 100 ? theOneThing.wouldScore : null;

  return (
    <div className="space-y-5">
      <blockquote className="text-pretty text-[25px] font-medium leading-[1.2] tracking-[-0.02em] text-ink sm:text-[28px]">
        &ldquo;{theOneThing.change}&rdquo;
      </blockquote>

      {uplift !== null && (
        <p className="text-sm text-muted">
          Do this and the call would have scored{" "}
          <span className="font-semibold tabular-nums text-ink">{uplift}</span>
          <span className="text-muted">/100</span>.
        </p>
      )}

      {theOneThing.evidence.length > 0 && (
        <EvidenceQuotes evidence={theOneThing.evidence} initial={2} showAll={showAllEvidence} />
      )}
    </div>
  );
}

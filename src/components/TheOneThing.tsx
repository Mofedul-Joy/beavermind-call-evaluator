import type { Report } from "@/scoring/types";
import { EvidenceQuotes } from "./EvidenceQuotes";

/**
 * The single change that moves the number most, set as a quote.
 *
 * It is the hero of the report and carries no label above it — the quotation marks and
 * the size say what it is. The uplift line only renders when the scorer's projection is
 * actually above what the call scored: it returned 15 for a call that scored 56 on one
 * run, and printing that verbatim reads as a broken page rather than as a finding.
 *
 * The headline and the specifics used to be one field, so the hero was a nine-line
 * sentence at 28px — the largest, least readable thing on the page. `change` is now
 * constrained to one short imperative and `detail` carries the examples and the line
 * citations at reading size. Reports written before that split have no `detail` and a
 * `change` of paragraph length; `heroSize` steps those down rather than setting a
 * paragraph as display type.
 */
function heroSize(change: string, hasDetail: boolean): string {
  if (hasDetail || change.length <= 110) return "text-[27px] leading-[1.15] sm:text-[32px]";
  if (change.length <= 200) return "text-[22px] leading-[1.25] sm:text-[25px]";
  return "text-[19px] leading-[1.35] sm:text-[21px]";
}

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
  const detail = theOneThing.detail?.trim() || null;

  return (
    <div>
      <blockquote
        className={`text-balance font-semibold tracking-[-0.025em] text-ink ${heroSize(theOneThing.change, Boolean(detail))}`}
      >
        &ldquo;{theOneThing.change}&rdquo;
      </blockquote>

      {detail && (
        <p className="mt-5 max-w-[54ch] text-[15px] leading-[1.65] text-body print:max-w-none">{detail}</p>
      )}

      {uplift !== null && (
        /* The delta is the fact; the sentence is the frame around it. Set as its own
           mark so it survives a squint, sitting on the ground rather than in a card —
           a second card inside the verdict card would be one container too many. */
        <p className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center rounded-full bg-green-bg px-2.5 py-1 text-xs font-semibold tabular-nums text-green-ink">
            +{uplift - currentScore}
          </span>
          Do this and the call would have scored{" "}
          <span className="font-semibold tabular-nums text-ink">{uplift}</span>
          <span className="-ml-2.5">/100.</span>
        </p>
      )}

      {theOneThing.evidence.length > 0 && (
        <div className="mt-7">
          {/* Deferred, not hidden. Two verbatim turns run to eight lines of italic and
              they were the first thing under the hero, so the reader met the transcript
              before they met the brief. The count is on the control. */}
          <EvidenceQuotes evidence={theOneThing.evidence} initial={0} showAll={showAllEvidence} />
        </div>
      )}
    </div>
  );
}

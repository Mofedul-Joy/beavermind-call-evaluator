import type { Report } from "@/scoring/types";
import { TheOneThing } from "./TheOneThing";
import { RedFlags } from "./RedFlags";
import { ScoreGauge } from "./ScoreGauge";
import { BandChip } from "./BandChip";
import { VerdictReveal } from "./VerdictReveal";
import { ScoringTrace } from "./ScoringTrace";
import { DimensionRow } from "./DimensionRow";
import { DimensionRail, type RailItem } from "./DimensionRail";

/** A labelled block. The label-to-content gap is deliberately tighter than the gap between
 *  sections, so the label reads as belonging to what follows it rather than floating. */
function Section({
  label,
  aside,
  className,
  children,
}: {
  label: string;
  aside?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
        <h2 className="micro-label">{label}</h2>
        {aside && <p className="text-xs tabular-nums text-muted">{aside}</p>}
      </div>
      {children}
    </section>
  );
}

export function dimensionId(n: number): string {
  return `dim-${n}`;
}

function findCap(report: Report, n: number) {
  const prefix = `D${n} `;
  return (report.trace.capsApplied ?? []).find((c) => c.change.startsWith(prefix));
}

/**
 * The brief, as the paragraphs the scorer wrote.
 *
 * It is the one piece of continuous prose in the product and it was arriving as a single
 * eight-line block: correct, and skipped. The scorer now writes it as two or three
 * paragraphs with a blank line between them, each with its own job. Reports written
 * before that have no blank line and split to one paragraph, which is what they always
 * were.
 */
function Brief({ brief }: { brief: string }) {
  const paragraphs = brief
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="max-w-[58ch] space-y-5 print:max-w-none">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[17px] leading-[1.7] text-body">
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * Reading order: the verdict, then the one change, then why, then the risks, then the
 * twelve dimensions on demand.
 *
 * The score and the one change share a single band at the top because they answer the two
 * questions a reader arrives with — how bad is it, and what do I do — and neither is
 * useful alone. Previously the gauge sat below the brief and four expanded red-flag
 * panels, which put the headline number of the whole product about three quarters of the
 * way down the page.
 */
export function ReportView({ report, print = false }: { report: Report; print?: boolean }) {
  const railItems: RailItem[] = report.dimensions.map((d) => ({
    id: dimensionId(d.n),
    n: d.n,
    title: d.title,
  }));
  const { trace } = report;
  const scored = report.dimensions.filter((d) => d.status === "scored").length;

  return (
    <div className={print ? "" : "flex gap-10"}>
      <div className={print ? "" : "min-w-0 flex-1"}>
        {/* The verdict. One band, two readings: the number and the change. */}
        <section className="card overflow-hidden">
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
            <TheOneThing
              theOneThing={report.theOneThing}
              currentScore={trace.normalised}
              showAllEvidence={print}
            />

            {/* The gauge leads on narrow screens. Source order puts the quote first because
                that is the reading order on a wide layout, but on a phone a nine-line quote
                would push the score — the fastest read on the page — below the fold. */}
            <div className="order-first flex flex-col items-center gap-4 border-b border-border pb-8 lg:order-none lg:w-[288px] lg:border-b-0 lg:border-l lg:pb-0 lg:pl-12">
              <ScoreGauge score={trace.normalised} band={trace.band.name} animate={!print} />
              {/* The word for the number lands after the needle does. Reading the
                  verdict before the score have you arriving at the arc already
                  knowing the answer, which wastes the only moment this page has. */}
              <VerdictReveal animate={!print} className="flex w-full flex-col items-center gap-3.5">
                <BandChip band={trace.band.name} />
                <p className="max-w-[28ch] text-balance text-center text-sm leading-[1.6] text-body">
                  {trace.band.description}
                </p>
                {/* What the number is a number OF. The arc says 87 and the chip says
                    STRONG; neither says against what, and the full working is two
                    sections down behind a disclosure. One line closes that gap. */}
                <p className="mt-1 w-full border-t border-border pt-3.5 text-center text-xs leading-relaxed text-muted">
                  {scored} of {report.dimensions.length} dimensions scored
                  <br />
                  {trace.rawTotal} of {trace.denominator} raw points
                </p>
              </VerdictReveal>
            </div>
          </div>
        </section>

        {/* Rhythm is deliberate. The brief is the prose form of the verdict above it, so
            it sits close. Red flags open a different subject and get a wide gap; the
            trace and the dimension list are one chapter — the working — so the gap goes
            in front of the trace, not between them. One repeated value would give every
            block the same weight. */}
        <Section label="The brief" className="mt-12">
          <Brief brief={report.brief} />
        </Section>

        {report.redFlags.length > 0 && (
          <Section
            label="Red flags"
            aside={`${report.redFlags.length} found`}
            className="mt-16"
          >
            <RedFlags redFlags={report.redFlags} showAll={print} />
          </Section>
        )}

        <div className="mt-16">
          <ScoringTrace trace={trace} forceOpen={print} />
        </div>

        <Section
          label="Dimensions"
          aside={`${report.dimensions.length} scored against the rubric`}
          className="mt-6"
        >
          <div className="card overflow-hidden">
            {report.dimensions.map((dim, i) => (
              <DimensionRow
                key={dim.n}
                id={dimensionId(dim.n)}
                dim={dim}
                cap={findCap(report, dim.n)}
                forceOpen={print}
                /* Twelve rows over ~200ms total. Longer and the list reads as slow
                   rather than considered, so the per-row delay stops climbing at
                   row 11 instead of running to twelve times the step. */
                index={print ? undefined : Math.min(i, 11)}
              />
            ))}
          </div>
        </Section>
      </div>

      {!print && <DimensionRail items={railItems} />}
    </div>
  );
}

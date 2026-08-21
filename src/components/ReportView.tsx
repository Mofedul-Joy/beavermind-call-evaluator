import type { Report } from "@/scoring/types";
import { TheOneThing } from "./TheOneThing";
import { RedFlags } from "./RedFlags";
import { ScoreGauge } from "./ScoreGauge";
import { BandChip } from "./BandChip";
import { ScoringTrace } from "./ScoringTrace";
import { DimensionRow } from "./DimensionRow";
import { DimensionRail } from "./DimensionRail";

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
      <div className="mb-3 flex items-baseline justify-between gap-4">
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
  const ids = report.dimensions.map((d) => dimensionId(d.n));
  const { trace } = report;

  return (
    <div className={print ? "" : "flex gap-10"}>
      <div className={print ? "" : "min-w-0 flex-1"}>
        {/* The verdict. One band, two readings: the number and the change. */}
        <section className="card overflow-hidden">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
            <TheOneThing
              theOneThing={report.theOneThing}
              currentScore={trace.normalised}
              showAllEvidence={print}
            />

            {/* The gauge leads on narrow screens. Source order puts the quote first because
                that is the reading order on a wide layout, but on a phone a nine-line quote
                would push the score — the fastest read on the page — below the fold. */}
            <div className="order-first flex flex-col items-center gap-3 border-b border-border pb-8 lg:order-none lg:w-[248px] lg:border-b-0 lg:border-l lg:pb-0 lg:pl-10">
              <ScoreGauge score={trace.normalised} band={trace.band.name} />
              <BandChip band={trace.band.name} />
              <p className="max-w-[26ch] text-center text-sm leading-relaxed text-muted">
                {trace.band.description}
              </p>
            </div>
          </div>
        </section>

        {/* Rhythm is deliberate: a wide gap after the verdict, tighter inside a section
            between its label and its content, wide again between sections. One repeated
            spacing value would give every block the same weight. */}
        <Section label="The brief" className="mt-12">
          <p className="max-w-[68ch] text-[17px] leading-[1.65] text-body">{report.brief}</p>
        </Section>

        {report.redFlags.length > 0 && (
          <Section
            label="Red flags"
            aside={`${report.redFlags.length} found`}
            className="mt-12"
          >
            <RedFlags redFlags={report.redFlags} showAll={print} />
          </Section>
        )}

        <div className="mt-12">
          <ScoringTrace trace={trace} forceOpen={print} />
        </div>

        <Section
          label="Dimensions"
          aside={`${report.dimensions.length} scored against the rubric`}
          className="mt-12"
        >
          <div className="card overflow-hidden">
            {report.dimensions.map((dim) => (
              <DimensionRow
                key={dim.n}
                id={dimensionId(dim.n)}
                dim={dim}
                cap={findCap(report, dim.n)}
                forceOpen={print}
              />
            ))}
          </div>
        </Section>
      </div>

      {!print && <DimensionRail ids={ids} />}
    </div>
  );
}

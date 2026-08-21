import type { Report } from "@/scoring/types";
import { TheOneThing } from "./TheOneThing";
import { RedFlags } from "./RedFlags";
import { ScoreGauge } from "./ScoreGauge";
import { BandChip } from "./BandChip";
import { ScoringTrace } from "./ScoringTrace";
import { DimensionRow } from "./DimensionRow";
import { DimensionRail } from "./DimensionRail";

export function dimensionId(n: number): string {
  return `dim-${n}`;
}

function findCap(report: Report, n: number) {
  const prefix = `D${n} `;
  return report.trace.capsApplied.find((c) => c.change.startsWith(prefix));
}

export function ReportView({ report, print = false }: { report: Report; print?: boolean }) {
  const ids = report.dimensions.map((d) => dimensionId(d.n));

  return (
    <div className={print ? "space-y-8" : "flex gap-10"}>
      <div className={print ? "space-y-8" : "flex-1 space-y-8 min-w-0"}>
        <TheOneThing theOneThing={report.theOneThing} />

        <p className="text-body leading-relaxed">{report.brief}</p>

        <RedFlags redFlags={report.redFlags} />

        <div className="flex flex-col items-center gap-3 py-2">
          <ScoreGauge score={report.trace.normalised} band={report.trace.band.name} />
          <BandChip band={report.trace.band.name} />
          <p className="max-w-sm text-center text-sm text-muted">{report.trace.band.description}</p>
        </div>

        <ScoringTrace trace={report.trace} forceOpen={print} />

        <div className="card">
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
      </div>

      {!print && <DimensionRail ids={ids} />}
    </div>
  );
}

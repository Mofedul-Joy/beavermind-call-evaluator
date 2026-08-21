import Link from "next/link";
import type { Run } from "@/scoring/types";
import { callTypeLabel, formatDate } from "@/lib/format";
import { ArrowLeft } from "./Icons";
import { DownloadPdfButton } from "./DownloadPdfButton";

/**
 * The one navigation control on the report, and the one action.
 *
 * Back was a 14px muted arrow and the word "Back", set at the same weight as a timestamp —
 * the only way out of the page, drawn as metadata. It is a control now: a hairline pill on
 * the ground, ink text, hit area a thumb can find. The arrow slides a few pixels on hover
 * and the ground fills, both inside the feedback duration, so it answers immediately
 * without competing with the gauge for the eye.
 */
export function RunHeader({ run }: { run: Run }) {
  return (
    <header>
      <Link
        href="/"
        className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-ink transition-colors duration-[var(--dur-feedback)] hover:border-ink/25 hover:bg-black/[.03]"
      >
        <ArrowLeft
          size={14}
          className="text-muted transition-[transform,color] duration-[var(--dur-feedback)] ease-[var(--ease-out-expo)] group-hover:-translate-x-0.5 group-hover:text-ink"
        />
        Back
      </Link>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="micro-label">Full analysis · {callTypeLabel(run.callType)} call</p>
          <h1 className="mt-2.5 text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[44px]">
            {run.clientName ?? "Untitled call"}
          </h1>
          {run.coachName && (
            <p className="mt-2 text-[15px] text-body">
              Coached by <span className="font-medium text-ink">{run.coachName}</span>
            </p>
          )}
        </div>

        {run.status === "done" && (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <DownloadPdfButton runId={run.id} clientName={run.clientName ?? null} />
            {run.finishedAt && <p className="text-xs text-muted">Evaluated {formatDate(run.finishedAt)}</p>}
          </div>
        )}
      </div>
    </header>
  );
}

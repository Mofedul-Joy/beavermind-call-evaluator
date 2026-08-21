import Link from "next/link";
import type { Run } from "@/scoring/types";
import { callTypeLabel, formatDate } from "@/lib/format";
import { ArrowLeft, Download } from "./Icons";

export function RunHeader({ run }: { run: Run }) {
  return (
    <header className="space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} />
        Back
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="micro-label">Full analysis · {callTypeLabel(run.callType)} call</p>
          <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {run.clientName ?? "Untitled call"}
          </h1>
          {run.coachName && <p className="mt-1.5 text-body">Coached by {run.coachName}</p>}
        </div>

        {run.status === "done" && (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <a
              href={`/api/pdf/${run.id}`}
              className="pill-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85"
            >
              <Download size={15} />
              Download PDF
            </a>
            {run.finishedAt && <p className="text-xs text-muted">Evaluated {formatDate(run.finishedAt)}</p>}
          </div>
        )}
      </div>
    </header>
  );
}

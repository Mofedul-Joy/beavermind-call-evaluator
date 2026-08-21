import Link from "next/link";
import type { Run } from "@/scoring/types";
import { callTypeLabel, formatDate } from "@/lib/format";

export function RunHeader({ run }: { run: Run }) {
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        ← Back
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="micro-label">
            Full analysis · {callTypeLabel(run.callType)} call
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
            {run.clientName ?? "Untitled call"}
          </h1>
          {run.coachName && <p className="mt-1 text-body">Coached by {run.coachName}</p>}
        </div>
        {run.status === "done" && (
          <div className="flex flex-col items-end gap-2">
            <a
              href={`/api/pdf/${run.id}`}
              className="pill-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium hover:opacity-85"
            >
              ⬇ Download PDF
            </a>
            {run.finishedAt && <p className="text-xs text-muted">Evaluated {formatDate(run.finishedAt)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

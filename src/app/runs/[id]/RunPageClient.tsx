"use client";

import { useEffect, useState } from "react";
import type { Run } from "@/scoring/types";
import { fetchRun } from "@/lib/run-client";
import { RunHeader } from "@/components/RunHeader";
import { ReportView } from "@/components/ReportView";
import { RunRunning } from "@/components/RunRunning";
import { RunFailed } from "@/components/RunFailed";

export function RunPageClient({ initialRun }: { initialRun: Run }) {
  const [run, setRun] = useState(initialRun);

  useEffect(() => {
    if (run.status !== "queued" && run.status !== "running") return;

    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      attempt += 1;
      try {
        const fresh = await fetchRun(run.id);
        if (cancelled || !fresh) return;
        setRun(fresh);
        if (fresh.status === "queued" || fresh.status === "running") {
          timer = setTimeout(poll, Math.min(2000 * attempt, 10000));
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, Math.min(2000 * attempt, 10000));
      }
    };

    timer = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [run.status, run.id]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <RunHeader run={run} />
      <div className="mt-8">
        {run.status === "done" && run.report && <ReportView report={run.report} />}
        {(run.status === "queued" || run.status === "running") && <RunRunning />}
        {run.status === "failed" && run.error && <RunFailed error={run.error} />}
      </div>
    </div>
  );
}

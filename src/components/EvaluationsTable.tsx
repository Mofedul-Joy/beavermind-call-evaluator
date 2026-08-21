"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RunSummary } from "@/scoring/types";
import { callTypeLabel, formatDate, formatUsd } from "@/lib/format";
import { FilterPill } from "./Pill";
import { BandChip } from "./BandChip";

type Filter = "all" | "kickoff" | "coaching";

export function EvaluationsTable({ runs }: { runs: RunSummary[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: runs.length,
      kickoff: runs.filter((r) => r.callType === "kickoff").length,
      coaching: runs.filter((r) => r.callType === "coaching").length,
    }),
    [runs]
  );

  const filtered = filter === "all" ? runs : runs.filter((r) => r.callType === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All · {counts.all}
        </FilterPill>
        <FilterPill active={filter === "kickoff"} onClick={() => setFilter("kickoff")}>
          Kick-off · {counts.kickoff}
        </FilterPill>
        <FilterPill active={filter === "coaching"} onClick={() => setFilter("coaching")}>
          Coaching · {counts.coaching}
        </FilterPill>
      </div>

      <div className="card scroll-x">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Client", "Coach", "Type", "Score", "Cost", "When"].map((h) => (
                <th key={h} className="micro-label px-5 py-3 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No evaluations yet.
                </td>
              </tr>
            )}
            {filtered.map((run) => (
              <tr key={run.id} className="border-b border-border last:border-b-0 hover:bg-black/[.015]">
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <Link href={`/runs/${run.id}`} className="font-medium text-ink hover:underline">
                    {run.clientName ?? "Untitled"}
                  </Link>
                  {run.isSample && (
                    <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      Sample
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-body">{run.coachName ?? "—"}</td>
                <td className="px-5 py-3.5 text-body">{callTypeLabel(run.callType)}</td>
                <td className="px-5 py-3.5">
                  <ScoreCell run={run} />
                </td>
                <td className="px-5 py-3.5 tabular-nums text-body">
                  {run.costUsd !== null ? formatUsd(run.costUsd) : "—"}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-body">{formatDate(run.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreCell({ run }: { run: RunSummary }) {
  if (run.status === "running" || run.status === "queued") {
    return <span className="text-sm text-muted">Running…</span>;
  }
  if (run.status === "failed") {
    return <span className="text-sm font-medium text-red-ink">Failed</span>;
  }
  if (run.score === null || !run.band) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-semibold tabular-nums text-ink">{run.score}</span>
      <BandChip band={run.band} />
    </span>
  );
}

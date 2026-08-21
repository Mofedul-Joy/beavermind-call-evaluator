"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RunSummary } from "@/scoring/types";
import { callTypeLabel, formatDate, formatUsd } from "@/lib/format";
import { FilterPill } from "./Pill";
import { BandChip } from "./BandChip";
import { ArrowRight } from "./Icons";

type Filter = "all" | "kickoff" | "coaching";

const FILTER_LABEL: Record<Exclude<Filter, "all">, string> = {
  kickoff: "kick-off",
  coaching: "coaching",
};

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

  if (runs.length === 0) return <EmptyState />;

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
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">
                  No {FILTER_LABEL[filter as Exclude<Filter, "all">]} calls scored yet.{" "}
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="font-medium text-ink underline decoration-border underline-offset-4 transition-colors hover:decoration-ink"
                  >
                    Show all {counts.all}
                  </button>
                </td>
              </tr>
            )}
            {filtered.map((run) => (
              /* The score is what people scan for, but nothing used to say the row
                 went anywhere. The arrow is parked outside the cell and slides in on
                 hover or keyboard focus, so the row reads as a door without adding a
                 permanent twelfth thing to look at. */
              <tr
                key={run.id}
                className="group border-b border-border transition-colors last:border-b-0 hover:bg-black/[.015] focus-within:bg-black/[.015]"
              >
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <Link
                    href={`/runs/${run.id}`}
                    className="font-medium text-ink decoration-border underline-offset-4 transition-colors group-hover:underline group-hover:decoration-ink"
                  >
                    {run.clientName ?? "Untitled"}
                  </Link>
                  {run.isSample && (
                    <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      Sample
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-body">{run.coachName ?? "—"}</td>
                <td className="px-5 py-3.5 text-body">{callTypeLabel(run.callType)}</td>
                <td className="px-5 py-3.5">
                  <ScoreCell run={run} />
                </td>
                <td className="px-5 py-3.5 tabular-nums text-body">
                  {run.costUsd !== null ? formatUsd(run.costUsd) : "—"}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-body">{formatDate(run.createdAt)}</td>
                <td className="pr-5 text-right align-middle">
                  <ArrowRight
                    size={14}
                    className="ml-auto -translate-x-1.5 text-muted opacity-0 transition duration-[var(--dur-state)] ease-[var(--ease-out-expo)] group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The first thing anyone opening this app sees, and until now it was the word
 * "None" inside an otherwise empty table. An empty state is the only screen with
 * the reader's full attention and nothing competing for it, so it explains what
 * the product does, what it costs in time, and hands over the one action.
 */
function EmptyState() {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
      <svg width="40" height="24" viewBox="0 0 200 116" aria-hidden="true">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="14"
          strokeLinecap="round"
        />
      </svg>
      <div className="space-y-1.5">
        <p className="font-medium text-ink">Nothing scored yet</p>
        <p className="mx-auto max-w-[46ch] text-sm leading-relaxed text-body">
          Paste a coaching or kick-off transcript and it gets scored against that call type&rsquo;s
          twelve-dimension rubric, with the transcript lines behind every number. Scoring takes two to four
          minutes and the report keeps its own URL.
        </p>
      </div>
      <Link
        href="/run"
        className="pill-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85"
      >
        Run the first evaluation
      </Link>
    </div>
  );
}

function ScoreCell({ run }: { run: RunSummary }) {
  if (run.status === "running" || run.status === "queued") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted">
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted motion-reduce:animate-none"
          aria-hidden="true"
        />
        Running…
      </span>
    );
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

"use client";

/**
 * A reusable clickable-timestamp list for `Moment[]` (see `src/delivery/types.ts`).
 *
 * There is no recording player wired up anywhere in this product yet, so clicking a
 * timestamp cannot actually seek anything. Instead of silently doing nothing (or lying
 * with a native tooltip), each click reveals a real, visible, keyboard-reachable stub
 * line saying exactly what would happen once playback exists.
 */

import { useState, type ReactElement } from "react";
import type { Moment } from "@/delivery/types";
import "./tone-tab.css";

function formatSec(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatMoment(m: Moment): string {
  return m.endSec === null ? formatSec(m.startSec) : `${formatSec(m.startSec)}–${formatSec(m.endSec)}`;
}

export function ToneMoments({ moments }: { moments: Moment[] }): ReactElement | null {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (moments.length === 0) return null;

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  return (
    <div className="tone-tab space-y-2">
      {moments.map((moment, i) => {
        const label = formatMoment(moment);
        const isOpen = expanded.has(i);
        return (
          <div key={i} className="text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                aria-label={`Jump to ${label}`}
                className="shrink-0 rounded font-mono text-[13px] tabular-nums underline decoration-[color:var(--tone-border)] underline-offset-2 hover:decoration-[color:var(--tone-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: "var(--tone-ink)" }}
              >
                {label}
              </button>
              <span style={{ color: "var(--tone-body)" }}>{moment.note}</span>
            </div>
            {isOpen && (
              <p className="mt-1 text-xs" style={{ color: "var(--tone-muted)" }}>
                {"↳"} Jumps to {label} once playback is wired up {"—"} no recording player exists yet.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

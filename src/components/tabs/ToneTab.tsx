"use client";

import { useState } from "react";
import type { DeliveryJob } from "@/delivery/types";
import "./tone-tab.css";
import { ToneEmpty } from "./ToneEmpty";
import { ToneRunning } from "./ToneRunning";
import { ToneFailed } from "./ToneFailed";
import { ToneQualityWarning } from "./ToneQualityWarning";
import { ToneMetricGrid } from "./ToneMetricGrid";
import { ToneTimeline } from "./ToneTimeline";

/**
 * The TONE tab. Renders inside a future `TabShell` — this component owns everything
 * below the tab bar, nothing above it. `job` is `null` when no recording was uploaded
 * (D11: tabs only appear when one was), matching what a report page will hold once
 * delivery analysis is wired into the live report.
 */
export function ToneTab({ job }: { job: DeliveryJob | null }) {
  const [swapped, setSwapped] = useState(false);

  if (!job) return <ToneEmpty />;
  if (job.status === "running") return <ToneRunning />;
  if (job.status === "failed") return <ToneFailed error={job.error} />;

  const { report } = job;
  const { roleAssignment } = report;

  // Turn-appearance order, shared with every metric panel below, so "Speaker A" always
  // means the same physical speaker whether you're reading a metric card or the timeline.
  const speakerOrder = Array.from(new Set(report.turns.map((t) => t.speaker)));

  const otherSpeakerId = report.speakers.find((s) => s.id !== roleAssignment.coachSpeakerId)?.id ?? null;
  const canSwap = roleAssignment.coachSpeakerId !== null && otherSpeakerId !== null;
  const displayCoachSpeakerId = swapped && canSwap ? otherSpeakerId : roleAssignment.coachSpeakerId;

  return (
    <div className="tone-tab space-y-6">
      <ToneQualityWarning notes={report.notes} />

      {!roleAssignment.confident && (
        <div className="tone-card space-y-2 px-4 py-3 text-sm" style={{ color: "var(--tone-body)" }}>
          <p>
            <span className="font-medium" style={{ color: "var(--tone-ink)" }}>
              Speaker roles are a guess.
            </span>{" "}
            {roleAssignment.method} (margin {(roleAssignment.margin * 100).toFixed(0)}%).{" "}
            {canSwap
              ? 'If "Coach" and "Client" look swapped below, every per-speaker number here is reversed too.'
              : "Speakers are shown as Speaker A / Speaker B until a coach can be identified."}
          </p>
          {canSwap && (
            <button
              type="button"
              onClick={() => setSwapped((v) => !v)}
              aria-pressed={swapped}
              className="text-xs font-medium underline decoration-[var(--tone-border)] underline-offset-4 hover:opacity-80"
              style={{ color: "var(--tone-ink)" }}
            >
              {swapped ? "Swap back to the original guess" : "Swap Coach and Client labels"}
            </button>
          )}
        </div>
      )}

      <section className="space-y-3">
        <p className="tone-micro-label">Vocal delivery</p>
        <ToneMetricGrid
          metrics={report.metrics}
          coachSpeakerId={displayCoachSpeakerId}
          speakerOrder={speakerOrder}
          initialCount={4}
        />
      </section>

      <section className="space-y-3">
        <p className="tone-micro-label">Turn boundaries</p>
        <div className="tone-card p-4">
          <ToneTimeline
            turns={report.turns}
            utterances={report.utterances}
            durationSec={report.media.durationSec}
            coachSpeakerId={displayCoachSpeakerId}
          />
        </div>
      </section>
    </div>
  );
}

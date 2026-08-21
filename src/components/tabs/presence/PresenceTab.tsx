"use client";

import { useState } from "react";
import type { PresenceJob, PresenceMetricKey } from "./types";
import { SummaryStrip } from "./SummaryStrip";
import { MetricList } from "./MetricList";
import { SceneFramesStrip } from "./SceneFramesStrip";
import { QualityWarning } from "./QualityWarning";
import { PresenceEmptyState } from "./PresenceEmptyState";
import { PresenceRunningState } from "./PresenceRunningState";
import { PresenceFailedState } from "./PresenceFailedState";
import { LockIcon } from "./icons";
import { muted } from "./theme";

/**
 * The PRESENCE tab. Self-contained — a `TabShell` elsewhere is expected to render this
 * inside its own tab body and pass a `PresenceJob`; this file does not read from or write
 * to any run/report state itself (D11: PRESENCE never touches the pasted-transcript
 * surface, and this build never wires into `RunPageClient`).
 *
 * Numbers only, never a composite score, never an emotion label — see `types.ts` and
 * `DECISIONS.md` D3/D9-D12.
 */
export function PresenceTab({ job }: { job: PresenceJob }) {
  const [openKey, setOpenKey] = useState<PresenceMetricKey | null>(null);

  if (job.status === "empty") return <PresenceEmptyState />;
  if (job.status === "running") return <PresenceRunningState />;
  if (job.status === "failed") return <PresenceFailedState error={job.error} />;

  const { report } = job;

  function selectMetric(key: PresenceMetricKey) {
    setOpenKey(key);
    document.getElementById(`presence-metric-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="space-y-4">
      <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
        <LockIcon size={13} />
        Measured on-device from the video — facing-camera time, head and posture angles, gesture rate, framing.
        Never an emotion or engagement score.
      </p>

      <QualityWarning notes={report.notes} />

      <SummaryStrip metrics={report.metrics} onSelect={selectMetric} />
      <MetricList metrics={report.metrics} openKey={openKey} onOpenKey={setOpenKey} />
      <SceneFramesStrip frames={report.sceneFrames} />
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Run } from "@/scoring/types";
import type { DeliveryJob } from "@/delivery/types";
import { TabShell, type TabKey } from "./TabShell";
import { ReportView } from "./ReportView";
import { ToneTab } from "./tabs/ToneTab";
import { UploadCapture } from "./UploadCapture";

/**
 * The report, and the tabs that only exist once a recording is attached.
 *
 * D11's rule is that a paste-only run renders exactly the briefed report with no tab bar,
 * so `tabsAvailable` is derived from whether a recording was actually uploaded rather than
 * from what this build happens to be able to render. TRANSCRIPT is the briefed report
 * itself, not a listing of the transcript: the scored analysis is what the transcript
 * produced, and a second place to read the raw lines would compete with the evidence that
 * already sits under every dimension.
 *
 * PRESENCE is deliberately not in this list yet. The tab is built and reachable at
 * `/dev/presence`, but the in-browser MediaPipe pass that would produce a real
 * `PresenceReport` does not exist, and a tab that renders fixture numbers on somebody's
 * actual call is the one thing this product cannot do.
 */
export function ReportTabs({ run, onRun }: { run: Run; onRun?: (run: Run) => void }) {
  const hasRecording = run.deliveryStatus !== "none";
  const tabsAvailable: TabKey[] = hasRecording ? ["transcript", "tone"] : ["transcript"];
  const [activeTab, setActiveTab] = useState<TabKey>("transcript");
  const tab = tabsAvailable.includes(activeTab) ? activeTab : "transcript";

  if (!run.report) return null;

  return (
    <div className="space-y-12">
      <TabShell activeTab={tab} tabsAvailable={tabsAvailable} onChange={setActiveTab}>
        {tab === "transcript" && <ReportView report={run.report} />}
        {tab === "tone" && <ToneTab job={deliveryJob(run)} />}
      </TabShell>

      {/* The only way to attach a recording in the live app. Kept below the report and
          behind its own label so a paste-only run still reads as the briefed report from
          top to bottom, with the extension offered at the end rather than announced at
          the top. */}
      {!hasRecording && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="micro-label">Delivery analysis</h2>
            <p className="text-xs text-muted">Optional</p>
          </div>
          <p className="mb-4 max-w-[68ch] text-sm leading-relaxed text-body">
            The rubric only sees words. Attach the call recording and the vocal delivery behind
            them gets measured too: talk ratio, pace, pauses, interruptions, pitch and energy
            variance, each against a published benchmark.
          </p>
          <UploadCapture runId={run.id} onRun={onRun} />
        </section>
      )}
    </div>
  );
}

/**
 * The run row, as the shape the TONE tab was built against.
 *
 * `null` rather than a `'done'` job with an empty report when nothing was uploaded: the tab
 * renders its own empty state from that, and inventing a report to hand it would be the
 * beginning of exactly the wrong habit.
 */
function deliveryJob(run: Run): DeliveryJob | null {
  switch (run.deliveryStatus) {
    case "processing":
      return { status: "running", report: null };
    case "done":
      return run.deliveryReport ? { status: "done", report: run.deliveryReport } : null;
    case "failed":
      return {
        status: "failed",
        report: null,
        error: run.deliveryError?.message ?? "The delivery worker did not finish.",
      };
    default:
      return null;
  }
}

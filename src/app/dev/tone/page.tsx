"use client";

import { useState } from "react";
import type { DeliveryJob } from "@/delivery/types";
import { STRONG_TONE_REPORT, WEAK_TONE_REPORT } from "@/fixtures/tone";
import { ToneTab } from "@/components/tabs/ToneTab";

/**
 * Own test route for the TONE tab — TabShell (which will host this in the real report
 * page) doesn't exist in this worktree yet. Not wired into any live route.
 * Dark mode follows the OS/browser `prefers-color-scheme`, same as the rest of the tab.
 */
const STATES = {
  empty: { label: "Empty (no recording)", job: null as DeliveryJob | null },
  running: { label: "Running", job: { status: "running", report: null } as DeliveryJob },
  failed: {
    label: "Failed",
    job: { status: "failed", report: null, error: "The delivery worker crashed while diarizing." } as DeliveryJob,
  },
  strong: { label: "Strong call", job: { status: "done", report: STRONG_TONE_REPORT } as DeliveryJob },
  weak: { label: "Weak call", job: { status: "done", report: WEAK_TONE_REPORT } as DeliveryJob },
} as const;

export default function ToneDevPage() {
  const [key, setKey] = useState<keyof typeof STATES>("strong");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <p className="micro-label">Dev harness — not a real route</p>
        <h1 className="text-xl font-medium text-ink">ToneTab fixtures</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATES) as (keyof typeof STATES)[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              key === k ? "border-ink bg-ink text-white" : "border-border bg-white text-body hover:border-ink/30"
            }`}
          >
            {STATES[k].label}
          </button>
        ))}
      </div>
      <ToneTab job={STATES[key].job} />
    </div>
  );
}

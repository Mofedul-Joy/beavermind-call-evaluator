"use client";

import { useState } from "react";
import { TabShell, type TabKey } from "@/components/TabShell";

const TABS_AVAILABLE: TabKey[] = ["transcript", "tone", "presence"];

export function TabShellDemo({ lines }: { lines: { n: number; speaker: string; text: string }[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("transcript");

  return (
    <div className="card p-6">
      <TabShell activeTab={activeTab} tabsAvailable={TABS_AVAILABLE} onChange={setActiveTab}>
        {activeTab === "transcript" && <TranscriptPanel lines={lines} />}
        {activeTab === "tone" && (
          <PlaceholderPanel text="TONE content lands here — built by a sibling worktree." />
        )}
        {activeTab === "presence" && (
          <PlaceholderPanel text="PRESENCE content lands here — built by a sibling worktree." />
        )}
      </TabShell>
    </div>
  );
}

function TranscriptPanel({ lines }: { lines: { n: number; speaker: string; text: string }[] }) {
  return (
    <ul className="divide-y divide-border">
      {lines.map((l) => (
        <li key={l.n} className="flex gap-3 py-2.5 text-sm">
          <span className="w-6 shrink-0 tabular-nums text-xs text-muted">{l.n}</span>
          <span className="w-32 shrink-0 font-medium text-ink">{l.speaker}</span>
          <span className="text-body">{l.text}</span>
        </li>
      ))}
    </ul>
  );
}

function PlaceholderPanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
      {text}
    </div>
  );
}

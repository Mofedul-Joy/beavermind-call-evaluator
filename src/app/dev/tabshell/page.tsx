import fixtureRuns from "@/fixtures/runs.json";
import { TabShellDemo } from "./TabShellDemo";

/**
 * `/dev/tabshell` — review-only demo of `TabShell`, never linked from the live app.
 *
 * Proves the shell's mechanics (tab switching, active state, keyboard nav, ARIA) against a
 * real fixture transcript. TONE and PRESENCE panels are placeholder content only — their
 * real content is built by sibling worktrees this app doesn't wire in here.
 */
export default function TabShellDevPage() {
  const transcript = fixtureRuns[0].transcript as {
    lines: { n: number; speaker: string; text: string }[];
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="micro-label">Dev only · not linked from the app</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">TabShell</h1>
      <p className="mt-2 text-sm text-body">
        Fixture: {fixtureRuns[0].clientName} · {fixtureRuns[0].callType}
      </p>

      <div className="mt-8">
        <TabShellDemo lines={transcript.lines} />
      </div>
    </main>
  );
}

import { PresenceTab } from "@/components/tabs/presence/PresenceTab";
import { PRESENCE_STRONG, PRESENCE_WEAK } from "@/components/tabs/presence/fixtures";
import type { PresenceJob } from "@/components/tabs/presence/types";

/**
 * Dev-only preview harness for the PRESENCE tab, isolated from every real route. Not
 * linked from anywhere in the app and not wired into `RunPageClient`/`ReportView` — those
 * stay untouched per the build brief. Delete or gate before the real TabShell integration
 * pass picks this up.
 *
 * `?variant=strong|weak|empty|running|failed` — see `NOTES-presence.md` §Pre-prod test.
 */
export default async function PresenceDevPreview({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant = "strong" } = await searchParams;

  const job: PresenceJob =
    variant === "empty"
      ? { status: "empty" }
      : variant === "running"
        ? { status: "running" }
        : variant === "failed"
          ? { status: "failed", error: "Couldn't decode the video track — the file may be corrupted." }
          : { status: "done", report: variant === "weak" ? PRESENCE_WEAK : PRESENCE_STRONG };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Declares that this page itself handles both schemes, so Chrome's auto-dark
          heuristic (which otherwise repaints unstyled elements like AppHeader) stands
          down and only this tab's own `dark:` classes are what's under test. */}
      <meta name="color-scheme" content="light dark" />
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {["strong", "weak", "empty", "running", "failed"].map((v) => (
          <a
            key={v}
            href={`/dev/presence?variant=${v}`}
            className={`rounded-full border border-border px-2.5 py-1 ${v === variant ? "bg-ink text-white" : "text-body"}`}
          >
            {v}
          </a>
        ))}
      </div>
      <PresenceTab job={job} />
    </div>
  );
}

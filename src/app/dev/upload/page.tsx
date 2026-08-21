import { createRun } from "@/server/runs";
import { UploadCapture } from "@/components/UploadCapture";

// A fresh run has to be created on every visit, not baked in at build time — otherwise
// every visitor would share (and race on) one frozen run id.
export const dynamic = "force-dynamic";

/**
 * `/dev/upload` — review-only demo of `UploadCapture`, never linked from the live app.
 *
 * Needs a real run id to attach a recording to (the API 404s otherwise). A fixture id
 * wouldn't do — fixtures are static JSON, not necessarily seeded rows in the live DB — so
 * this calls `src/server/runs.ts`'s `createRun` directly at page load, the same function
 * `POST /api/runs` wraps, and gets back a fresh row with nothing else attached.
 *
 * The row is created `queued` and left there; nothing here calls `runScoring`, so loading
 * this page never spends an Anthropic call. It does spend one slot of the real per-IP and
 * daily rate limits (D7), same as any other run — acceptable for a dev-only page, and this
 * page only needs to be loaded once per manual test session since `UploadCapture` can
 * retry against the same run id indefinitely.
 */
export default async function UploadDevPage() {
  const result = await createRun({
    transcript: "[Coach]: Hey, thanks for joining today.\n[Client]: Of course, glad to be here.",
    callType: "kickoff",
    coachName: "Dev upload demo",
    clientName: "Dev upload demo",
    // `claim_run_slot`'s `p_ip` param is Postgres `inet`, so this has to parse as one — a
    // fixed, distinct-from-real-traffic address, not a real client IP.
    clientIp: "127.0.0.2",
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="micro-label">Dev only · not linked from the app</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Upload capture</h1>
      <p className="mt-2 text-sm text-body">
        Real upload, straight to Supabase Storage, against a fresh run created just for this page load.
      </p>

      <div className="mt-8">
        {result.ok ? (
          <UploadCapture runId={result.id} />
        ) : (
          <div className="card px-6 py-8 text-sm text-red-ink">
            Could not create a demo run right now ({result.code}). This page is rate-limited like any other run —
            wait a moment and reload.
          </div>
        )}
      </div>
    </main>
  );
}

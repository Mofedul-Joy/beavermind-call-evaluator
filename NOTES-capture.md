# Notes — capture (upload + Modal wiring + standalone TabShell)

## What shipped

**Recording capture.** Browser-direct-to-Supabase-Storage upload (D2): a signed upload URL
is minted server-side, the browser PUTs straight to Storage (never through Vercel's 4.5 MB
body cap), and the server hands a signed *read* URL to the already-deployed Modal worker.
The worker calls back into `/api/delivery/callback` with the finished `DeliveryReport` when
done — this app never polls Modal's `/result`.

**DB migration.** Additive columns on `runs` (`recording_path`, `recording_filename`,
`delivery_status`, `delivery_call_id`, `delivery_report`, `delivery_error`,
`delivery_started_at`, `delivery_finished_at`), a private `recordings` Storage bucket (50 MB
cap, no RLS policies — only the admin client ever touches it), and `reap_stale_deliveries`
mirroring the existing `reap_stale_runs`, wired into the same `daily_heartbeat`. Applied for
real against the live DB.

**API routes.** `POST /api/runs/[id]/recording/upload-url`, `POST
/api/runs/[id]/recording/complete`, `POST /api/delivery/callback`. All three are graceful by
design — a missing token or an unreachable worker lands as `deliveryStatus: 'failed'` with a
sentence a human can act on, never a 500.

**`UploadCapture`.** Drag/drop + file-picker component, states `idle → uploading →
processing → done | failed`, with an honest indeterminate progress state (no fake percentage
— `uploadToSignedUrl` is fetch-based and has no byte-progress event) and a real elapsed-time
counter during analysis. Demoed at `/dev/upload` against a fresh real run created per page
load — not wired into `RunPageClient.tsx`/`ReportView.tsx`, which are owned elsewhere.

**`TabShell`.** Standalone tab-bar contract for TRANSCRIPT/TONE/PRESENCE (D11). Demoed at
`/dev/tabshell` against a fixture transcript, TONE/PRESENCE panels showing placeholder
content. Not wired into the live report page.

## The TabShell contract (for the TONE/PRESENCE sibling builds to import)

```ts
export type TabKey = "transcript" | "tone" | "presence";

export type TabShellProps = {
  activeTab: TabKey;
  tabsAvailable: TabKey[];   // presence, not permission — TRANSCRIPT always in it
  onChange: (tab: TabKey) => void;
  children: React.ReactNode; // the ACTIVE panel's content; caller swaps it on activeTab change
};
```

Single swapped child, not three named slots — the caller already owns `activeTab` state (it
has to, to compute `tabsAvailable`), so it already knows which panel to render; a three-slot
API would force building all three panels every render just to hand them over.
`tabsAvailable.length <= 1` renders no tab bar at all, which is what keeps a paste-only run
pixel-identical to the briefed report (D11). Full WAI-ARIA tabs pattern: `role="tablist"` /
`"tab"` / `"tabpanel"`, roving `tabIndex`, Left/Right/Home/End keyboard nav.

## A real bug found and fixed after the build agents finished

`DELIVERY_WORKER_TOKEN` was unavailable to every build agent (no Modal CLI in this
environment, no record of it anywhere in the repo) — all three were told to leave it as a
placeholder and build against the resulting `401` failure path. Partway through my own
verification pass, a real token appeared in `.env.local` (supplied out of band, matching the
project's established pattern for secrets no agent can retrieve on its own — see
`NOTES-backend.md`'s `DATABASE_URL` note for precedent). That flipped `/recording/complete`
from always-fails to sometimes-succeeds, and exposed a bug none of the building agents could
have caught: **`UploadCapture` treated the worker successfully *starting* the job
(`deliveryStatus: 'processing'`) as the analysis being *done*.** With only the placeholder
token available, `/complete` always returned a terminal `failed` synchronously, so the
`processing` branch — where the real answer arrives minutes later via callback — was never
exercised by anyone until I drove it live against the working worker and watched "test-
recording.mp3 attached — analysis complete" render seconds after upload, while the DB still
said `processing`.

Fixed by adding a poll loop (`pollUntilSettled` in `UploadCapture.tsx`, using the existing
`fetchRun` from `src/lib/run-client.ts`) that keeps the UI in `processing` until
`deliveryStatus` actually reaches `done` or `failed` — the same shape `RunPageClient.tsx`
already uses to poll a run's scoring status. Verified live: uploaded a real file against the
real worker, watched the UI correctly hold at "Analysing… N:NN" past five real minutes while
the underlying job (garbage test bytes, so it never legitimately finishes) stayed
`processing` server-side, with no console errors.

## Adversarial review — two findings, both fixed

Ran `adversarial-reviewer` on the full diff. It found a real HIGH-severity race and a MEDIUM
UX/data-integrity gap that enables it:

1. **HIGH — no correlation between a callback and the specific worker call that produced
   it.** `completeDelivery` only checked `delivery_status = 'processing'`, not *which*
   attempt. Concretely: upload A starts (worker A running, 5-12 min), operator uploads B for
   the same run before A finishes, `startDelivery` silently overwrote A's row with B's
   filename and started worker B — then A's report (arriving later) would land on the row
   under the guard's nose (`processing` was still true), overwriting B's filename with A's
   report, and B's real result would be silently discarded forever when it finally arrived
   (`processing` was no longer true).

   Fixed two ways, both server-side, in `src/server/delivery.ts`:
   - `startDelivery` now refuses to start a second delivery while one is already
     `processing` for the run — it returns the current in-flight state unchanged rather than
     starting a competing job. No two jobs for one run can ever be in flight at once.
   - Independently, an `attempt` correlation token (our own UUID, not Modal's `call_id`,
     generated before we know Modal's) is stored on the row and embedded in the callback
     URL. `completeDelivery` now requires **both** `delivery_status = 'processing'` **and**
     `delivery_call_id = attempt` to accept a callback. This closes the residual gap the
     first fix alone doesn't: a worker call reaped as stale after 15 minutes, then
     superseded by a *third* attempt, whose late callback would otherwise land on the wrong
     row purely because status happened to read `processing` again by then.

   Verified live against the real DB and the real callback route: a callback with the wrong
   `attempt` value is rejected (`applied: false`, row unchanged); the correct one succeeds.
   A second upload attempt while the first is `processing` is proven to leave
   `recordingFilename` pointing at the first file, not the second.

2. **MEDIUM — `UploadCapture` never checked the run's actual delivery state on mount**, so a
   page reload mid-analysis dropped the operator back into an empty dropzone — both a
   standalone UX dead end (the "Analysing… 4:32" state and its elapsed timer are lost with
   no way back short of guessing to wait) and the direct trigger for Finding 1 (the empty
   dropzone invites exactly the re-upload that caused the race). Fixed with a resume-on-mount
   effect: `UploadCapture` now calls `fetchRun` once when it mounts and seeds `phase` from
   the run's real `deliveryStatus` — resuming the poll if `processing`, showing `done`/
   `failed` if already settled, `idle` only if there is genuinely nothing there yet. Verified
   live: mounted the component against a run with a real in-flight delivery and confirmed it
   renders directly into "Analysing resume-test.mp3… 0:01" instead of the dropzone.

## Judgment calls

- **`UploadCapture` demoed at `/dev/upload`, not mounted into `RunPageClient.tsx`.** The
  protected-files list names the live report page's components but not `PasteForm.tsx` or
  `run/page.tsx`, so I could have wired attachment into the run-creation flow — but the two
  components' submit paths don't share state without editing `PasteForm.tsx` (explicitly
  off-limits per task 3.1: "does NOT touch the paste form"), and the more natural mount point
  — attaching a recording to an *existing* run on its report page — is inside the protected
  `RunPageClient.tsx`. Treated this the same way task 3.4 explicitly treats `TabShell`: build
  it fully functional, demo it for real, leave the actual mount point for the integration
  pass once TONE/PRESENCE content exists to go with it.
- **Callback correlation uses our own UUID, not Modal's `call_id`.** Modal's `call_id` only
  exists after `/start` responds, but the callback URL — which needs to carry the
  correlation token — is built and sent *in* that same request. Generating our own token up
  front and never depending on Modal's response body for anything but success/failure was
  simpler than threading a two-phase handshake through `/start`.
- **No `storage.objects` RLS policies**, matching the codebase's existing posture (`runs`
  itself only exposes `select-by-id`+`insert` to `anon`; everything else is server-only).
  Only the secret-key admin client ever mints a URL in either direction, so default-deny is
  correct and adds no complexity.

## Parked, not mine to fix

- **`node_modules` was a symlink to `code/evaluator/node_modules`** pointing outside this
  worktree, which crashes Turbopack (`Symlink … points out of the filesystem root`) — the
  same problem `NOTES-backend.md` already flagged as unavoidable. Replaced with a real
  `npm install` in this worktree before any build agent started, matching what `wt-backend`/
  `wt-frontend` already independently did.
- **A sibling agent shared this worktree mid-build** (the TabShell agent observed `git reset:
  moving to HEAD` entries in the reflog from a concurrent process — turned out to be my own
  backend agent working in parallel in the same directory, not a separate session). Checked
  the reflog and `git status` afterward: HEAD never moved, nothing was lost, every expected
  file from both agents landed intact. Ran all three build agents in the same worktree rather
  than isolated `worktree:` sandboxes since none of their file sets genuinely overlapped —
  worth using isolation next time two agents touch the same repo concurrently, even when the
  file sets are believed disjoint.
- **No real end-to-end Modal analysis was observed completing.** The worker is live and
  reachable (confirmed via `/health` and via `/start` genuinely accepting a job and returning
  `processing`), but no real audio/video sample exists anywhere in this workspace to upload —
  every live test used a few KB of random bytes, which either never reaches the callback
  stage (the worker errors internally on non-media input before it gets there) or would take
  the full 5-12 minutes even if it did. The full happy path — worker actually transcribing
  and measuring a real recording — is proven only up to the point Modal takes over; everything
  before and after (upload, signed URLs, `/start` acceptance, callback delivery, the
  correlation guard, the staleness reaper) is verified for real. See `VERIFY-capture.md`.

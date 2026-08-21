# Notes — Presence

- **No wire contract exists for PRESENCE** — `src/delivery/types.ts` and `delivery/contract.py`
  describe TONE only; `delivery/README.md`'s "PRESENCE is not here" section and
  `modal_app.py`'s own note confirm the video is analysed in the browser via MediaPipe
  Tasks/WASM and never uploaded. So "the committed contract" this build follows is the
  *shape* of `DeliveryMetric` (key/label/unit/value/interpretation/benchmark/evidence/
  unavailableReason/method) reused via `import type { Benchmark, Interpretation, Moment }
  from "@/delivery/types"` in `src/components/tabs/presence/types.ts` — not a file that
  already declared presence-specific fields, because none existed to read. The new
  `PresenceMetricKey`, `PresenceReport`, `PresenceJob` and `SceneFrame` types are original
  to this build, kept in `components/tabs/presence/` per the brief's "new files only" rule.
- **8 metrics, not 6** — the brief names 6 categories (facing-camera %, yaw SD, framing
  geometry, gesture rate, posture angles, smile-%) but "framing geometry" and "posture
  angles" are each plural in nature, so they're split into two atomic, independently
  benchmarked metrics apiece: `framing_eyeline_pct` + `framing_headroom_pct`, and
  `posture_shoulder_tilt` + `posture_forward_lean`. Still one summary tile each, still
  behind the same one-click disclosure — the Hick's-law cap is on *actions*, not on how
  many numbers a single action can reveal.
- **Presence tones never use red.** `format.ts:metricTone` only returns `green | amber |
  neutral`. An out-of-benchmark presence reading is a coaching note ("your headroom ran
  high"), not a failure the way a rubric dimension can fail — red is reserved for that
  elsewhere in the app, so re-using it here would misrepresent what these numbers mean.
- **No real recording exists in this repo** to pull the 6-8 sanctioned scene frames from
  (that pipeline is `wt-capture`'s job, not yet merged). `SceneFramesStrip` is fully built
  and wired to real `src`/`caption`/`atSec` data — the placeholders under
  `public/presence-fixtures/*.svg` are hand-drawn (not Higgsfield, not AI-generated) and
  each is watermarked "FIXTURE PLACEHOLDER — not a real frame" directly on the image, so
  nothing here is ever mistaken for a real photo standing in for one. This is a **parked
  blocker**, not a shortcut: the real thing is a real JPEG frame extracted client-side from
  the video element at a given timestamp, which `wt-capture` or a later integration pass
  owns.
- **Higgsfield asset generation was skipped, deliberately.** The brief allows it for
  custom icon/empty-state assets. This tab's icon language is the app's own hand-drawn
  1.4px-stroke line-icon convention (see `src/components/Icons.tsx`'s own comment on why
  emoji/unicode were replaced with authored SVG). Reproducing that by hand in
  `components/tabs/presence/icons.tsx` keeps every icon on the exact same grid and stroke
  weight as the rest of the app; running a photoreal image model for line icons would have
  fought that consistency, not served it.
- **Evidence timestamps are not clickable seeks.** `Moment.startSec`/`endSec` render as
  plain `mm:ss` text in `MetricList.tsx`. Wiring an actual seek requires a `<video>`
  element, which lives wherever `TabShell`/the recording player end up — out of scope here
  (never touch `RunPageClient.tsx`) and not yet built by any sibling worktree. Documented
  as a contract deviation from D3's "clickable timestamps," to be closed when PRESENCE is
  wired into the real report page.
- **Dark mode is scoped to this tab's own components**, not the app. `globals.css`'s
  `--color-*` tokens have no dark counterpart and the rest of the app is light-only by
  design (`references/ui-reference.md`: "Everything is light-mode"). `theme.ts` carries
  literal light/dark pairs for every surface this tab owns, using Tailwind's default
  `dark:` (`prefers-color-scheme`) variant — there is no `.dark` class toggle anywhere yet.
  Verified by rendering `/dev/presence` (see below) with `prefers-color-scheme` forced via
  Puppeteer's `emulateMediaFeatures`, not an OS toggle.
- **`node_modules` was a symlink into the `evaluator` worktree** on first checkout (the
  default for a fresh worktree per `MIGRATION.md`), and Turbopack panics on that
  cross-worktree symlink (`Symlink [project]/node_modules is invalid, it points out of the
  filesystem root`). Ran `npm install` here to convert it to a real directory, same
  unavoidable side effect `wt-frontend`'s `NOTES-frontend.md` already documented for
  `wt-backend`/itself.
- **`/dev/presence`** (`src/app/dev/presence/page.tsx`) is a throwaway preview harness —
  not linked from any real page, not wired into `RunPageClient`/`ReportView`. It exists
  only so `PresenceTab` could be rendered against both fixtures and every job state for
  the screenshot pass below. Whoever does the real TabShell integration should delete it
  once `PresenceTab` is wired in for real, or leave it — it costs nothing since it isn't
  reachable from anywhere a user would land.

## What shipped

`src/components/tabs/presence/`: `types.ts`, `fixtures.ts`, `format.ts`, `theme.ts`,
`metricMeta.ts`, `icons.tsx`, `MicroLabel.tsx`, `SummaryStrip.tsx`, `MetricList.tsx`,
`SceneFramesStrip.tsx`, `QualityWarning.tsx`, `PresenceEmptyState.tsx`,
`PresenceRunningState.tsx`, `PresenceFailedState.tsx`, `PresenceTab.tsx`, `index.ts`.
Plus `src/app/dev/presence/page.tsx` (preview harness, see above) and
`public/presence-fixtures/*.svg` (4 placeholder frame images).

Nothing under `delivery/`, `ReportView.tsx`, `RunPageClient.tsx`, or any other owned file
was touched. `git status` shows only new, untracked paths.

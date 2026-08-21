# Verify — Presence

## 1. Typecheck, build, lint, tests

All run from `/Users/md.mofedulalamjoy/Downloads/ICM/.tmp/beavermind/code/wt-presence`.

`npx tsc --noEmit` — exit 0, no output (clean).

`npx eslint src/components/tabs/presence src/app/dev/presence` — exit 0, no output (clean).

`npm test` — 31/31 passing (pre-existing scoring-engine suite; presence build adds no
model/network-touching code, so it has no unit tests of its own beyond typecheck + the
render/visual pass below):

```
ℹ tests 31
ℹ suites 4
ℹ pass 31
ℹ fail 0
```

`npx next build`:

```
✓ Compiled successfully in 778ms
  Running TypeScript ...
  Finished TypeScript in 4.1s ...
✓ Generating static pages using 7 workers (8/8) in 1009ms

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/cron/heartbeat
├ ƒ /api/pdf/[id]
├ ƒ /api/runs
├ ƒ /api/runs/[id]
├ ƒ /dev/presence
├ ƒ /print/[id]
├ ƒ /run
└ ƒ /runs/[id]
```

`/dev/presence` is the throwaway preview harness (see NOTES) — it builds like any other
route, isn't linked from anywhere real, and doesn't touch `RunPageClient`/`ReportView`.

## 2. Rendered against both fixtures, every job state, both breakpoints, both schemes

Dev server on `:4127`, driven with `puppeteer-core` against local Chrome (the same local
fallback the PDF route already uses in this repo) — the shared chrome-devtools/Playwright
MCP browser profiles were locked by sibling worktree agents running concurrently, so this
went through the project's own puppeteer dependency instead, with its own isolated
`userDataDir`. Dark/light forced via `page.emulateMediaFeatures([{name:
"prefers-color-scheme", value: ...}])`, not an OS toggle.

Screenshots in `screenshots/`:

- `presence-strong-light-375.png` / `presence-strong-dark-375.png` — strong-presence
  fixture, mobile, light and dark. Summary strip (2-col at 375px), accordion list, scene
  frames strip all readable, no overflow.
- `presence-strong-light-desktop.png` / `presence-strong-dark-desktop.png` — same fixture,
  desktop width, 4-col summary strip.
- `presence-weak-light-375.png` — weak-presence fixture at 375px: amber tone on every
  out-of-benchmark metric (facing camera 54% vs 80% target, eye line 61% vs 33-45% range,
  headroom 24% vs 5-15%, shoulder tilt 9.4° vs 5° target), the `value: null` /
  "Not available" path on forward lean rendering instead of a false 0, and the two-note
  `QualityWarning` banner (480p/15fps + backlight explanation).
- `presence-weak-dark-desktop.png` — same fixture, dark, desktop.
- `presence-weak-expanded.png` — Facing camera row expanded: benchmark sentence, `METHOD`
  disclosure (the actual MediaPipe Face Landmarker computation), and the evidence moment
  ("23:20–25:40 Longest off-camera stretch — turned toward a second screen") all present.
- `presence-empty-light.png` — no-recording state: camera icon, explanation, the
  never-leaves-this-device privacy line.
- `presence-running-light.png` — in-browser-analysis state: spinner, "Reading body
  language in your browser…", explicit "video is never uploaded" copy.
- `presence-failed-dark.png` — failed state: amber "PRESENCE ANALYSIS FAILED" label, the
  error message, reassurance that TRANSCRIPT/TONE are unaffected, and the likely cause.

## 3. No horizontal overflow at 375px

Scripted check (`document.documentElement.scrollWidth` vs `window.innerWidth`) across
every job state:

```
strong  { scrollWidth: 375, innerWidth: 375 }
weak    { scrollWidth: 375, innerWidth: 375 }
empty   { scrollWidth: 375, innerWidth: 375 }
running { scrollWidth: 375, innerWidth: 375 }
failed  { scrollWidth: 375, innerWidth: 375 }
```

## 4. Interaction

Clicking a `SummaryStrip` tile scrolls to and opens the matching `MetricList` row
(confirmed in `presence-weak-expanded.png` — clicking the "Facing camera" tile opened
that row and scrolled it into view). Each row's own chevron independently opens/closes
without affecting the others.

## 5. Adversarial review

Ran via the `adversarial-reviewer` subagent (a different model from the one that built
this) against every file listed above plus the hard constraints from the goal (no touched
owned files, no composite score, no emotion label, `benchmark.source` always populated,
`value: null` always paired with `unavailableReason`, scene captions never about the
person, tsc/build/test green — it re-ran all three itself rather than trusting this doc).
Verdict: FIX FIRST, no BLOCK-level finding. Three findings, all fixed:

1. **(Medium, fixed)** `PRESENCE_STRONG.notes` carried `"Video is 1080p at 30fps — no
   input-quality caveats."`, and `QualityWarning` renders any non-empty `notes` as an
   amber warning banner — so the very first screen `/dev/presence` opens to (the default
   `strong` variant) showed a warning-triangle banner that said, in as many words, there
   was nothing to warn about. Fixed by dropping the string; `notes: []` already makes
   `QualityWarning` return `null`. Re-verified in the re-taken
   `screenshots/presence-strong-light-desktop.png` — no banner, tighter layout.
2. **(Low, fixed)** `formatMmSs` rounded seconds without carrying into the minute
   (`formatMmSs(299.6)` → `"4:60"` instead of `"5:00"`) — didn't show up in the fixtures
   (whole-second timestamps only) but would on real MediaPipe output sampled at 5fps.
   Fixed in `format.ts` to roll `s === 60` into `m += 1`.
3. **(Low, a11y, fixed)** Scene-frame thumbnail buttons had `alt=""` on the image and no
   other accessible name, so a screen reader announced only the timestamp badge with no
   cue a captioned frame was behind it. Fixed by adding `aria-label={mm:ss — caption}`
   and `aria-expanded` to each thumbnail button in `SceneFramesStrip.tsx`.

Re-ran `npx tsc --noEmit`, `npx eslint`, `npm test`, `npx next build` after all three
fixes — all clean, same as §1.

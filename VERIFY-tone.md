# Verify — TONE tab

## 1. Build, typecheck, lint, tests

`npx next build` (Turbopack) — clean:

```
✓ Compiled successfully in 2.5s
  Running TypeScript ...
  Finished TypeScript in 8.0s ...
✓ Generating static pages using 7 workers (8/8) in 398ms
```

Route table includes `○ /dev/tone` (static, my dev-only test route).

`npx eslint src/components/tabs src/fixtures/tone.ts src/app/dev/tone` — 0 problems.

`npm test` — 31/31 passing (pre-existing scoring-engine tests, unaffected by this work):

```
ℹ tests 31
ℹ pass 31
ℹ fail 0
```

`git diff --stat -- package.json package-lock.json` — empty. No new dependencies.

## 2. Scope check

`git status --porcelain` shows only new, untracked files — nothing pre-existing was
modified:

```
src/components/tabs/{tone-tab.css,ToneTab,ToneEmpty,ToneRunning,ToneFailed,
  ToneQualityWarning,ToneMetricPanel,ToneMetricGrid,ToneMoments,ToneTimeline}.tsx
src/fixtures/tone.ts
src/app/dev/tone/page.tsx
screenshots/tone-*.png (this file's evidence)
```

None of the off-limits files (`ReportView.tsx`, `RunPageClient.tsx`, `DimensionRow.tsx`,
`EvidenceQuotes.tsx`, `RedFlags.tsx`, `RunHeader.tsx`, `ScoreGauge.tsx`, `TheOneThing.tsx`,
`globals.css`, `layout.tsx`, `AppHeader.tsx`, `Icons.tsx`, any `delivery/` file) were
touched.

## 3. Adversarial review

Ran the `adversarial-reviewer` subagent against the full diff. Verdict: FIX FIRST, five
findings, no contract violations (no composite score, no emotion language anywhere, no
fabricated benchmark numbers, no silent-no-op or `alert()` stubs). All five fixed and
re-verified in a real browser afterward — see `NOTES-tone.md` for what each one was and
the fix. Re-ran build/typecheck/lint/tests clean after fixes (§1 above is the post-fix
run).

## 4. Manual browser verification (Playwright MCP, real Chrome, `localhost:3000/dev/tone`)

All five states, both fixtures, both themes, both breakpoints. Screenshots in
`screenshots/`:

- `tone-01-strong-desktop-light.png` — strong call, 1280px, light. All in-range/on-target
  chips, benchmark captions, coach/client breakdown.
- `tone-02-strong-expanded.png` — all 9 metric panels expanded ("Show 5 more" clicked),
  one "Show method" open showing `method` text + a clicked `ToneMoments` timestamp
  revealing the honest jump-stub line, timeline segment clicked showing the matched
  utterance.
- `tone-03-weak-desktop-light.png` — weak call, light: D12 quality-warning banner
  (amber), low-confidence role-assignment banner, multiple outside-benchmark chips.
- `tone-04-empty.png` / `tone-05-running.png` / `tone-06-failed.png` — the three
  non-report states via the dev harness's state switcher.
- `tone-07-strong-375.png` — strong call at 375px: single-column grid, no horizontal
  scroll.
- `tone-08-strong-desktop-dark.png` — strong call, dark (`page.emulateMedia({
  colorScheme: 'dark' })`): cards flip to the dark palette, chips stay legible.
- `tone-09-weak-375-dark.png` — weak call, 375px + dark together.
- `tone-10-weak-desktop-dark-fixed.png` / `tone-11-weak-desktop-dark-fixed.png` — the
  role-assignment banner after the `.tone-fill` → `.tone-card` dark-mode contrast fix
  (see NOTES), confirmed legible.
- `tone-12-weak-fixed-swap-unavailable.png` — post-review-fixes weak call: "Swap Coach
  and Client labels" button now present in the low-confidence banner.
- `tone-13-weak-unavailable-metric.png` — Speaking rate metric showing `—` +
  `unavailableReason` text, no benchmark chip, no per-speaker rows (the fix for finding
  #4 — previously untested `value === null` path).
- `tone-14-weak-swapped.png` — after clicking the swap button: every metric panel's
  Coach/Client labels and the turn-timeline's `aria-label`s flip together, confirmed via
  `document.querySelectorAll('[aria-label*="turn,"]')` returning the swapped labels.

Horizontal overflow check at 375px (`document.documentElement.scrollWidth` vs
`window.innerWidth`):

```
strong call: { scrollWidth: 360, innerWidth: 375 }
weak call:   { scrollWidth: 360, innerWidth: 375 }
```

## 5. Accessibility spot-check

Every disclosure/toggle/interactive control is a real `<button>`:

- Metric panel "Show method" — `aria-expanded` (added after review).
- Metric grid "Show N more"/"Show fewer" — `aria-expanded` (added after review).
- `ToneMoments` timestamp buttons — `aria-expanded`, `aria-label="Jump to {time}"`.
- `ToneTimeline` segments — `role`-implicit `<button>`, `aria-label="{Coach|Client} turn,
  {start} to {end}"`, `aria-expanded` on the selected one.
- Role-assignment swap button — `aria-pressed`.

Confirmed via accessibility-tree snapshots (Playwright `browser_snapshot`), not just
visually — e.g. the turn-timeline buttons read as `"Coach turn, 0:26 to 1:01"` etc. in the
a11y tree, not just styled `<div>`s.

# Verify — Frontend

## 1. Tests and typecheck

`npm test` — 27/27 passing:

```
ℹ tests 27
ℹ suites 4
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

`npx tsc --noEmit` — the only error is the pre-existing, out-of-scope
`scripts/compile-rubrics.ts:336` narrowing bug (see NOTES). Everything under `src/` that I
own has zero errors. `npx eslint src` — 0 problems in every file I own (the one remaining
project-wide lint error is `src/scoring/engine.ts:202`, a contract file I do not touch).

## 2. All four fixtures rendered

Screenshots in `screenshots/`:

- `01-list.png` / `07-list-375.png` — evaluations list, filter pills, sample marker, cost
  column, running/failed rows read as those states in-table.
- `02-run-form.png` / `09-run-375.png` — paste form, call-type toggle, sample loader, char
  counter.
- `03-report-done1-not-evidenced.png` / `08-report-375.png` — Renata Cruz (kickoff, FAIL,
  3 `not_evidenced` dimensions visible as D04/D06/D08).
- `04-report-done2-capped.png` — Hannah Vogel (coaching, INCONSISTENT, D03 capped).
- `10-capped-expanded.png` — D03 expanded: raw 15 → capped 10, condition, reasoning,
  evidence, quick fix all visible.
- `11-not-evidenced-expanded.png` — D04 expanded: reads as a deliberate refusal
  ("Not scored — deliberately… held at its floor rather than guessed"), no empty
  EVIDENCE block rendered.
- `05-report-running.png` — Owen Brandt: "Scoring this call…", explicit "you can close
  this tab" copy, no bare spinner-with-no-words.
- `06-report-failed.png` — Malik Osei: `error.message` prominent, `error.detail` behind a
  working disclosure, next action, "Run another evaluation" CTA.

## 3. PDF

Generated via `GET /api/pdf/[id]` against the real route (system Chrome locally, since
`@sparticuz/chromium` only resolves on Vercel):

```
curl .../api/pdf/...002 → 200, application/pdf, 326151 bytes, 8 pages (A4)
curl .../api/pdf/...001 → 200, application/pdf, 293564 bytes, 6 pages (A4)
curl .../api/pdf/...003 (running) → 409 {"message":"This run has no finished report yet."}
curl .../api/pdf/...004 (failed)  → 409 {"message":"This run has no finished report yet."}
```

`pdffonts screenshots/report-2.pdf` shows every embedded font as `Geist-Regular` /
`Geist-Medium` / `Geist-SemiBold`, `emb: yes` — confirmed the base64 embed actually took
and did **not** silently fall back to Open Sans (which is exactly the failure mode the
brief calls out as invisible locally otherwise — I checked by inspecting the PDF's own
font table with `pdffonts`, not just by eye).

Rendered pages saved as PNG for visual proof: `pdf-report-hannah-page1.png` (hero, gauge,
red flag, band chip, caps box) and `pdf-report-renata-page3-not-evidenced.png` (D04
not-evidenced rendering inside the PDF, same as on-screen). `break-inside: avoid` on each
dimension confirmed — no row splits across a page boundary in either PDF.

`report-1.pdf` / `report-2.pdf` kept in `screenshots/` as the actual generated files.

## 4. 375px width — no horizontal body scroll

Scripted check (`document.documentElement.scrollWidth` vs `window.innerWidth` at a 375px
viewport) on `/`, `/runs/[id]`, `/run`:

```
/            { scrollWidth: 375, viewport: 375 }
/runs/[id]   { scrollWidth: 375, viewport: 375 }
/run         { scrollWidth: 375, viewport: 375 }
```

Found and fixed a real bug first: the evaluations table (`min-w-[720px]`, meant to scroll
inside its own `.scroll-x` container) was pushing the whole page to 832px wide, because
root `body` was `flex flex-col` and flex children ignore a descendant's `overflow-x:auto`
containment without `min-width: 0`. Removed the unnecessary flex layout from
`src/app/layout.tsx`; re-checked clean afterward.

## 5. Keyboard access

Scripted: focused a dimension row's button and the scoring-trace toggle, pressed
Enter/Space (no mouse), read `aria-expanded` before/after:

```
D3 keyboard toggle: { expandedBefore: 'false', expandedAfter: 'true' }
trace toggle: true
```

Both are real `<button aria-expanded aria-controls>` elements, so this holds for every
dimension row and the trace panel, not just the one tested.

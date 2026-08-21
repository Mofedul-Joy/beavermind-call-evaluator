# Notes — Frontend

- **Contradiction found, not fixed:** `scripts/compile-rubrics.ts:336` has a real TS
  narrowing bug (`'dimension' in c.effect` doesn't narrow inside the nested `.find`
  closure). Blocks `next build`'s typecheck and root `tsc`/`eslint` runs. Not touched —
  `scripts/**` is off-limits to me. All files I own are clean in isolation (see VERIFY.md).
- `npm install` for `puppeteer-core`/`@sparticuz/chromium` converted my `node_modules`
  symlink into a real directory (npm always does this). `wt-backend` had already done the
  same independently, so this is unavoidable, not a regression I introduced.
- Cap→dimension linking: `DimensionResult` has no cap id, so `ReportView` matches
  `trace.capsApplied[].change` by its `D{n} ` prefix to show the cap inline on its row.
  Works for the fixtures; if a future `change` string doesn't start with `D{n}`, the row
  just won't show the inline cap box (trace section still has it).
- PDF fonts: embedded real Geist `.woff2` (copied from `next/dist/next-devtools/.../font/`)
  as base64 in `/print`'s own `<style>`, bypassing next/font's network path entirely, per
  the doc's warning. Single static weight — browser synthesizes bold.
- PDF browser: `@sparticuz/chromium` only resolves on Vercel; local/dev falls back to a
  system Chrome path. Verified locally against real system Chrome.
- Fixed a real bug: root `body` was `flex flex-col`, which let the evaluations table's
  `min-w-[720px]` push the whole page past 375px (flex children ignore descendant
  `overflow-x:auto` clipping without `min-width:0`). Removed the unneeded flex layout.
- `NEXT_PUBLIC_USE_FIXTURES=1` added to `.env.local` — backend isn't merged into this
  worktree yet. `createRun`/`fetchRun` (`src/lib/run-client.ts`) already call the real
  `/api/runs` endpoints and need no changes once merged.
- Download PDF button only renders once `status === 'done'`, not on every state.

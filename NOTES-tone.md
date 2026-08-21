# Notes — TONE tab

- **No `TabShell` in this worktree.** `wt-capture` owns `TabShell.tsx` on its own branch
  and hadn't built it yet as of this work. `ToneTab` takes the narrowest prop that makes
  sense against the committed contract — `{ job: DeliveryJob | null }` from
  `src/delivery/types.ts` — so it should drop into whatever `TabShell` ends up passing
  with at most a rename. Built and tested against my own dev route, `src/app/dev/tone`,
  not wired into any real page.
- **Metric set is the full `DeliveryMetricKey` union (9 keys)**, not the six named loosely
  in the goal doc's vocabulary ("F0 SD, energy variance, WPM, pauses, talk ratio, turn
  boundaries") — `pitch_variance` is F0 SD, "pauses" is `pause_after_question` +
  `long_pause_count`, and the contract also has `longest_monologue`, `question_rate`, and
  `interruptions`. Rendered all 9; the contract is the source of truth per the brief
  ("do not invent fields"), and none of the extra three are hard to justify.
- **`ToneMetricPanel`+`ToneMetricGrid` and `ToneMoments`+`ToneTimeline` were built by two
  parallel sub-agents** working from a shared type contract and shared `tone-tab.css`
  tokens, neither seeing the other's code. I wired them together in `ToneTab.tsx` and
  inside `ToneMetricPanel` (the `ToneMoments` slot for `metric.evidence`). An adversarial
  review caught two real seam defects from this split — both fixed, see below.
- **Fixed after adversarial review** (all verified in a real browser afterward, not just
  by reading the diff):
  1. `ToneMetricPanel`'s "Show method" toggle and `ToneMetricGrid`'s "Show N more" toggle
     were missing `aria-expanded` — the `ToneMoments`/`ToneTimeline` pair had it
     consistently, this pair didn't. Added to both.
  2. `formatMetricValue` special-cased `"semitone"`/`"db"` in the unit string to keep one
     decimal place; `pitch_variance`'s actual unit is `"st SD"`, which matched neither
     substring, so `1.1` rendered as `1` and `3.6`/`3.1` as `4`/`3` — silently erasing the
     one metric in the set whose entire signal is a small decimal spread. Changed the
     check to match `"sd"` (any standard-deviation unit), not specific unit spellings.
  3. **Real latent bug, not just theoretical:** `ToneMetricPanel`'s "Speaker A"/"Speaker
     B" fallback (when `coachSpeakerId` is `null`) used `perSpeaker`'s object key order;
     `ToneTimeline`'s used first-appearance order in `turns`. Nothing guarantees those
     agree — a report where the client speaks first but the worker serializes
     `perSpeaker` coach-cluster-first would label the same physical speaker "Speaker A"
     on one half of the tab and "Speaker B" on the other. Neither fixture exercised this
     (both have `coachSpeakerId` set). Fixed by computing turn-appearance order once in
     `ToneTab` and threading it down as `speakerOrder`, so both halves now agree by
     construction instead of by coincidence.
  4. The `value === null` / `unavailableReason` path — one of the two hardest rules in
     this contract (never render a fabricated number) — had **zero** fixture coverage.
     Changed the weak-call fixture's `wpm` metric to `value: null` with a real
     `unavailableReason` (ASR confidence too low below 48 kbps to report a rate), which
     doubles as a coherent detail in the low-bitrate story rather than an arbitrary
     insert. Also found the pairing bug this exposed: `ToneMetricPanel` was rendering the
     benchmark chip + `benchmark.source` caption even when there was no value to compare
     — "No benchmark" next to a real range like "120–160 wpm" reads as a contradiction.
     Fixed by only rendering the benchmark block when `metric.value !== null`.
  5. `src/delivery/types.ts`'s `RoleAssignment` comment states as a hard requirement:
     "When `confident` is false the UI must offer to swap the labels rather than
     presenting the guess as a fact." The original build only showed static warning text.
     Added a real swap: a button in the low-confidence banner flips which diarized
     cluster displays as "Coach" (client-side only, no backend — there's nothing to
     persist to yet), propagated through the same `coachSpeakerId` prop both halves
     already took, so every metric card and the timeline strip swap together correctly.
- **Dark mode found one real bug of my own before the adversarial pass**, not from the
  review: the low-confidence role-assignment banner used `.tone-fill` (a translucent tint
  meant to sit on a dark `.tone-card` ancestor) directly on the page body background.
  `src/app/globals.css` is untouched and light-only by design (off-limits file, and the
  surrounding site shell doesn't support dark mode at all yet) — so in dark mode the
  banner's text picked up the dark-mode CSS vars while its background never actually went
  dark, producing near-white-on-near-white. Fixed by switching it to the opaque
  `.tone-card` background, which the reviewer independently confirmed correct rather than
  re-flagging.
- **This tab carries its own light/dark tokens** (`tone-tab.css`, scoped under
  `.tone-tab`), separate from `src/app/globals.css`, which has no dark palette at all.
  The rest of the app (header, page background) stays light-only regardless of OS theme —
  only this tab's own subtree respects `prefers-color-scheme`. That's a scope boundary,
  not an oversight: `globals.css` is explicitly off-limits.
- **No custom icon/waveform assets generated.** The few icons needed (the empty-state
  waveform glyph, the warning triangle) are small enough to hand-author as inline SVG in
  the existing 16px/1.4px-stroke house style; running Higgsfield for two glyphs would have
  been more process than the assets warranted.
- **Turn timeline is plain absolutely-positioned `<div>`s by percentage**, not SVG or a
  charting library — turns can have gaps (silence) between them, so segments are
  positioned by `start`/`end` directly rather than laid out sequentially, which keeps
  silence visually honest instead of compressing it away.
- **Clickable timestamps are real, honest stubs.** No recording player exists anywhere in
  this codebase yet. Every "jump to this moment" control (`ToneMoments`, `ToneTimeline`)
  is a real, keyboard-reachable `<button aria-expanded>` that reveals a visible inline
  line — "Jumps to 5:04 once playback is wired up — no recording player exists yet." —
  never a silent no-op, native tooltip, or `alert()`.
- **Parked / out of scope, not forgotten:**
  - No integration with `TabShell` or the live report page — explicitly deferred per the
    brief to a later integration pass, once `wt-capture` merges `TabShell.tsx`.
  - The role-swap control is view-only (component state), since there's no run record or
    API to persist a corrected role assignment to yet. Whoever wires this into the live
    report should decide whether a correction should actually be written back.

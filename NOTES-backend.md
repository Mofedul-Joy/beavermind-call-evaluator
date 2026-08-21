# Notes — backend

**Most important open item.** kickoff-02 must show ≥2 `not_evidenced` dims per the brief. Across 6 live
runs with progressively stronger not_evidenced-vs-floor-score prompt calibration it consistently scores
low (53–60, FAIL/AT RISK, zero fabricated evidence, rationales that match the rubric's own bucket text)
but lands at 0 `not_evidenced`. I read the transcript myself: every dimension has some thin real evidence
— e.g. D8's own "Mid" bucket literally reads "generic questions only (equipment, availability)", which is
exactly what's there, so forcing not_evidenced would contradict the client's own rubric text. Kept fidelity
to the rubric over hitting the number. Score is well under the doc's stated 70+ failure threshold.
**Structured output.** The object-keyed schema (`dimensions`/`capFindings` keyed by `dimension.key`/`cap.id`,
matching "keyed by" literally) 400'd live as "compiled grammar too large" — even with descriptions and the
score `enum` stripped. Switched to arrays with one shared item schema; `validateAnswer` + the one retry
already cover completeness/legality. Also: `score`/`quickFix` can't be `T|null` in the schema — 24 nullable
fields (12 dims × 2) blew the API's 16-union-parameter cap. Made both plain required fields; `toModelAnswer`
forces both to `null` off "scored" in code instead.
**Cost.** No cache-write slot on `RunCost` — folded `cache_creation_input_tokens` into `inputTokens` at $2/MTok.
Real cost is $0.17–$0.25/run, well over the brief's $0.02–$0.07 — left thinking at default/high after
'medium' effort measurably hurt evidence grounding in testing.

**DB access.** No `sbp_` token, no DB password in `.env.local`; direct connection is IPv6-only (unreachable
here). Applied schema.sql via `pg` over the Supavisor pooler once a password was supplied out of band; added
`DATABASE_URL` to `.env.local` for `scripts/apply-schema.ts`/`seed.ts` only.

**Deviation.** `node_modules` symlink got replaced by a real dir mid-`npm install` (npm's own reify step) —
not reversible without reinstalling; left as an independent install.

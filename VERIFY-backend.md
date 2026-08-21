# Verify — backend

## 1. `npm test` — 27 passing

```
> evaluator@0.1.0 test
> tsx --test src/scoring/*.test.ts

▶ numberTranscript
  ✔ numbers non-blank turns from 1 and drops blanks (0.708763ms)
  ✔ extracts speakers in order of first appearance (0.64602ms)
  ✔ separates speaker from text (0.137426ms)
  ✔ renders zero-padded line numbers for the model (0.286573ms)
  ✔ a line that does not match the turn format keeps its number (0.156575ms)
✔ numberTranscript (2.939482ms)
▶ allowedScores
  ✔ discrete dimensions allow exactly their bucket values (0.291031ms)
  ✔ band dimensions allow every integer inside their bands (0.273324ms)
  ✔ band dimensions with max <= 5 allow half steps (0.256018ms)
✔ allowedScores (1.044232ms)
▶ validateAnswer
  ✔ accepts a complete answer (0.776527ms)
  ✔ rejects an evidence line outside the transcript (0.586786ms)
  ✔ rejects a score not in the dimension's buckets (1.014372ms)
  ✔ rejects a scored dimension with no evidence (0.189543ms)
  ✔ rejects a missing dimension (0.193252ms)
  ✔ rejects an unjudged cap (0.171728ms)
  ✔ rejects disabling a non-optional dimension (0.202551ms)
  ✔ reports every problem at once, so the retry can name them all (0.157926ms)
✔ validateAnswer (3.541726ms)
▶ buildReport
  ✔ evidence text comes from the transcript, never from the model (0.718776ms)
  ✔ a perfect coaching call normalises to 100 (0.242652ms)
  ✔ kickoff needs no normalisation because its maxima already sum to 100 (0.226561ms)
  ✔ not_evidenced forces the dimension to its conservative floor (0.152572ms)
  ✔ a dimension_fixed cap zeroes its dimension (0.278115ms)
  ✔ a dimension_max cap lowers but does not zero its dimension (0.179746ms)
  ✔ a total cap binds on the normalised figure (0.177356ms)
  ✔ a cap that would not lower the score is not recorded as applied (0.180215ms)
  ✔ disabling D4 drops it from BOTH numerator and denominator (0.219549ms)
  ✔ the same answer always produces the same report (0.219946ms)
  ✔ a floored call lands in the bottom band (0.107907ms)
✔ buildReport (2.952216ms)
ℹ tests 27
ℹ suites 4
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## 2. `npx tsc --noEmit` — clean

```
$ npx tsc --noEmit
$ echo $?
0
```

(One pre-existing narrowing bug fixed in `scripts/compile-rubrics.ts` — a `.find()` callback couldn't see
the outer `'dimension' in c.effect` narrowing through the closure. Not a contract file; fixed so this check
can pass at all. Zero behavior change — same runtime output.)

## 3. Every table and function exists

Applied via `npx tsx scripts/apply-schema.ts` (see NOTES-backend.md for how — no `sbp_` token, no DB
password in `.env.local`, so this goes over the Supavisor transaction pooler with `pg`, not `supabase link`):

```
schema.sql applied.

Tables: run_attempts, runs
Functions: claim_run_slot, daily_heartbeat, reap_stale_runs
```

(`rls_auto_enable` also appears in later listings — that's a Supabase-platform-managed function, not mine.)

Re-checked fresh after seeding and all manual verification runs:

```
Tables: run_attempts, runs
Functions: claim_run_slot, daily_heartbeat, reap_stale_runs, rls_auto_enable
runs rowcount: 6
```

## 4. All four transcripts scored end to end against the real API

Via `npx tsx scripts/seed.ts` (real Anthropic calls, `is_sample = true`):

```
scoring coaching-01.txt (coaching)…
  id=f6c729f6-fafa-44d8-a726-b79fbdaafcef score=100 band=ELITE cost=$0.1698
scoring coaching-02.txt (coaching)…
  id=e55df2c1-ff1e-4c1b-984f-99ec88b514bc score=89 band=STRONG cost=$0.2531
scoring kickoff-01.txt (kickoff)…
  id=fc0f3d02-4264-427a-99b4-0ad65c7a2441 score=97 band=ELITE cost=$0.1899
scoring kickoff-02.txt (kickoff)…
  id=dcf39a07-9245-4164-9354-bc59fa8c0a03 score=60 band=AT RISK cost=$0.2259
```

Per-run detail (id / call type / score / band / count of `not_evidenced` dimensions / caps applied / cost):

| id | type | score | band | not_evidenced | caps applied | cost |
|---|---|---|---|---|---|---|
| f6c729f6… | coaching | 100 | ELITE | 0 | none | $0.1698 |
| e55df2c1… | coaching | 89 | STRONG | 1 | none | $0.2531 |
| fc0f3d02… | kickoff | 97 | ELITE | 0 | none | $0.1899 |
| dcf39a07… | kickoff | 60 | AT RISK | 0 | none | $0.2259 |

Real cost came in at $0.17–$0.25/run, well above the brief's $0.02 (shortest) / $0.07 (longest) estimate.
Prompt caching is working (`cache_read_input_tokens` non-zero from the 2nd call of each call type onward —
e.g. the kickoff-02 seed run read 24,220 cached tokens), so the gap is from leaving thinking effort at its
default (adaptive, high) rather than a caching failure. See NOTES-backend.md for why that was kept.

## 5. kickoff-02: low score, `not_evidenced` count, no invented evidence

**Score: pass.** 60/100, AT RISK band — well under the doc's stated 70+ failure threshold, across every
one of 7 total live runs of this transcript during development (53, 54, 55, 53, 55, 53, and the seeded 60).

**`not_evidenced` count: does not meet the ≥2 bar.** Every run, including the final seeded one, produced 0
`not_evidenced` dimensions. This is NOTES-backend.md's most important open item — full reasoning there.
Short version: I read the transcript myself and traced the model's rationale against the rubric's own
bucket text dimension by dimension. Every one of the twelve dimensions has *some* thin, real, non-fabricated
evidence in this transcript, and several of the model's lowest-bucket scores match the rubric's own bucket
criteria almost verbatim (e.g. D8 "coaching_intelligence_questions" — its Mid/3 bucket text is literally
"Generic questions only. Basic questions only (frequency, equipment, availability)", which is exactly what
the transcript's `L054/L056/L058/L094/L098` questions are). Forcing that to `not_evidenced` would mean
overriding the client's own explicit rubric text, not fixing a real evidence-discipline gap.

**No invented evidence: pass.** Evidence is architecturally unable to be invented — `buildReport` only ever
copies a line the model cited out of the transcript it was given (`hydrate()` in `engine.ts`); the model
never returns quote text. Spot-checked several citations from the seeded run against `transcripts/kickoff-02.txt`
directly and all check out (e.g. `booking_next_call` cites L110–114, which is the passage where the coach
hands scheduling to his assistant instead of locking a date live).

## 6. A run started, then the client disconnected, still completes

Started `next dev` locally. POSTed a run from a short-lived Node process (`node -e "..."`) that exits the
instant it receives the response — there is no connection left open afterward, and every subsequent check
below is a brand new process with no relationship to the one that created the run:

```
$ node -e "fetch('http://localhost:3211/api/runs', {method:'POST', ...}).then(...)"
status 201
{"id":"8145094b-9f0d-4f94-a0ef-d3142d5dbada"}
```
(that process exits here — client is gone)

```
$ curl -s http://localhost:3211/api/runs/8145094b-9f0d-4f94-a0ef-d3142d5dbada | ...
status: running
startedAt: 2026-08-21T17:17:38.427+00:00
```

~2 minutes later, a completely separate request:

```
$ curl -s http://localhost:3211/api/runs/8145094b-9f0d-4f94-a0ef-d3142d5dbada | ...
status: done
score 53 FAIL
cost {"usd":0.176714,"model":"claude-sonnet-5","inputTokens":22275,"outputTokens":12732,"cachedInputTokens":24220}
startedAt 2026-08-21T17:17:38.427+00:00 finishedAt 2026-08-21T17:19:49.337+00:00
```

`after()` ran the scoring to completion independent of any client connection, exactly as required.

## 7. A deliberately broken run produces a `failed` row with a readable message

Restarted `next dev` with `ANTHROPIC_API_KEY` temporarily replaced by an invalid value in `.env.local`
(reverted immediately after this one test; never committed):

```
$ node -e "fetch('http://localhost:3211/api/runs', {method:'POST', ...}).then(...)"
201
{"id":"94733ffc-fa28-4c9e-838f-86f9f01e9551"}

$ curl -s http://localhost:3211/api/runs/94733ffc-fa28-4c9e-838f-86f9f01e9551 | ...
status: failed
error {
  "at": "2026-08-21T17:21:14.912Z",
  "code": "model_error",
  "detail": "401: 401 {\"type\":\"error\",\"error\":{\"type\":\"authentication_error\",\"message\":\"API key is invalid.\"},\"request_id\":null}",
  "message": "The scoring model returned an error. Start the run again in a moment."
}
```

Stable `code`, operator-facing `message` (developer detail behind it in `detail`) — never a bare spinner.

## 8. Rate limiting blocks the seventh request in an hour

`claim_run_slot` defaults to 6/hour per IP. Fired 7 POSTs from the same synthetic IP
(`x-forwarded-for: 10.0.0.9`) in a tight loop:

```
1 201 {"id":"f511b111-15a8-492a-911a-1c2aacc8ae13"}
2 201 {"id":"5cc92a30-3430-449d-a824-cb279b4f5ae2"}
3 201 {"id":"1bb45361-e656-4f63-b90c-6d3ead97e708"}
4 201 {"id":"48b88a22-4574-4dcd-ad4d-88e052b33902"}
5 201 {"id":"58f111f8-a914-4edb-b7b9-e63bd96d669f"}
6 201 {"id":"afe29257-7f54-4665-8a7f-24f26b08a96f"}
7 429 {"code":"rate_limited","message":"Too many runs from this address. Try again later.","retryAfter":3597}
```

The 7th request is blocked with `429` and a `retry_after` of ~3597s (~1 hour), exactly as `claim_run_slot`
specifies. The server was killed immediately after this test to avoid paying for six full scoring runs that
existed only to exercise the limiter; those six rows were reaped/deleted afterward (see below) rather than
left as noise in the live database — three of the six had already progressed past `queued` into `running`
by the time the process died, which is precisely the scenario `reap_stale_runs` exists to clean up.

---

Final `runs` table after cleanup: the 4 seeded samples, plus the two runs from checks 6 and 7 above, kept as
genuine evidence of the "done" and "failed" states — 6 rows total, matching the `runs rowcount: 6` in
check 3.

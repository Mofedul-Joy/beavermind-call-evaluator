# Call evaluator

Paste a coaching or kick-off call transcript, pick the call type, and get a permanent,
shareable report scoring it against that rubric's twelve dimensions — with the evidence
for every score, the arithmetic that produced the total, and a PDF.

Built for the BeaverMind stage-two exercise.

## The three constraints, and where each one lives

The brief is explicit about three things. They shaped the architecture more than anything
else in it.

**Every run has its own URL that still works next week.** A run is a row keyed by a uuid,
and that uuid *is* the URL. The report is stored whole as `jsonb` with the compiled
rubric's hash pinned alongside it, so a report stays readable after the client edits their
rubric. A free Supabase project pauses after about seven days without database activity and
resuming is a manual dashboard click, so `vercel.json` runs a daily heartbeat. That cron is
not housekeeping — without it the requirement fails on day eight.

**The operator can close the tab.** `POST /api/runs` inserts the row and returns the id
immediately; scoring happens in `after()` with `maxDuration = 300`. `after()` has no
retries, so a killed function would leave a row stuck in `running` forever — `started_at`
is set before work begins and `reap_stale_runs()` fails anything older than the function
could possibly live.

**A failed run says why.** Every failure path writes a `RunError` with a stable code and a
message written for an operator rather than a developer. There is no spinner that spins
forever.

## The one decision everything else follows from

**The model does judgement. The engine does arithmetic. Neither does the other's job.**

The model returns a bucket per dimension and a true/false finding per cap condition. It
never returns a total, a band, or a capped score. `buildReport` applies the caps, picks the
denominator, normalises and bands — deterministically, and identically every time.

**Evidence is line numbers, never quoted text.** The transcript is numbered before it is
sent; the model cites `[142, 148]`; the engine copies the verbatim line out of the
transcript it was given. The model's own words never reach the report. This does not
*detect* a fabricated quote — it makes one unrepresentable.

That principle is load-bearing, and it is why the sharpest bug in this build was caught by
the same trick applied one level up. See below.

## What I would have asked the client

**The coaching rubric does not add up.** Its twelve printed maxima sum to **105** while its
prose says 100, and its stated disabled-D4 total of 85 does not match 105 − 15 = 90 either.
I did not silently pick one. The compiler records the contradiction in
`rubric.discrepancies`, and the engine normalises against the sum of the *active*
dimensions' maxima — which is the method that rubric itself prescribes for its own D4 case,
generalised so it always holds. `npm run compile:rubrics` fails the build if the numbers
drift again.

**`kickoff-02` scores 51/FAIL with zero `not_evidenced` dimensions**, where my own build
spec demanded at least two. I read the transcript against the rubric line by line rather
than force it: D8's own middle bucket reads *"generic questions only (equipment,
availability)"*, which is precisely what Ivan asks. Scoring it there is faithful to the
client's text; forcing `not_evidenced` would mean overriding their rubric to satisfy a
number I invented before reading the call. Fidelity to the rubric won. `DECISIONS.md` has
the full reasoning.

## The bug worth reading about

The contract required a non-empty `quickFix` on every scored dimension, and `quickFix`
renders as *"To reach {max}: …"*. On a dimension scored at its **maximum**, that is a
demand to name an improvement to a score just called perfect.

The model complied, as instructed. `coaching-01` came back with **twelve of twelve
dimensions at maximum**, a real and specific improvement written under every one, and one
of those same improvements nominated as the single most important change in the whole call.

Prompting against it made things worse — the score moved, output went to 21k tokens and the
run cost $0.31. The fix was structural: `quickFix` is now required *below* the maximum and
forbidden *at* it, and where an answer still puts one under a maximum the engine lowers the
dimension one bucket on its own scale and records it in `trace.ceilingAdjustments`. Same
shape as the existing floor override for `not_evidenced`. The invariant is enforced, not
requested.

| | before | after |
|---|---|---|
| coaching-01 | 100 ELITE · 12/12 at max | 98 ELITE · 11/12 |
| kickoff-01 | 97 ELITE · 11/12 at max | 97 ELITE · 10/12 |
| kickoff-02 | 60 AT RISK | **51 FAIL** |

`scripts/calibrate.ts` is the harness that found it, and reproduces the comparison in one
command.

## Running it

```sh
cp .env.example .env.local     # fill it in
npm install
npx tsx scripts/apply-schema.ts   # creates the tables and functions
npm run compile:rubrics           # markdown rubrics → checked JSON
npx tsx scripts/seed.ts           # scores the four samples for real
npm run dev
```

```sh
npm test              # 31 scoring tests — no network, no model
npm run test:delivery # 30 delivery tests — no models, no Modal
npx tsx scripts/calibrate.ts   # re-score the samples and print the calibration numbers
```

## Layout

| | |
|---|---|
| `rubrics/` | the client's two markdown rubrics, verbatim |
| `scripts/compile-rubrics.ts` | parses them into checked JSON and fails the build on drift |
| `src/scoring/types.ts` | the contract — every shape, and the two rules it enforces |
| `src/scoring/engine.ts` | numbering, validation, caps, denominator, banding |
| `src/lib/` | prompt assembly, structured-output schema, the model call |
| `src/server/`, `src/app/api/` | run lifecycle |
| `src/components/`, `src/app/` | the report, the list, the paste form, the print layout |
| `supabase/schema.sql` | tables, RLS, rate limiting, the reaper, the heartbeat |
| `delivery/` | the vocal-delivery worker — Python on Modal, its own README |

## Beyond the brief: the TONE tab

The rubric only sees words, and for a coach *how* they said it is half the job. Upload a
recording and a second tab reports talk/listen ratio, longest unbroken stretch, speaking
pace, silence left after a question, interruptions, loudness variation and pitch variation
— each with a unit, a cited benchmark, and clickable timestamps.

It is measurement, not vibes, and it says so:

- **Claude has no audio input.** Not via the API, not in any configuration.
- **Audio-native models are below chance at paralinguistics** — GPT-4o-Audio scores 21.44%
  on MMSU against 26.10% for random guessing. Humans score 92.88%.
- **Vision models confabulate on body language** — GPT-4V 14.64 against 18.33 for random,
  with a *negative* correlation between how plausible its reasoning sounds and whether it
  is right.

So signal processing does the measuring and the model does the writing. Claude receives
numbers and a transcript, never the audio. There is no emotion label, no sentiment, no
"confidence score" — and no field in the contract to put one in, which is enforced by a
test rather than by a prompt. EU AI Act Art. 5(1)(f) prohibits inferring emotions in a
workplace context; Recital 18 excludes *"mere detection of readily apparent expressions,
gestures or movements"*. Reporting that someone spoke for six minutes without pausing is on
one side of that line. Reporting that they sounded anxious is on the other, and would also
be a coin flip.

A run with no recording renders exactly the briefed report, with no tab bar. See
`delivery/README.md` for the stack, the licence audit, and what was measured and dropped.

## What was deliberately left out

- **Filler-word rate.** Whisper's recall on filled pauses is **2.5%** — four of 157 gold
  tokens. No setting fixes it, and it would be unactionable anyway: a 2025 study rated a
  *disfluent* agent more competent than a fluent one.
- **Body language from video frames**, as an LLM judgement. See the numbers above.
- **A composite delivery score.** The rubric is the client's document with defined bands.
  Vocal delivery is a set of instruments. Averaging them into one number would imply a
  precision that is not there.

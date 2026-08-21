# VERIFY — delivery worker

Real output. Every figure below was produced by running the thing, not by reading the code.

## Unit tests

```
$ npm run test:delivery
...
Ran 30 tests in 0.040s

OK
```

No models, no network, no Modal. The two that matter most:

- `test_pitch_variation_is_identical_for_voices_an_octave_apart` — two synthetic speakers
  with the same relative pitch movement, one an octave below the other, must produce the
  same semitone SD. If it ever fails, the metric has started measuring the speaker's sex
  instead of their delivery.
- `test_no_metric_is_an_emotion_label` — walks the assembled report and fails on any key,
  label or unit containing an inferred inner state.

## End to end, twice, on real audio

350 seconds of the exercise briefing video, run at two source qualities. Same pipeline,
same code, different input.

### Lossless (FLAC, 240 kbps, 16 kHz)

```
  350.0s · 37 turns · coach = speaker 0 (asked the most questions (3 vs 1))
  102.0s wall · 0.292x realtime · $0.0072

  talk_ratio                   59.0  % of speaking time
  longest_monologue            76.9  seconds
  wpm                         178.6  words per minute
  question_rate                 3.0  count
  pause_after_question            —  seconds (median)   (no questions were followed by the other speaker)
  long_pause_count             16.0  count
  interruptions                 0.0  count
  energy_variance              5.86  LU (standard deviation)
  pitch_variance               2.16  semitones (SD around own median)
```

`pause_after_question` being unavailable is correct behaviour, not a gap. The source is a
briefing monologue: all three questions are rhetorical and the same speaker carries on. The
worker reports that in the metric's `method` — *"3 of 3 questions were followed by the coach
speaking again rather than the client"* — instead of computing a median over three
near-zero gaps and presenting it as how long this person waits for an answer.

`interruptions: 0` is also correct: there is no conversation in this recording.

### Lossy (Opus, 23 kbps, 16 kHz) — the same 350 seconds

```
  350.0s · 33 turns · coach = speaker 1 (asked the most questions (1 vs 0))

  talk_ratio                   35.5  % of speaking time
  longest_monologue            24.0  seconds
  question_rate                 1.0  count
  interruptions                 2.0  count

  note: This recording is 23 kbps opus. Below 48 kbps the speaker separation fragments,
  which shortens monologues and invents interruptions. Treat the per-speaker numbers as
  indicative and re-upload a higher-quality file if you can.
```

**Every per-speaker number moved, and two of them inverted.** The longest monologue fell
from 77 seconds to 24, the coach and client swapped, and it reported two interruptions on a
recording with no conversation in it. Speaker embeddings degrade well before speech
recognition audibly does — the transcript was fine in both runs.

This was found by accident, from using a small file for the first test. It is now a
measured constant (`LOSSY_BITRATE_FLOOR`) and a warning the operator sees, rather than a
silent quality cliff.

## Deployed HTTP API

`https://leisuretimemovie--beavermind-delivery-api.modal.run`

```
health          -> {"ok":true,"contract":1,"fastapi":"0.115.12","request_param":["request"]}
no token        -> 401
wrong token     -> 401
token, no body  -> {"detail":"send the media as the request body, or pass ?media_url= to a signed URL"} [400]
spawn           -> {"call_id":"fc-01M0J3B0MZQ06SHDRP0DDZ93HX","bytes":10519605}
poll no token   -> 401
poll now        -> {"status":"running","report":null}
```

Then, polling that id from a **new process** after the original client had exited:

```
 15s: running
 30s: running
...
120s: done
```

```
status: done | version: 1 | turns: 37 | utterances: 33
coach: {'coachSpeakerId': '0', 'method': 'asked the most questions (3 vs 1)', 'margin': 0.5, 'confident': True}
compute: {'wallClockSec': 113.4, 'usdEstimate': 0.008, 'realtimeFactor': 0.324, ...}
media.source: {'codec': 'flac', 'bitrate': 240448, 'sampleRate': 16000}
```

A 10.5 MB body uploaded, the client disconnected, the job carried on, and the result was
still there for a different process to collect. Same guarantee the brief asks of the core
build, on the extension path too.

## Cost and speed

**0.29–0.39× realtime** on 4 CPU cores. A 30-minute call is roughly **9–12 minutes of wall
clock and $0.04**, against the $0.028 estimated during research. Nothing here needs a GPU.

## Wire format

`test_the_typescript_mirror_declares_every_key_we_emit` walks a real report and fails on
any field `src/delivery/types.ts` does not declare;
`test_the_typescript_mirror_lists_every_metric_key` does the same for the metric keys. The
worker emits camelCase, checked by `test_every_key_is_camel_case`, so the app needs no
mapping layer.

## Four defects found and fixed during verification

1. **`energy_variance` was silently unmeasurable.** Modern ffmpeg's `ebur128` no longer
   prints its per-frame lines to stderr, so the regex matched nothing on every run and the
   metric reported "not enough voiced audio". Now routed through
   `ametadata=mode=print:file=-`, which writes to stdout and does not depend on a log
   level. Verified at 10 Hz — 200 frames over 20 seconds.
2. **Words appeared under two speakers at once.** Diarized turns overlap, and on a
   recording with one dominant voice the segmenter emits short phantom fragments of the
   other speaker on top of the real one. The transcript printed *"in In some some case.
   cases"* as a second speaker's line. Each word is now claimed by exactly one turn:
   1008 words across the utterances, 1008 across the per-speaker counts.
3. **The web endpoints took the request as a query parameter.** `from __future__ import
   annotations` turns `request: Request` into the string `"Request"`, which FastAPI
   resolves against module globals in the container. Every POST returned
   `422 missing query param 'request'`. Both the import location and the future import
   were the cause; the file now carries a comment saying so.
4. **`modal deploy` did not drain the warm web container.** Six consecutive deploys served
   the previous version — a `/health` route added in the newest code returned 404 for two
   minutes of polling. `modal app stop` followed by `modal deploy` fixed it immediately.
   The `/health` route stays, because a deploy you cannot confirm is a deploy you cannot
   trust.

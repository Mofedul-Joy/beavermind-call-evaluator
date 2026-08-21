# Delivery worker — the TONE tab

Measures **how a call was delivered**, as a set of instruments with units and clickable
timestamps. It writes no prose, no labels and no score. The language model that turns
these numbers into coaching notes runs in the Next.js app afterwards and never receives
the audio.

This is an extension. A run with no recording renders exactly the briefed transcript
report and no tab bar appears.

## Why the numbers come first

Three findings from the research phase set the whole shape of this:

- **Claude has no audio input.** Not through the API, not through Claude Code, not on a
  VPS. Text, images and PDFs only.
- **Audio-native models are below chance at paralinguistics.** GPT-4o-Audio scores 21.44%
  on MMSU against 26.10% for random guessing; humans score 92.88%. The LISTEN authors'
  own summary is that models *"transcribe rather than listen."*
- **Vision models confabulate on body language.** GPT-4V scores 14.64 against 18.33 for
  random on micro-expressions, and the correlation between how plausible its reasoning
  sounds and whether it is right is ρ = −0.112.

So the measurement is done by signal processing, which is exact, and the writing is done
by a model, which is good at writing. Claude cannot hallucinate a talk ratio it was
handed.

## What it will not do

`build_report_body` cannot emit an emotion label, a sentiment, a "confidence score" or an
overall grade, because the contract has nowhere to put one. That is enforced by
`test_no_metric_is_an_emotion_label` and `test_there_is_no_composite_score` rather than by
a line in a prompt.

EU AI Act Art. 5(1)(f) has prohibited inferring emotions in a workplace context since
2025-02-02, at €35M or 7% of turnover. Recital 18 explicitly excludes *"mere detection of
readily apparent expressions, gestures or movements"*. Reporting that someone spoke for
six minutes without pausing sits on the legal side of that line; reporting that they
sounded anxious does not, and would also be a coin flip.

## Layout

| File | What it is |
|---|---|
| `contract.py` | The output shape and the benchmark table with its sources. |
| `metrics.py` | Every judgement the report makes. Standard library only. |
| `test_metrics.py` | 30 tests. No models, no network, no Modal. |
| `pipeline.py` | The ML adapters. Media in, four plain arrays out. |
| `modal_app.py` | The Modal app and its two web endpoints. |
| `../src/delivery/types.ts` | The app-side mirror, checked by two of the tests. |

The split is the point. Everything that decides what the report **says** is in `metrics.py`
and runs in 30 milliseconds on a laptop with nothing installed. `pipeline.py` only exists
to produce its four inputs — turns, words, a loudness track and an F0 track — and can only
be verified by running it against real audio, which is why nothing is allowed to depend on
reading it correctly.

```
python3 delivery/test_metrics.py
```

## The stack, and why each piece

```
ffmpeg loudnorm (2-pass)   EBU R128, measure-then-apply so the gain is linear. One-pass
                           loudnorm applies a dynamic gain that flattens exactly the
                           variation the energy metric is measuring.
ffmpeg ebur128             Momentary loudness, 400 ms. The 3-second short-term window
                           straddles turn boundaries on a conversation.
sherpa-onnx                Diarization with num_clusters=2. Apache-2.0, ungated.
onnx-asr + parakeet-tdt    Word timestamps and punctuation. MIT + CC-BY-4.0.
swift-f0                   F0. MIT, ONNX, 96k parameters.
```

Roughly 1.4 GB of image. Measured at **0.29–0.39× realtime** on 4 CPU cores, so a
30-minute call is about **9–12 minutes and $0.04**. No GPU anywhere.

**Input quality is load-bearing.** The same 350 seconds at 23 kbps Opus rather than
lossless changed every per-speaker number and inverted two of them — a 24-second longest
monologue against 77, coach and client swapped, and two interruptions invented on a
recording with no conversation in it. Speaker embeddings degrade long before the
transcript audibly does. The worker warns below 48 kbps rather than quietly reporting worse
numbers; see `VERIFY.md`.

**`num_clusters=2` is pinned, not inferred.** A coaching call has two people on it, so the
hard part of diarization does not apply. Letting the clusterer decide only creates the
chance of a phantom third speaker out of a door slam. That is also why pyannote is not
here: it is more model for no more answer, and it is gated behind a Hugging Face token and
a terms acceptance, which would make a public repo unbuildable for anyone who cloned it.

### Ruled out on licence, not on quality

| | |
|---|---|
| `praat-parselmouth` | **GPL-3.0-or-later.** The accuracy leader for F0. The maintainer has said publicly that a dual licence is impossible because most of it is Praat code he cannot relicense. |
| `essentia` | **AGPL-3.0**, which is worse than GPL for a hosted service. |
| `openSMILE` | audEERING research licence that extends to the extracted features, despite PyPI's metadata saying MIT. |
| `whisper-timestamped` | AGPL. |
| `ctc-forced-aligner` default model, torchaudio `MMS_FA`, WhisperX non-English aligners, CrisperWhisper, Reverb | **CC-BY-NC.** This is what the 5.6k-star `whisper-diarization` project pulls in by default. |
| Hume, Azure emotion, OpenFace, OpenPose, Py-Feat | Sunset, retired, or non-commercial. |

### Dropped on measurement

**Filler-word rate.** Whisper's recall on filled pauses is **2.5%** — four of 157 gold
tokens. No setting fixes it; `suppress_tokens` never contained "um" or "uh", and larger
models are worse. The behaviour is length-dependent, so counts are not even comparable
between two calls. And it would be unactionable if it were measurable: a 2025 study rated
a *disfluent* agent more competent and more dependable than a fluent one. A second CTC
decode lane on Fisher/Switchboard was costed at +70 s and +$0.005 and rejected.

**Question rate is kept** at roughly 0.70–0.78 F1, reported as a floor. Prosodic question
detection was measured at about +0.2 F1 and is not worth a second model.

## Running it

```sh
export MODAL_PROFILE=leisuretimemovie          # five profiles on this machine; pin it
modal run    delivery/modal_app.py --media /path/to/call.mp4
modal deploy delivery/modal_app.py
curl https://leisuretimemovie--beavermind-delivery-api.modal.run/health
```

Workspace is pinned in code as well. The `MODAL_TOKEN_ID` in `ICM/.env` resolves to a
different workspace, so inheriting the ambient profile would bill the wrong account.

**Always curl `/health` after deploying.** `modal deploy` does not reliably drain a warm
web container — six consecutive deploys here kept serving the previous version, and a route
that existed only in the new code 404'd for two minutes. `/health` returns the contract
version and how FastAPI actually bound the request parameter, so a stale container is
visible in one request. `modal app stop` then `modal deploy` clears it.

## Calling it from the app

The worker outlives a Vercel function — 5–7 minutes against a 300-second ceiling — so it
cannot be awaited. Two shapes are supported; use whichever fits.

**Poll.** `POST /start?filename=…` with the media as the raw request body and an
`x-worker-token` header returns `{ call_id, bytes }` immediately. `GET /result?call_id=…`
returns `{ status: 'running' | 'done' | 'failed', report }`. Nothing else in the app needs
to know about it.

For anything large, pass `?media_url=` to a signed Supabase Storage URL instead and let the
worker fetch it. The browser then uploads straight to storage and a 200 MB recording never
passes through Vercel or through Modal's web layer at all.

**Callback.** Pass `callback_url` and the worker POSTs the finished report there with the
same `x-worker-token` header. A failed callback appends a note to the report rather than
losing it, so the poll path still works as a fallback.

The token lives in the Modal secret `beavermind-delivery` and in this project's `.env` as
`DELIVERY_WORKER_TOKEN`.

## Speaker roles

Diarization returns speaker `0` and speaker `1`. Nothing in the audio says which one is
the coach, so the worker uses the one who asked more questions, falls back to who spoke
longest, and returns the method and the margin. When `confident` is false the UI must
offer to swap the labels. A heuristic shown as a heuristic is fine; a heuristic shown as a
fact is not.

## PRESENCE is not here

The video tab has no worker. MediaPipe Tasks runs in the browser under WASM, so the
recording never uploads. That solves the 50 MB object cap, takes the CV compute to zero,
and removes most of the biometric-privacy exposure at the same time. Six to eight frames
may go to Claude for *scene* observations only — lighting, backlight, camera height,
background clutter — which MediaPipe cannot see. Never to read the person.

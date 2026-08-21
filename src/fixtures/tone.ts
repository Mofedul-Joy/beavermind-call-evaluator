/**
 * TONE tab fixtures. Two DeliveryReport shapes — a strong call and a weak one — so both
 * readings render. Contract is `src/delivery/types.ts`; nothing here invents a field.
 */

import type { Benchmark, DeliveryMetric, DeliveryMetricKey, DeliveryReport, DeliveryTurn, Utterance } from "@/delivery/types";

const noBenchmark = (why: string): Benchmark => ({
  kind: "none",
  source: why,
  sourceUrl: null,
  low: null,
  high: null,
  target: null,
});

const rangeBenchmark = (low: number, high: number, source: string): Benchmark => ({
  kind: "range",
  source,
  sourceUrl: null,
  low,
  high,
  target: null,
});

const targetBenchmark = (target: number, source: string): Benchmark => ({
  kind: "target",
  source,
  sourceUrl: null,
  low: null,
  high: null,
  target,
});

function metric(
  key: DeliveryMetricKey,
  label: string,
  unit: string,
  value: number | null,
  interpretation: DeliveryMetric["interpretation"],
  benchmark: Benchmark,
  perSpeaker: Record<string, number>,
  method: string,
  evidence: DeliveryMetric["evidence"] = [],
  unavailableReason: string | null = null,
): DeliveryMetric {
  return { key, label, unit, value, interpretation, benchmark, perSpeaker, evidence, unavailableReason, method };
}

const STRONG_TURNS: DeliveryTurn[] = [
  { speaker: "spk_0", start: 0, end: 14 },
  { speaker: "spk_1", start: 14, end: 26 },
  { speaker: "spk_0", start: 26, end: 61 },
  { speaker: "spk_1", start: 61, end: 98 },
  { speaker: "spk_0", start: 98, end: 121 },
  { speaker: "spk_1", start: 121, end: 172 },
  { speaker: "spk_0", start: 172, end: 190 },
  { speaker: "spk_1", start: 190, end: 233 },
  { speaker: "spk_0", start: 233, end: 261 },
  { speaker: "spk_1", start: 261, end: 305 },
];

const STRONG_UTTERANCES: Utterance[] = STRONG_TURNS.map((t, i) => ({
  ...t,
  text:
    [
      "How's the new intake process landing with the team so far?",
      "Honestly, better than I expected — the SDRs stopped skipping the qualification step.",
      "That's the thing I was hoping to hear. What made it stick this time, do you think?",
      "I think it's because we tied it to the commission calc instead of just asking nicely. Nobody wants to lose the spiff over a checkbox.",
      "Right, incentives beat reminders every time. Where's it still wobbling?",
      "Mostly on the enterprise deals — those reps say the extra fields slow them down mid-call, so they backfill later and half the time forget.",
      "Backfilling later is where it leaks. What would make it a zero-extra-step during the call itself?",
      "Maybe if the fields auto-populated from the discovery doc? We already require that doc before a demo gets booked.",
      "That's a real fix, not a workaround. Who owns wiring that up?",
      "I can get with our RevOps lead this week and scope it — I'll have a plan by Friday.",
    ][i] ?? "…",
}));

const WEAK_TURNS: DeliveryTurn[] = [
  { speaker: "spk_0", start: 0, end: 8 },
  { speaker: "spk_1", start: 8, end: 12 },
  { speaker: "spk_0", start: 12, end: 157 },
  { speaker: "spk_1", start: 157, end: 161 },
  { speaker: "spk_0", start: 161, end: 166 },
  { speaker: "spk_0", start: 166, end: 233 },
  { speaker: "spk_1", start: 233, end: 236 },
  { speaker: "spk_0", start: 236, end: 341 },
  { speaker: "spk_1", start: 341, end: 344 },
  { speaker: "spk_0", start: 344, end: 402 },
];

const WEAK_UTTERANCES: Utterance[] = WEAK_TURNS.map((t, i) => ({
  ...t,
  text:
    [
      "Okay so, quick check-in, how's the week been?",
      "Fine.",
      "Good, good. So look, I want to walk you through the whole funnel again because I think there's a couple of things we glossed over last time, starting with the top-of-funnel messaging — actually let's back up even further, let's talk about positioning generally, because I don't think we've ever really nailed down...",
      "Okay.",
      "Right, so —",
      "— anyway the point is positioning drives everything downstream, the messaging, the qualification bar, even how the SDRs open a call, and I've seen this go wrong at three other companies, so let me just walk through what usually happens...",
      "Sure.",
      "So circling back to your funnel specifically, I'd guess your drop-off is happening around the demo stage, which tracks with what I usually see, and honestly the fix is almost always the same three things, discovery depth, timing, and follow-up cadence, so let's go through each...",
      "Yeah.",
      "Right, so on discovery depth, what I mean is...",
    ][i] ?? "…",
}));

const STRONG_METRICS: DeliveryMetric[] = [
  metric(
    "talk_ratio",
    "Talk ratio",
    "%",
    46,
    "band",
    rangeBenchmark(35, 55, "Aggregate coaching-call benchmarks (Gong/Chorus-style vendor studies, 2019–2023)"),
    { spk_0: 46, spk_1: 54 },
    "Speaking seconds per diarized speaker, divided by total speech seconds (silence excluded).",
    [{ startSec: 26, endSec: 61, note: "35s turn, inside range" }],
  ),
  metric(
    "longest_monologue",
    "Longest monologue",
    "sec",
    39,
    "lower_is_better",
    targetBenchmark(90, "Coaching-call analytics vendors report monologues over ~90s correlate with lower ratings"),
    { spk_0: 39, spk_1: 43 },
    "Longest single unbroken turn by any speaker, from diarized turn boundaries.",
    [{ startSec: 261, endSec: 304, note: "Client's longest turn, 43s" }],
  ),
  metric(
    "wpm",
    "Speaking rate",
    "wpm",
    142,
    "band",
    rangeBenchmark(120, 160, "Toastmasters / presentation-coaching consensus range for comprehensible pacing"),
    { spk_0: 142, spk_1: 138 },
    "Word count from ASR transcript over voiced duration per speaker, words per minute.",
  ),
  metric(
    "question_rate",
    "Question rate",
    "/min",
    2.4,
    "higher_is_better",
    targetBenchmark(1.5, "SPIN/consultative-selling literature: open-question density correlates with discovery quality"),
    { spk_0: 2.4, spk_1: 0.2 },
    "ASR '?' tokens unioned with a punctuation restorer, attributed to speaker and turn, counted per minute of coach speech.",
    [
      { startSec: 98, endSec: null, note: "\"Where's it still wobbling?\"" },
      { startSec: 172, endSec: null, note: "\"What would make it a zero-extra-step during the call itself?\"" },
    ],
  ),
  metric(
    "pause_after_question",
    "Pause after question",
    "sec",
    2.1,
    "band",
    rangeBenchmark(1, 3, "Active-listening coaching guidance: under 1s reads as interrupting, over 3s reads as dead air"),
    { spk_0: 2.1, spk_1: 0 },
    "Silence between a detected question's end and the next speaker's first voiced frame.",
  ),
  metric(
    "long_pause_count",
    "Long pauses (>3s)",
    "count",
    1,
    "lower_is_better",
    noBenchmark("No published per-call norm; reported as a call-relative count, not compared."),
    { spk_0: 1, spk_1: 0 },
    "Silero-derived silence regions over 3s between voiced segments, from the speech-region boundaries sherpa-onnx already produces.",
    [{ startSec: 121, endSec: 125, note: "4.1s pause before the client's turn" }],
  ),
  metric(
    "interruptions",
    "Interruptions",
    "count",
    0,
    "lower_is_better",
    noBenchmark("No published per-call norm; reported as a call-relative count, not compared."),
    { spk_0: 0, spk_1: 0 },
    "Overlapping-speech regions from diarization where a second speaker's voiced frames begin before the first speaker's turn ends.",
  ),
  metric(
    "energy_variance",
    "Energy variance",
    "dB SD",
    5.8,
    "context_only",
    noBenchmark("No published benchmark for vocal energy variability in a coaching-call context; shown as trend, not compared, per D3."),
    { spk_0: 5.8, spk_1: 4.9 },
    "Frame-level RMS energy in dB (post ebur128 loudness normalization), standard deviation over voiced frames.",
  ),
  metric(
    "pitch_variance",
    "Pitch variance (F0 SD)",
    "st SD",
    3.6,
    "context_only",
    noBenchmark("No published benchmark for F0 variability in a coaching-call context; shown as trend, not compared, per D3."),
    { spk_0: 3.6, spk_1: 3.1 },
    "swift-f0 (ONNX) fundamental frequency per voiced frame, converted to semitones, standard deviation over the call.",
  ),
];

const WEAK_METRICS: DeliveryMetric[] = [
  metric(
    "talk_ratio",
    "Talk ratio",
    "%",
    83,
    "band",
    rangeBenchmark(35, 55, "Aggregate coaching-call benchmarks (Gong/Chorus-style vendor studies, 2019–2023)"),
    { spk_0: 83, spk_1: 17 },
    "Speaking seconds per diarized speaker, divided by total speech seconds (silence excluded).",
    [{ startSec: 166, endSec: 233, note: "67s turn, no client response inside it" }],
  ),
  metric(
    "longest_monologue",
    "Longest monologue",
    "sec",
    145,
    "lower_is_better",
    targetBenchmark(90, "Coaching-call analytics vendors report monologues over ~90s correlate with lower ratings"),
    { spk_0: 145, spk_1: 3 },
    "Longest single unbroken turn by any speaker, from diarized turn boundaries.",
    [{ startSec: 12, endSec: 157, note: "145s unbroken — over the 90s target by 61%" }],
  ),
  metric(
    "wpm",
    "Speaking rate",
    "wpm",
    null,
    "band",
    rangeBenchmark(120, 160, "Toastmasters / presentation-coaching consensus range for comprehensible pacing"),
    {},
    "Word count from ASR transcript over voiced duration per speaker, words per minute.",
    [],
    "Word timestamps came back too sparse to trust below 48 kbps — onnx-asr's confidence on this file fell under the threshold this pipeline requires before reporting a rate.",
  ),
  metric(
    "question_rate",
    "Question rate",
    "/min",
    0.4,
    "higher_is_better",
    targetBenchmark(1.5, "SPIN/consultative-selling literature: open-question density correlates with discovery quality"),
    { spk_0: 0.4, spk_1: 0 },
    "ASR '?' tokens unioned with a punctuation restorer, attributed to speaker and turn, counted per minute of coach speech.",
  ),
  metric(
    "pause_after_question",
    "Pause after question",
    "sec",
    0.4,
    "band",
    rangeBenchmark(1, 3, "Active-listening coaching guidance: under 1s reads as interrupting, over 3s reads as dead air"),
    { spk_0: 0.4, spk_1: 0 },
    "Silence between a detected question's end and the next speaker's first voiced frame.",
    [{ startSec: 161, endSec: 166, note: "Next turn starts 0.4s after the only question in the call" }],
  ),
  metric(
    "long_pause_count",
    "Long pauses (>3s)",
    "count",
    0,
    "lower_is_better",
    noBenchmark("No published per-call norm; reported as a call-relative count, not compared."),
    { spk_0: 0, spk_1: 0 },
    "Silero-derived silence regions over 3s between voiced segments, from the speech-region boundaries sherpa-onnx already produces.",
  ),
  metric(
    "interruptions",
    "Interruptions",
    "count",
    4,
    "lower_is_better",
    noBenchmark("No published per-call norm; reported as a call-relative count, not compared."),
    { spk_0: 4, spk_1: 0 },
    "Overlapping-speech regions from diarization where a second speaker's voiced frames begin before the first speaker's turn ends.",
    [
      { startSec: 161, endSec: 163, note: "Talks over client's \"Okay.\"" },
      { startSec: 233, endSec: 235, note: "Talks over client's \"Sure.\"" },
    ],
  ),
  metric(
    "energy_variance",
    "Energy variance",
    "dB SD",
    1.9,
    "context_only",
    noBenchmark("No published benchmark for vocal energy variability in a coaching-call context; shown as trend, not compared, per D3."),
    { spk_0: 1.9, spk_1: 2.4 },
    "Frame-level RMS energy in dB (post ebur128 loudness normalization), standard deviation over voiced frames.",
  ),
  metric(
    "pitch_variance",
    "Pitch variance (F0 SD)",
    "st SD",
    1.1,
    "context_only",
    noBenchmark("No published benchmark for F0 variability in a coaching-call context; shown as trend, not compared, per D3."),
    { spk_0: 1.1, spk_1: 2.0 },
    "swift-f0 (ONNX) fundamental frequency per voiced frame, converted to semitones, standard deviation over the call.",
  ),
];

export const STRONG_TONE_REPORT: DeliveryReport = {
  version: 1,
  media: {
    durationSec: 305,
    hasVideo: false,
    sampleRate: 16000,
    filename: "ivan-petrov-renata-cruz-kickoff.m4a",
    source: { codec: "aac", bitrate: 128000, sampleRate: 44100 },
  },
  speakers: [
    { id: "spk_0", role: "coach", speakingSec: 140, turnCount: 5, wordCount: 332 },
    { id: "spk_1", role: "client", speakingSec: 165, turnCount: 5, wordCount: 379 },
  ],
  roleAssignment: { coachSpeakerId: "spk_0", method: "First speaker to say a self-identifying phrase (\"I'm gonna be your coach\")", margin: 0.82, confident: true },
  metrics: STRONG_METRICS,
  turns: STRONG_TURNS,
  utterances: STRONG_UTTERANCES,
  notes: [],
  compute: { wallClockSec: 128, usdEstimate: 0.018, realtimeFactor: 0.42, stack: "ffmpeg loudnorm → sherpa-onnx diarize → onnx-asr parakeet-tdt-0.6b-v3 → swift-f0" },
};

export const WEAK_TONE_REPORT: DeliveryReport = {
  version: 1,
  media: {
    durationSec: 402,
    hasVideo: false,
    sampleRate: 16000,
    filename: "recall-export-call-0912.opus",
    source: { codec: "opus", bitrate: 23000, sampleRate: 16000 },
  },
  speakers: [
    { id: "spk_0", role: "coach", speakingSec: 334, turnCount: 5, wordCount: 1041 },
    { id: "spk_1", role: "client", speakingSec: 68, turnCount: 5, wordCount: 41 },
  ],
  roleAssignment: {
    coachSpeakerId: "spk_0",
    method: "Higher speaking-time share (no self-identifying phrase found)",
    margin: 0.11,
    confident: false,
  },
  metrics: WEAK_METRICS,
  turns: WEAK_TURNS,
  utterances: WEAK_UTTERANCES,
  notes: [
    "Source audio measured at 23 kbps (Opus) — below the 48 kbps threshold this pipeline was validated against. At comparable low bitrates, speaker assignment has inverted and interruption counts have been invented in testing. Treat every metric below as indicative, not conclusive.",
  ],
  compute: { wallClockSec: 171, usdEstimate: 0.024, realtimeFactor: 0.43, stack: "ffmpeg loudnorm → sherpa-onnx diarize → onnx-asr parakeet-tdt-0.6b-v3 → swift-f0" },
};

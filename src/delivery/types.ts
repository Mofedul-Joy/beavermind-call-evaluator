/**
 * The delivery-analytics contract, app side.
 *
 * Mirrors `delivery/contract.py` field for field. The worker emits camelCase so there is
 * no mapping layer here — what Modal returns is what these types describe.
 * `delivery/test_metrics.py::TestWireFormat` reads this file and fails if the worker ever
 * emits a key it does not declare, so the two cannot drift silently.
 *
 * This describes the TONE tab only. PRESENCE is measured in the browser and never leaves
 * the coach's machine, so it has no worker and no wire format.
 *
 * Three properties of these shapes are load-bearing:
 *
 *   1. There is no overall score. Vocal delivery is measured, not graded. The rubric is
 *      the client's document with defined bands; this is a set of instruments.
 *   2. There is no emotion, sentiment, confidence or engagement field, and there is
 *      nowhere to put one. EU AI Act Art. 5(1)(f) bans inferring emotions in a workplace
 *      context; Recital 18 carves out "mere detection of readily apparent expressions,
 *      gestures or movements". Every field below is a physical quantity with a unit.
 *   3. `benchmark.source` is required. Where no published benchmark exists, `kind` is
 *      `'none'` and the source says so rather than supplying a plausible-looking number.
 */

export const DELIVERY_CONTRACT_VERSION = 1

export type Interpretation =
  | 'higher_is_better'
  | 'lower_is_better'
  /** There is a healthy middle; both tails are worth a note. */
  | 'band'
  /** Reported so the coach can see it. No direction is claimed. */
  | 'context_only'

export type BenchmarkKind = 'range' | 'target' | 'none'

export type Benchmark = {
  kind: BenchmarkKind
  /** Always populated. For `kind: 'none'` it explains why there is nothing to compare to. */
  source: string
  sourceUrl: string | null
  low: number | null
  high: number | null
  target: number | null
}

/** A clickable point or span in the recording. `endSec` is null for an instant. */
export type Moment = {
  startSec: number
  endSec: number | null
  note: string
}

export type DeliveryMetric = {
  key: DeliveryMetricKey
  label: string
  unit: string
  /** null when the measurement could not be made. Render `unavailableReason`, not a zero. */
  value: number | null
  interpretation: Interpretation
  benchmark: Benchmark
  /** Keyed by speaker id, which is a diarization cluster label, not a name. */
  perSpeaker: Record<string, number>
  evidence: Moment[]
  unavailableReason: string | null
  /** How this number was arrived at. Shown in the UI; it is what makes the figure checkable. */
  method: string
}

export type DeliveryMetricKey =
  | 'talk_ratio'
  | 'longest_monologue'
  | 'wpm'
  | 'question_rate'
  | 'pause_after_question'
  | 'long_pause_count'
  | 'interruptions'
  | 'energy_variance'
  | 'pitch_variance'

export type SpeakerSummary = {
  id: string
  role: 'coach' | 'client' | 'unknown'
  speakingSec: number
  turnCount: number
  wordCount: number
}

/**
 * How the worker decided which diarized cluster is the coach.
 *
 * Diarization returns anonymous clusters; nothing in the audio says which one is the
 * coach. This is a stated heuristic with a stated margin. When `confident` is false the
 * UI must offer to swap the labels rather than presenting the guess as a fact.
 */
export type RoleAssignment = {
  coachSpeakerId: string | null
  method: string
  margin: number
  confident: boolean
}

export type DeliveryTurn = {
  speaker: string
  start: number
  end: number
}

/**
 * What was said in one turn. Present only when a recording was uploaded — the TRANSCRIPT
 * tab still scores the operator's own pasted transcript. These exist to caption a tone
 * timestamp with the words that go with it.
 */
export type Utterance = {
  speaker: string
  start: number
  end: number
  text: string
}

export type DeliveryReport = {
  version: number
  media: {
    durationSec: number
    hasVideo: boolean
    /** Always 16000 — what the pipeline worked on, not what was uploaded. */
    sampleRate: number
    filename: string
    /** What was uploaded. A low bitrate here is why a quality warning is in `notes`. */
    source: { codec: string | null; bitrate: number | null; sampleRate: number | null }
  }
  speakers: SpeakerSummary[]
  roleAssignment: RoleAssignment
  metrics: DeliveryMetric[]
  /** The full talk track, for drawing the timeline strip. */
  turns: DeliveryTurn[]
  /** Per-turn text, for captioning a moment. */
  utterances: Utterance[]
  /** Caveats that apply to the whole report. Always surface these. */
  notes: string[]
  compute: {
    wallClockSec: number
    usdEstimate: number
    realtimeFactor: number | null
    stack: string
  }
}

/** What the Modal poll endpoint returns. */
export type DeliveryJob =
  | { status: 'running'; report: null }
  | { status: 'done'; report: DeliveryReport }
  | { status: 'failed'; report: null; error: string }

export const metricsByKey = (r: DeliveryReport): Record<string, DeliveryMetric> =>
  Object.fromEntries(r.metrics.map((m) => [m.key, m]))

export const coachValue = (m: DeliveryMetric, r: DeliveryReport): number | null =>
  r.roleAssignment.coachSpeakerId
    ? (m.perSpeaker[r.roleAssignment.coachSpeakerId] ?? m.value)
    : m.value

/**
 * Whether a value sits outside its benchmark. Returns null when there is nothing to
 * compare against, which is the common case and must not render as "fine".
 */
export const outsideBenchmark = (m: DeliveryMetric): boolean | null => {
  if (m.value === null) return null
  const { kind, low, high, target } = m.benchmark
  if (kind === 'range' && low !== null && high !== null) return m.value < low || m.value > high
  if (kind === 'target' && target !== null) {
    return m.interpretation === 'lower_is_better' ? m.value > target : m.value < target
  }
  return null
}

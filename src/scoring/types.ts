/**
 * THE CONTRACT.
 *
 * Every shape the app passes around, from the model's raw answer through to what the
 * report and the PDF render. Both build agents code against this file and neither edits
 * it — changes come back to the main session first.
 *
 * Two rules are enforced by these types rather than by prompt instructions:
 *
 *   1. Evidence is line NUMBERS, never quoted text. The server hydrates the verbatim
 *      line from the transcript it already holds, so a fabricated quote is not merely
 *      detected, it is unrepresentable.
 *   2. The model never returns a total, a band, or a capped score. It returns raw
 *      per-dimension buckets and cap findings; `engine.ts` does every piece of
 *      arithmetic. Same transcript, same numbers, every time.
 */

export type CallType = 'coaching' | 'kickoff'

/** A transcript, split into speaking turns and given stable 1-based line numbers. */
export type NumberedTranscript = {
  /** `lines[0]` is line 1. Index i holds line number i+1. */
  lines: { n: number; speaker: string; text: string; raw: string }[]
  /** Distinct speaker names in order of first appearance. */
  speakers: string[]
  charCount: number
}

// ── What the model returns ────────────────────────────────────────────────────

/**
 * The model's answer for one dimension.
 *
 * `score` is null exactly when `status` is not `scored`. `evidence` carries line numbers
 * into the transcript that was sent, nothing else.
 */
export type ModelDimensionAnswer = {
  key: string
  /**
   * `scored`        — behaviour found in the transcript and graded.
   * `not_evidenced` — the behaviour is simply not present in the transcript. The rubric
   *                   requires scoring conservatively here, which the engine enforces by
   *                   forcing the lowest bucket. This is the state the client's thin
   *                   transcript exists to test for.
   * `disabled`      — an optional dimension the call did not trigger (coaching D4).
   */
  status: 'scored' | 'not_evidenced' | 'disabled'
  /** Must be one of the dimension's allowed values. Validated, never trusted. */
  score: number | null
  /** Starts "Scored X/Y because …", matching the client's own report convention. */
  rationale: string
  /** 1-based transcript line numbers. Empty is only valid when status is not `scored`. */
  evidence: number[]
  /** "To reach {max}: …". Absent when the dimension is disabled. */
  quickFix: string | null
  /** Required when status is `disabled` or `not_evidenced`. */
  statusReason?: string
}

/** The model's judgement on one deterministic cap condition. It never applies the effect. */
export type ModelCapFinding = {
  capId: string
  /** True when the condition the client wrote HOLDS, i.e. the cap should bite. */
  holds: boolean
  /** Line numbers supporting the finding. May be empty when the finding is an absence. */
  evidence: number[]
  reasoning: string
}

/** The complete structured answer. This is what the JSON schema sent to the model shapes. */
export type ModelAnswer = {
  /** The single change that moves the number most. Rendered as the report's hero quote. */
  theOneThing: { change: string; wouldScore: number; evidence: number[] }
  /** A few sentences on how the call went, addressed to the coach. */
  brief: string
  redFlags: { title: string; why: string; evidence: number[] }[]
  dimensions: ModelDimensionAnswer[]
  capFindings: ModelCapFinding[]
}

// ── What the server computes ──────────────────────────────────────────────────

/** A hydrated evidence line. `text` is copied from the transcript, never from the model. */
export type Evidence = { line: number; speaker: string; text: string }

export type AppliedCap = {
  capId: string
  condition: string
  effect: string
  /** e.g. "D10 5 → 0" or "total ≤ 75". Rendered verbatim in the scoring trace. */
  change: string
  nonRecoverable: boolean
  evidence: Evidence[]
  reasoning: string
}

export type DimensionResult = {
  n: number
  key: string
  title: string
  max: number
  status: ModelDimensionAnswer['status']
  /** After caps. Null when disabled. */
  score: number | null
  /** Before caps, kept so the trace can show the delta. */
  rawScore: number | null
  bucketLabel: string | null
  rationale: string
  evidence: Evidence[]
  quickFix: string | null
  statusReason?: string
  /** True when a cap changed this dimension's score. */
  capped: boolean
}

/**
 * Every number in the report, with the arithmetic that produced it.
 *
 * The denominator is the sum of the maxima of the ACTIVE dimensions — not a hardcoded
 * 100 — because the coaching rubric's twelve dimensions sum to 105 while its prose says
 * 100. Normalising is the method that rubric itself prescribes for its disabled-dimension
 * case; this generalises it so it always holds. See `rubric.discrepancies`.
 */
export type ScoreTrace = {
  rawTotal: number
  /** Sum of maxima of active dimensions. 105 for coaching, 90 with D4 disabled. */
  denominator: number
  /** Dimensions excluded from the denominator, with why. */
  excluded: { n: number; title: string; max: number; reason: string }[]
  capsApplied: AppliedCap[]
  /** After dimension caps, before total caps. */
  totalAfterDimensionCaps: number
  /** The binding total cap, if any bit. */
  totalCapApplied: { capId: string; value: number } | null
  /** rawTotal normalised onto the report scale, rounded. This is the headline number. */
  normalised: number
  band: { name: string; description: string }
}

export type Report = {
  theOneThing: { change: string; wouldScore: number; evidence: Evidence[] }
  brief: string
  redFlags: { title: string; why: string; evidence: Evidence[] }[]
  dimensions: DimensionResult[]
  trace: ScoreTrace
}

// ── The run lifecycle ─────────────────────────────────────────────────────────

/**
 * `queued`  — row written, background work not yet started.
 * `running` — model call in flight.
 * `done`    — report present.
 * `failed`  — `error` explains why, in words a human can act on. Never a bare spinner.
 */
export type RunStatus = 'queued' | 'running' | 'done' | 'failed'

export type RunError = {
  /** Stable, so the UI can render a tailored message. */
  code:
    | 'transcript_too_long'
    | 'transcript_unparseable'
    | 'model_refused'
    | 'invalid_evidence'
    | 'schema_violation'
    | 'rate_limited'
    | 'daily_cap_reached'
    | 'model_error'
    | 'timeout'
    | 'unknown'
  /** Written for the operator, not the developer. */
  message: string
  /** Developer detail, shown behind a disclosure. */
  detail?: string
  at: string
}

export type RunCost = {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  usd: number
  model: string
}

export type Run = {
  id: string
  callType: CallType
  status: RunStatus
  /** Optional labels the operator can attach. Purely descriptive. */
  coachName: string | null
  clientName: string | null
  /** Which compiled rubric produced this result, so an old run stays interpretable. */
  rubricHash: string
  transcript: NumberedTranscript
  report: Report | null
  error: RunError | null
  cost: RunCost | null
  /** Seeded demo runs are flagged so the list can mark them. */
  isSample: boolean
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

/** The row shape the evaluations list renders. Deliberately small. */
export type RunSummary = Pick<
  Run,
  'id' | 'callType' | 'status' | 'coachName' | 'clientName' | 'isSample' | 'createdAt'
> & {
  score: number | null
  band: string | null
  costUsd: number | null
}

/**
 * The shape a rubric takes once it has been compiled out of the client's markdown.
 *
 * The markdown in `rubrics/` is a grading document written for humans. It is the source
 * of truth and it is never edited. This file describes what it becomes so that a model
 * can score against it identically twice, and so that every deterministic rule in it
 * (the caps, the totals, the bands) can be executed by code rather than by a model.
 */

/** A dimension whose table lists exact, discrete score values. No interpolation. */
export type DiscreteScoring = {
  mode: 'discrete'
  /** Sorted high → low, exactly as the rubric lists them. */
  buckets: { value: number; label: string; criteria: string }[]
}

/**
 * A dimension whose table lists bands covering a range. Any integer inside the range is
 * allowed, plus half steps where the dimension's max is 5 or less.
 */
export type BandScoring = {
  mode: 'band'
  bands: { label: string; min: number; max: number; criteria: string }[]
  /** True when max <= 5, per the kickoff rubric's band-based scoring note. */
  allowsHalfSteps: boolean
}

export type Scoring = DiscreteScoring | BandScoring

/**
 * A dimension the rubric can switch off. Only coaching D4 has one today: when the call
 * contained no movement coaching the dimension is disabled and the call is scored out of
 * 85 rather than 100, then reported back on the 100 scale.
 */
export type OptionalRule = {
  /** ALL of these must be absent for the dimension to be disabled. */
  detectionCriteria: string[]
  /** What `total.maxPossible` becomes when disabled. */
  disabledMaxPossible: number
}

export type Dimension = {
  /** 1-based, as printed. */
  n: number
  /** Stable slug, e.g. `check_in_and_connection`. Used as the JSON key the model returns. */
  key: string
  title: string
  max: number
  pillar?: string
  sopTime?: string
  whatToLookFor: string
  scoring: Scoring
  positiveSignals: string[]
  negativeSignals: string[]
  /** Block quotes and "Calibration note" paragraphs attached to this dimension. */
  notes: string[]
  optional?: OptionalRule
}

/**
 * A cap is a deterministic rule. The model reports whether the condition HOLDS and cites
 * evidence; it never applies the arithmetic. `applyCaps()` does that.
 */
export type Cap = {
  id: string
  /** The condition as the client wrote it, verbatim. This is what the model judges. */
  condition: string
  effect:
    | { type: 'dimension_max'; dimension: number; value: number }
    | { type: 'dimension_fixed'; dimension: number; value: number }
    | { type: 'total_max'; value: number }
  /** Non-recoverable caps cannot be lifted by anything else in the call. */
  nonRecoverable: boolean
  /** The raw table row, kept so the report can quote the client's own wording. */
  raw: string
}

export type Band = { name: string; min: number; max: number; description: string }

/**
 * Where the client's document contradicts itself.
 *
 * The coaching rubric prints twelve dimensions that sum to 105 while its prose says
 * "Twelve dimensions, 100 points", and its stated disabled-total of 85 does not match
 * 105 - 15 = 90 either. Rather than silently trusting one number over the other, the
 * compiler records the contradiction and the app shows it in the scoring trace.
 */
export type Discrepancy = {
  what: string
  stated: string
  computed: string
  resolution: string
}

export type CompiledRubric = {
  id: 'coaching' | 'kickoff'
  title: string
  /** Content hash of the source markdown. Changes when the client edits the rubric. */
  sourceHash: string
  sourceFile: string
  /** What the document's prose claims the total is. */
  statedTotalPoints: number
  /**
   * Sum of every dimension's printed maximum. This, not `statedTotalPoints`, is the
   * denominator when every dimension is active — because it is the only number that
   * the dimension tables actually support.
   */
  activeMaxRaw: number
  discrepancies: Discrepancy[]
  /** The scale every report is presented on, whatever the raw denominator turns out to be. */
  reportScale: 100
  dimensions: Dimension[]
  caps: Cap[]
  bands: Band[]
  /** Scope notes and scoring-grammar notes from the top of the document. */
  preamble: string[]
  principles: string[]
  /** Reviewer-aligned calibration patterns (kickoff only, today). */
  calibrationAnchors: string[]
}

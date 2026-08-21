/**
 * The JSON Schema sent to the Anthropic API as `output_config.format`.
 *
 * First attempt kept the contract's `dimension.key` closeness by making `dimensions` and
 * `capFindings` OBJECTS keyed by `dimension.key` / `cap.id` — one distinct, fully
 * enum-constrained sub-schema per dimension. That 400'd with "The compiled grammar is too
 * large" even after every `description` was stripped and even with the per-dimension score
 * `enum` removed entirely — twelve structurally-distinct sibling object schemas is what the
 * compiler choked on, not size or enum count (a ~7.5KB schema, 99 enum values total).
 *
 * `dimensions` and `capFindings` are ARRAYS instead, each with ONE shared item schema (the
 * same shape the contract already declares) — the compiler only builds one automaton per
 * array, reused for every item, rather than one per dimension. This gives up two guarantees
 * the keyed-object version had for free: that a score is one of `allowedScores(dimension)`,
 * and that every dimension/cap appears exactly once. Both are already fully covered by
 * `validateAnswer` plus the one retry the contract already mandates — that retry exists
 * for exactly this ("score not in the dimension's buckets", "D4 is missing from the
 * answer"), so this isn't a gap, just where the check happens.
 */
import type { CompiledRubric } from '../rubric/types'
import type { ModelAnswer } from '../scoring/types'

const LINE_NUMBERS = { type: 'array', items: { type: 'integer' } }

/** One beat of a dimension's reasoning. Same shared-item trick as the arrays above. */
const RATIONALE_POINT = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['title', 'body'],
  additionalProperties: false,
}

function dimensionItemSchema(rubric: CompiledRubric) {
  return {
    type: 'object',
    properties: {
      key: { type: 'string', enum: rubric.dimensions.map((d) => d.key) },
      status: { type: 'string', enum: ['scored', 'not_evidenced', 'disabled'] },
      score: { type: 'number' },
      rationale: { type: 'string' },
      points: { type: 'array', items: RATIONALE_POINT },
      evidence: LINE_NUMBERS,
      quickFix: { type: 'string' },
      statusReason: { type: 'string' },
    },
    // `points` is required here so the model always produces it, and optional in the
    // contract so jsonb rows written before it existed still parse.
    required: ['key', 'status', 'score', 'rationale', 'points', 'evidence', 'quickFix', 'statusReason'],
    additionalProperties: false,
  }
}

function capItemSchema(rubric: CompiledRubric) {
  return {
    type: 'object',
    properties: {
      capId: { type: 'string', enum: rubric.caps.map((c) => c.id) },
      holds: { type: 'boolean' },
      evidence: LINE_NUMBERS,
      reasoning: { type: 'string' },
    },
    required: ['capId', 'holds', 'evidence', 'reasoning'],
    additionalProperties: false,
  }
}

const THE_ONE_THING = {
  type: 'object',
  properties: {
    change: { type: 'string' },
    detail: { type: 'string' },
    wouldScore: { type: 'number' },
    evidence: LINE_NUMBERS,
  },
  required: ['change', 'detail', 'wouldScore', 'evidence'],
  additionalProperties: false,
}

const RED_FLAG = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    why: { type: 'string' },
    evidence: LINE_NUMBERS,
  },
  required: ['title', 'why', 'evidence'],
  additionalProperties: false,
}

export function buildModelAnswerSchema(rubric: CompiledRubric) {
  return {
    type: 'object',
    properties: {
      theOneThing: THE_ONE_THING,
      brief: { type: 'string' },
      redFlags: { type: 'array', items: RED_FLAG },
      dimensions: { type: 'array', items: dimensionItemSchema(rubric) },
      capFindings: { type: 'array', items: capItemSchema(rubric) },
    },
    required: ['theOneThing', 'brief', 'redFlags', 'dimensions', 'capFindings'],
    additionalProperties: false,
  }
}

/**
 * Force the contract's `score is null exactly when status is not "scored"` invariant —
 * the schema can no longer express that (no per-field `anyOf`, see the file header), so
 * it's enforced here instead of trusted from the model. Same for `quickFix`.
 */
export function toModelAnswer(raw: ModelAnswer): ModelAnswer {
  return {
    ...raw,
    dimensions: raw.dimensions.map((d) => {
      const scored = d.status === 'scored'
      return { ...d, score: scored ? d.score : null, quickFix: scored ? d.quickFix || null : null }
    }),
  }
}

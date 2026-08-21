/**
 * The deterministic half of scoring.
 *
 * The model contributes judgement: which bucket each dimension lands in, and whether each
 * cap condition holds. Everything downstream of that — validating the answer, hydrating
 * evidence, applying caps, choosing the denominator, normalising, picking the band — is
 * arithmetic and happens here, so the same answer always produces the same report.
 *
 * Nothing in this file calls a model or touches the network.
 */
import type { CompiledRubric, Dimension } from '../rubric/types'
import type {
  AppliedCap,
  DimensionResult,
  Evidence,
  ModelAnswer,
  NumberedTranscript,
  Report,
  ScoreTrace,
} from './types'

// ── Transcript ────────────────────────────────────────────────────────────────

const TURN = /^\[([^\]]+)\]:\s?(.*)$/

/**
 * Split a raw transcript into numbered turns.
 *
 * The client's format is one speaking turn per line, `[Speaker Name]: what they said`.
 * Blank lines are dropped. A line that does not match keeps its number and is attributed
 * to the previous speaker, so line numbers stay stable even on malformed input — evidence
 * references must never silently shift.
 */
export function numberTranscript(raw: string): NumberedTranscript {
  const lines: NumberedTranscript['lines'] = []
  const speakers: string[] = []
  let n = 0
  let lastSpeaker = 'Unknown'

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    n += 1
    const m = trimmed.match(TURN)
    if (m) {
      lastSpeaker = m[1].trim()
      if (!speakers.includes(lastSpeaker)) speakers.push(lastSpeaker)
      lines.push({ n, speaker: lastSpeaker, text: m[2].trim(), raw: trimmed })
    } else {
      lines.push({ n, speaker: lastSpeaker, text: trimmed, raw: trimmed })
    }
  }

  return { lines, speakers, charCount: raw.length }
}

/** Render the transcript the way the model sees it: `L0142 [Speaker]: text`. */
export function renderForModel(t: NumberedTranscript): string {
  const width = String(t.lines.length).length
  return t.lines.map((l) => `L${String(l.n).padStart(width, '0')} [${l.speaker}]: ${l.text}`).join('\n')
}

// ── Validation ────────────────────────────────────────────────────────────────

export class AnswerInvalid extends Error {
  constructor(
    message: string,
    /** Fed back to the model verbatim on the single retry. */
    readonly problems: string[],
  ) {
    super(message)
    this.name = 'AnswerInvalid'
  }
}

/** The values a dimension is allowed to take, per its own table. */
export function allowedScores(d: Dimension): number[] {
  if (d.scoring.mode === 'discrete') return d.scoring.buckets.map((b) => b.value).sort((a, b) => a - b)
  const out = new Set<number>()
  for (const band of d.scoring.bands) {
    for (let v = band.min; v <= band.max + 1e-9; v += d.scoring.allowsHalfSteps ? 0.5 : 1) {
      out.add(Math.round(v * 2) / 2)
    }
  }
  return [...out].sort((a, b) => a - b)
}

/** The bucket or band label a score falls in, for display. */
function labelFor(d: Dimension, score: number): string | null {
  if (d.scoring.mode === 'discrete')
    return d.scoring.buckets.find((b) => b.value === score)?.label ?? null
  return d.scoring.bands.find((b) => score >= b.min && score <= b.max)?.label ?? null
}

/** The lowest value the dimension permits. Where an unevidenced dimension lands. */
function floorScore(d: Dimension): number {
  return Math.min(...allowedScores(d))
}

/** The next value down the dimension's own scale. Where a contradicted maximum lands. */
function oneBucketBelow(d: Dimension, from: number): number {
  const below = allowedScores(d).filter((v) => v < from)
  return below.length ? Math.max(...below) : from
}

/**
 * Check the model's answer against the rubric and the transcript.
 *
 * Throws `AnswerInvalid` listing every problem at once, so the retry can name them all
 * rather than discovering them one at a time.
 */
export function validateAnswer(answer: ModelAnswer, rubric: CompiledRubric, t: NumberedTranscript): void {
  const problems: string[] = []
  const maxLine = t.lines.length
  const seen = new Set<string>()

  const checkLines = (where: string, lines: number[]) => {
    for (const n of lines) {
      if (!Number.isInteger(n) || n < 1 || n > maxLine)
        problems.push(`${where}: line ${n} is outside the transcript (1–${maxLine})`)
    }
  }

  for (const d of rubric.dimensions) {
    const a = answer.dimensions.find((x) => x.key === d.key)
    if (!a) {
      problems.push(`D${d.n} (${d.key}) is missing from the answer`)
      continue
    }
    if (seen.has(a.key)) problems.push(`D${d.n} (${d.key}) appears more than once`)
    seen.add(a.key)

    checkLines(`D${d.n} evidence`, a.evidence)

    if (a.status === 'disabled' && !d.optional)
      problems.push(`D${d.n} was marked disabled but is not an optional dimension`)

    if (a.status === 'scored') {
      if (a.score === null) {
        problems.push(`D${d.n} is scored but has no score`)
      } else if (!allowedScores(d).includes(a.score)) {
        problems.push(`D${d.n} scored ${a.score}; allowed values are ${allowedScores(d).join(', ')}`)
      }
      // The rubric's own rule: a score must rest on transcript evidence.
      if (a.evidence.length === 0)
        problems.push(`D${d.n} is scored but cites no evidence — use status "not_evidenced" instead`)
      // A quickFix is required below the maximum and forbidden at it. It completes
      // "To reach {max}: ...", which has nothing to say once the score IS the maximum.
      // Demanding one everywhere is what made the answer incoherent: the model was
      // required to name an improvement for a dimension it had just called perfect.
      if (a.score !== d.max && !a.quickFix)
        problems.push(`D${d.n} is scored below its maximum but has no quick fix`)
    }

    if (a.status !== 'scored' && !a.statusReason)
      problems.push(`D${d.n} is "${a.status}" but gives no reason`)

    if (!a.rationale?.trim()) problems.push(`D${d.n} has no rationale`)
  }

  for (const extra of answer.dimensions.filter((a) => !rubric.dimensions.some((d) => d.key === a.key)))
    problems.push(`answer contains unknown dimension "${extra.key}"`)

  for (const f of answer.capFindings) {
    if (!rubric.caps.some((c) => c.id === f.capId)) problems.push(`unknown cap "${f.capId}"`)
    checkLines(`cap ${f.capId} evidence`, f.evidence)
  }
  for (const c of rubric.caps)
    if (!answer.capFindings.some((f) => f.capId === c.id)) problems.push(`cap "${c.id}" was not judged`)

  checkLines('theOneThing evidence', answer.theOneThing?.evidence ?? [])
  answer.redFlags?.forEach((r, i) => checkLines(`redFlag ${i + 1} evidence`, r.evidence))

  if (!answer.brief?.trim()) problems.push('brief is empty')
  if (!answer.theOneThing?.change?.trim()) problems.push('theOneThing is empty')

  if (problems.length) throw new AnswerInvalid(`${problems.length} problem(s) in the model answer`, problems)
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/** Copy the verbatim line out of the transcript. The model's text is never used. */
function hydrate(t: NumberedTranscript, lines: number[]): Evidence[] {
  const byN = new Map(t.lines.map((l) => [l.n, l]))
  return [...new Set(lines)]
    .sort((a, b) => a - b)
    .flatMap((n) => {
      const l = byN.get(n)
      return l ? [{ line: l.n, speaker: l.speaker, text: l.text }] : []
    })
}

/**
 * Turn a validated answer into a report.
 *
 * Order matters and follows the rubric: dimension scores settle first, then dimension
 * caps bite, then the raw total is summed, then total caps bite, then the result is
 * normalised onto the report scale and banded.
 */
export function buildReport(answer: ModelAnswer, rubric: CompiledRubric, t: NumberedTranscript): Report {
  const capsById = new Map(rubric.caps.map((c) => [c.id, c]))
  const holding = answer.capFindings.filter((f) => f.holds)

  const applied: AppliedCap[] = []
  const dimensions: DimensionResult[] = []
  const ceilingAdjustments: ScoreTrace['ceilingAdjustments'] = []

  for (const d of rubric.dimensions) {
    const a = answer.dimensions.find((x) => x.key === d.key)!

    // An unevidenced dimension takes the rubric's conservative floor. This is the rule
    // the client's thin transcript is designed to test, so it is enforced here rather
    // than requested in the prompt.
    let raw: number | null =
      a.status === 'disabled' ? null : a.status === 'not_evidenced' ? floorScore(d) : a.score

    // The same rule at the other end of the scale. `quickFix` completes the sentence
    // "To reach {max}: ...", so a dimension sitting at its maximum WITH a quickFix is the
    // answer contradicting itself — it has named something that would have improved a
    // score it also called perfect. Measured on the client's own transcripts: the model
    // put eleven of twelve dimensions at maximum and wrote a real, specific improvement
    // under every one of them, while nominating one of those same improvements as the
    // single most important change in the call.
    //
    // Asking for it in the prompt moved the number but never closed the gap, so like the
    // floor rule above it is enforced here. That makes the contradiction unrepresentable
    // rather than merely detectable, which is the same reason evidence is line numbers
    // instead of quoted text.
    let ceilingAdjusted = false
    if (a.status === 'scored' && raw !== null && raw === d.max && a.quickFix?.trim()) {
      const lowered = oneBucketBelow(d, d.max)
      if (lowered !== d.max) {
        ceilingAdjustments.push({
          n: d.n,
          title: d.title,
          from: d.max,
          to: lowered,
          quickFix: a.quickFix.trim(),
        })
        raw = lowered
        ceilingAdjusted = true
      }
    }

    let score = raw
    let capped = false

    for (const f of holding) {
      const cap = capsById.get(f.capId)
      if (!cap || !('dimension' in cap.effect) || cap.effect.dimension !== d.n || score === null) continue

      const before = score
      score =
        cap.effect.type === 'dimension_fixed' ? cap.effect.value : Math.min(score, cap.effect.value)

      if (score !== before) {
        capped = true
        applied.push({
          capId: cap.id,
          condition: cap.condition,
          effect: cap.raw,
          change: `D${d.n} ${before} → ${score}`,
          nonRecoverable: cap.nonRecoverable,
          evidence: hydrate(t, f.evidence),
          reasoning: f.reasoning,
        })
      }
    }

    dimensions.push({
      n: d.n,
      key: d.key,
      title: d.title,
      max: d.max,
      status: a.status,
      score,
      rawScore: raw,
      bucketLabel: score === null ? null : labelFor(d, score),
      rationale: a.rationale,
      evidence: hydrate(t, a.evidence),
      quickFix: a.quickFix,
      statusReason: a.statusReason,
      capped,
      ceilingAdjusted,
    })
  }

  // The denominator is the sum of the ACTIVE dimensions' maxima. Disabled dimensions drop
  // out of both numerator and denominator, which is the rubric's own stated method for
  // its D4 case, generalised so it always holds.
  const excluded = dimensions
    .filter((d) => d.status === 'disabled')
    .map((d) => ({
      n: d.n,
      title: d.title,
      max: d.max,
      reason: d.statusReason ?? 'dimension disabled for this call',
    }))

  const denominator = rubric.dimensions
    .filter((d) => !excluded.some((e) => e.n === d.n))
    .reduce((a, d) => a + d.max, 0)

  const totalAfterDimensionCaps = dimensions.reduce((a, d) => a + (d.score ?? 0), 0)

  // Total caps are expressed on the rubric's stated 100-point scale, so compare against
  // the normalised figure rather than the raw sum.
  let normalisedRaw = (totalAfterDimensionCaps / denominator) * rubric.reportScale
  let totalCapApplied: ScoreTrace['totalCapApplied'] = null

  for (const f of holding) {
    const cap = capsById.get(f.capId)
    if (!cap || cap.effect.type !== 'total_max') continue
    if (normalisedRaw > cap.effect.value) {
      normalisedRaw = cap.effect.value
      totalCapApplied = { capId: cap.id, value: cap.effect.value }
      applied.push({
        capId: cap.id,
        condition: cap.condition,
        effect: cap.raw,
        change: `total → ≤ ${cap.effect.value}`,
        nonRecoverable: cap.nonRecoverable,
        evidence: hydrate(t, f.evidence),
        reasoning: f.reasoning,
      })
    }
  }

  const normalised = Math.round(normalisedRaw)
  const band =
    rubric.bands.find((b) => normalised >= b.min && normalised <= b.max) ??
    rubric.bands.reduce((lo, b) => (b.min < lo.min ? b : lo), rubric.bands[0])

  const trace: ScoreTrace = {
    rawTotal: totalAfterDimensionCaps,
    denominator,
    excluded,
    capsApplied: applied,
    ceilingAdjustments,
    totalAfterDimensionCaps,
    totalCapApplied,
    normalised,
    band: { name: band.name, description: band.description },
  }

  return {
    theOneThing: {
      change: answer.theOneThing.change,
      wouldScore: answer.theOneThing.wouldScore,
      evidence: hydrate(t, answer.theOneThing.evidence),
    },
    brief: answer.brief,
    redFlags: (answer.redFlags ?? []).map((r) => ({
      title: r.title,
      why: r.why,
      evidence: hydrate(t, r.evidence),
    })),
    dimensions,
    trace,
  }
}

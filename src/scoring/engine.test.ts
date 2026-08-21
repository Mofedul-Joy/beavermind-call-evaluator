/**
 * Tests for the deterministic half. No network, no model.
 *
 *   npm test
 *
 * These lock the behaviour both build agents depend on. If one of these fails, the
 * contract changed and the change comes back to the main session.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CompiledRubric } from '../rubric/types'
import type { ModelAnswer, ModelDimensionAnswer, RationalePoint } from './types'
import { AnswerInvalid, allowedScores, buildReport, numberTranscript, renderForModel, validateAnswer } from './engine'

const load = (id: 'coaching' | 'kickoff'): CompiledRubric =>
  JSON.parse(readFileSync(join(import.meta.dirname, '..', 'rubric', 'compiled', `${id}.json`), 'utf8'))

const coaching = load('coaching')
const kickoff = load('kickoff')

const TRANSCRIPT = `[Priya Raman]: Hey Malik, can you hear me okay?
[Malik Osei]: Yeah, I got you.

[Priya Raman]: How's the knee feeling today, honestly?
[Malik Osei]: A little achy.
[Priya Raman]: Okay. Let's book you in for the eleventh at three.`

/** A complete, valid answer. Individual tests mutate a clone of it. */
function baseAnswer(rubric: CompiledRubric, score: 'top' | 'floor' = 'top'): ModelAnswer {
  return {
    theOneThing: { change: 'Connect the block to his 12-month vision.', wouldScore: 80, evidence: [3] },
    brief: 'Technically solid, emotionally thin.',
    redFlags: [{ title: 'No vision tie', why: 'Retention risk.', evidence: [3] }],
    dimensions: rubric.dimensions.map<ModelDimensionAnswer>((d) => {
      const allowed = allowedScores(d)
      const value = score === 'top' ? Math.max(...allowed) : Math.min(...allowed)
      return {
        key: d.key,
        status: 'scored',
        score: value,
        rationale: `Scored because of the check-in.`,
        evidence: [1],
        // Empty at the maximum. A quickFix names something that would have improved the
        // dimension, so writing one under a maximum contradicts the score, and the engine
        // resolves that toward the criticism. See the ceiling tests below.
        quickFix: value === d.max ? '' : `To reach ${d.max}: do the thing.`,
      }
    }),
    capFindings: rubric.caps.map((c) => ({ capId: c.id, holds: false, evidence: [], reasoning: 'Not present.' })),
  }
}

describe('numberTranscript', () => {
  const t = numberTranscript(TRANSCRIPT)

  test('numbers non-blank turns from 1 and drops blanks', () => {
    assert.equal(t.lines.length, 5)
    assert.equal(t.lines[0].n, 1)
    assert.equal(t.lines[4].n, 5)
  })

  test('extracts speakers in order of first appearance', () => {
    assert.deepEqual(t.speakers, ['Priya Raman', 'Malik Osei'])
  })

  test('separates speaker from text', () => {
    assert.equal(t.lines[2].speaker, 'Priya Raman')
    assert.equal(t.lines[2].text, "How's the knee feeling today, honestly?")
  })

  test('renders zero-padded line numbers for the model', () => {
    assert.match(renderForModel(t).split('\n')[0], /^L1 \[Priya Raman\]: Hey Malik/)
  })

  test('a line that does not match the turn format keeps its number', () => {
    const odd = numberTranscript('[A]: one\nstray continuation\n[B]: two')
    assert.deepEqual(odd.lines.map((l) => l.n), [1, 2, 3])
    assert.equal(odd.lines[1].speaker, 'A', 'unmatched line inherits the previous speaker')
  })
})

describe('allowedScores', () => {
  test('discrete dimensions allow exactly their bucket values', () => {
    const d1 = coaching.dimensions[0]
    assert.deepEqual(allowedScores(d1), [0, 3, 7, 10])
  })

  test('band dimensions allow every integer inside their bands', () => {
    const d = kickoff.dimensions.find((x) => x.scoring.mode === 'band' && x.max === 10)!
    const scores = allowedScores(d)
    assert.ok(scores.includes(7), 'an integer inside the Strong band')
    assert.equal(Math.max(...scores), d.max)
    assert.ok(scores.includes(0))
  })

  test('band dimensions with max <= 5 allow half steps', () => {
    const d = kickoff.dimensions.find((x) => x.scoring.mode === 'band' && x.max === 5)!
    assert.ok(allowedScores(d).includes(4.5), 'the rubric prints a 4.5–5 band')
  })
})

describe('validateAnswer', () => {
  const t = numberTranscript(TRANSCRIPT)

  test('accepts a complete answer', () => {
    assert.doesNotThrow(() => validateAnswer(baseAnswer(coaching), coaching, t))
  })

  test('rejects an evidence line outside the transcript', () => {
    const a = baseAnswer(coaching)
    a.dimensions[0].evidence = [999]
    assert.throws(() => validateAnswer(a, coaching, t), (e: AnswerInvalid) => {
      assert.ok(e.problems.some((p) => p.includes('999') && p.includes('outside the transcript')))
      return true
    })
  })

  test('rejects a score not in the dimension\'s buckets', () => {
    const a = baseAnswer(coaching)
    a.dimensions[0].score = 8 // D1 allows 0, 3, 7, 10 only
    assert.throws(() => validateAnswer(a, coaching, t), (e: AnswerInvalid) => {
      assert.ok(e.problems.some((p) => p.includes('scored 8')))
      return true
    })
  })

  test('rejects a scored dimension with no evidence', () => {
    const a = baseAnswer(coaching)
    a.dimensions[0].evidence = []
    assert.throws(() => validateAnswer(a, coaching, t), (e: AnswerInvalid) => {
      assert.ok(e.problems.some((p) => p.includes('cites no evidence')))
      return true
    })
  })

  test('rejects a missing dimension', () => {
    const a = baseAnswer(coaching)
    a.dimensions.splice(3, 1)
    assert.throws(() => validateAnswer(a, coaching, t), (e: AnswerInvalid) =>
      e.problems.some((p) => p.includes('is missing from the answer')))
  })

  test('rejects an unjudged cap', () => {
    const a = baseAnswer(coaching)
    a.capFindings.pop()
    assert.throws(() => validateAnswer(a, coaching, t), (e: AnswerInvalid) =>
      e.problems.some((p) => p.includes('was not judged')))
  })

  test('rejects disabling a non-optional dimension', () => {
    const a = baseAnswer(coaching)
    a.dimensions[0].status = 'disabled'
    a.dimensions[0].score = null
    a.dimensions[0].statusReason = 'nope'
    assert.throws(() => validateAnswer(a, coaching, t), (e: AnswerInvalid) =>
      e.problems.some((p) => p.includes('not an optional dimension')))
  })

  test('reports every problem at once, so the retry can name them all', () => {
    const a = baseAnswer(coaching)
    a.dimensions[0].evidence = [999]
    a.dimensions[1].score = 8
    a.brief = ''
    try {
      validateAnswer(a, coaching, t)
      assert.fail('should have thrown')
    } catch (e) {
      assert.ok((e as AnswerInvalid).problems.length >= 3)
    }
  })
})

describe('buildReport', () => {
  const t = numberTranscript(TRANSCRIPT)

  test('evidence text comes from the transcript, never from the model', () => {
    const r = buildReport(baseAnswer(coaching), coaching, t)
    assert.equal(r.dimensions[0].evidence[0].text, 'Hey Malik, can you hear me okay?')
    assert.equal(r.dimensions[0].evidence[0].speaker, 'Priya Raman')
  })

  test('a perfect coaching call normalises to 100', () => {
    const r = buildReport(baseAnswer(coaching, 'top'), coaching, t)
    assert.equal(r.trace.rawTotal, 105, 'the printed maxima sum to 105, not 100')
    assert.equal(r.trace.denominator, 105)
    assert.equal(r.trace.normalised, 100, 'normalised onto the report scale')
    assert.equal(r.trace.band.name, 'ELITE')
  })

  test('kickoff needs no normalisation because its maxima already sum to 100', () => {
    const r = buildReport(baseAnswer(kickoff, 'top'), kickoff, t)
    assert.equal(r.trace.denominator, 100)
    assert.equal(r.trace.normalised, 100)
  })

  test('not_evidenced forces the dimension to its conservative floor', () => {
    const a = baseAnswer(coaching, 'top')
    a.dimensions[0].status = 'not_evidenced'
    a.dimensions[0].score = 10 // the model tries to keep a high score anyway
    a.dimensions[0].evidence = []
    a.dimensions[0].statusReason = 'No check-in appears in the transcript.'

    const r = buildReport(a, coaching, t)
    assert.equal(r.dimensions[0].score, 0, 'the engine overrides the model, not the prompt')
  })

  test('a dimension_fixed cap zeroes its dimension', () => {
    const cap = coaching.caps.find((c) => c.effect.type === 'dimension_fixed')!
    const dim = (cap.effect as { dimension: number }).dimension
    const a = baseAnswer(coaching, 'top')
    a.capFindings = a.capFindings.map((f) => (f.capId === cap.id ? { ...f, holds: true, evidence: [5] } : f))

    const r = buildReport(a, coaching, t)
    const capped = r.dimensions.find((d) => d.n === dim)!
    assert.equal(capped.score, 0)
    assert.equal(capped.capped, true)
    assert.ok(r.trace.capsApplied.some((c) => c.capId === cap.id))
    assert.match(r.trace.capsApplied.find((c) => c.capId === cap.id)!.change, /→ 0$/)
  })

  test('a dimension_max cap lowers but does not zero its dimension', () => {
    const cap = coaching.caps.find((c) => c.effect.type === 'dimension_max')!
    const eff = cap.effect as { dimension: number; value: number }
    const a = baseAnswer(coaching, 'top')
    a.capFindings = a.capFindings.map((f) => (f.capId === cap.id ? { ...f, holds: true, evidence: [3] } : f))

    const r = buildReport(a, coaching, t)
    assert.equal(r.dimensions.find((d) => d.n === eff.dimension)!.score, eff.value)
  })

  test('a total cap binds on the normalised figure', () => {
    const cap = coaching.caps.find((c) => c.effect.type === 'total_max')!
    const value = (cap.effect as { value: number }).value
    const a = baseAnswer(coaching, 'top')
    a.capFindings = a.capFindings.map((f) => (f.capId === cap.id ? { ...f, holds: true, evidence: [1] } : f))

    const r = buildReport(a, coaching, t)
    assert.equal(r.trace.normalised, value)
    assert.equal(r.trace.totalCapApplied?.value, value)
  })

  test('a cap that would not lower the score is not recorded as applied', () => {
    const cap = coaching.caps.find((c) => c.effect.type === 'total_max')!
    const a = baseAnswer(coaching, 'floor') // everything already at its floor
    a.capFindings = a.capFindings.map((f) => (f.capId === cap.id ? { ...f, holds: true, evidence: [1] } : f))

    const r = buildReport(a, coaching, t)
    assert.equal(r.trace.totalCapApplied, null, 'the cap did not bite, so it is not in the trace')
  })

  test('disabling D4 drops it from BOTH numerator and denominator', () => {
    const d4 = coaching.dimensions.find((d) => d.optional)!
    const a = baseAnswer(coaching, 'top')
    const entry = a.dimensions.find((x) => x.key === d4.key)!
    entry.status = 'disabled'
    entry.score = null
    entry.quickFix = null
    entry.evidence = []
    entry.statusReason = 'No movement coaching on this call.'

    const r = buildReport(a, coaching, t)
    assert.equal(r.trace.denominator, 105 - d4.max, 'denominator is 90, not the stated 85')
    assert.equal(r.trace.excluded[0].n, d4.n)
    assert.equal(r.trace.normalised, 100, 'a perfect call is still 100 with D4 off')
  })

  test('a maximum with a quickFix under it is lowered one bucket', () => {
    // The model repeatedly did this on the client's own transcripts: full marks, and a
    // real, specific improvement written underneath. The engine resolves the
    // contradiction toward the criticism rather than the flattering score.
    const a = baseAnswer(coaching, 'top')
    const d1 = coaching.dimensions[0] // discrete: 0, 3, 7, 10
    a.dimensions[0].quickFix = 'To reach 10: name the muscle group earlier.'

    const r = buildReport(a, coaching, t)
    assert.equal(r.dimensions[0].score, 7, 'dropped to the next bucket its own table allows')
    assert.equal(r.dimensions[0].ceilingAdjusted, true)
    assert.equal(r.trace.ceilingAdjustments.length, 1)
    assert.deepEqual(
      { n: r.trace.ceilingAdjustments[0].n, from: r.trace.ceilingAdjustments[0].from, to: r.trace.ceilingAdjustments[0].to },
      { n: d1.n, from: 10, to: 7 },
      'the trace records it rather than quietly showing a different number',
    )
  })

  test('a maximum with no quickFix stands', () => {
    const r = buildReport(baseAnswer(coaching, 'top'), coaching, t)
    assert.equal(r.trace.ceilingAdjustments.length, 0)
    assert.equal(r.trace.normalised, 100, 'a genuinely flawless call is still allowed to be flawless')
  })

  test('a whitespace-only quickFix is not a criticism', () => {
    const a = baseAnswer(coaching, 'top')
    a.dimensions[0].quickFix = '   '
    assert.equal(buildReport(a, coaching, t).dimensions[0].score, coaching.dimensions[0].max)
  })

  test('a quickFix below the maximum changes nothing', () => {
    const a = baseAnswer(coaching, 'floor')
    a.dimensions[0].quickFix = 'To reach 10: do the thing.'
    const r = buildReport(a, coaching, t)
    assert.equal(r.dimensions[0].ceilingAdjusted, false)
    assert.equal(r.trace.ceilingAdjustments.length, 0)
  })

  test('the same answer always produces the same report', () => {
    const a = baseAnswer(coaching, 'top')
    const first = JSON.stringify(buildReport(a, coaching, t))
    const second = JSON.stringify(buildReport(a, coaching, t))
    assert.equal(first, second)
  })

  test('a floored call lands in the bottom band', () => {
    const r = buildReport(baseAnswer(coaching, 'floor'), coaching, t)
    assert.equal(r.trace.normalised, 0)
    assert.equal(r.trace.band.name, 'FAIL')
  })
})

describe('rationale points', () => {
  const t = numberTranscript(TRANSCRIPT)

  const twoPoints: RationalePoint[] = [
    { title: 'Opens with a check-in', body: 'Asks how the knee feels before anything else (L3).' },
    { title: 'No live movement occurred', body: 'Nothing in the call shows a correction being coached (L5).' },
  ]

  test('a well-formed set of points survives onto the report', () => {
    const a = baseAnswer(coaching, 'top')
    a.dimensions[0].points = twoPoints
    const r = buildReport(a, coaching, t)
    assert.deepEqual(r.dimensions[0].points, twoPoints)
  })

  test('a single point is dropped, so the rationale paragraph still renders', () => {
    const a = baseAnswer(coaching, 'top')
    a.dimensions[0].points = [twoPoints[0]]
    assert.equal(buildReport(a, coaching, t).dimensions[0].points, undefined)
  })

  test('points with an empty title or body are filtered out', () => {
    const a = baseAnswer(coaching, 'top')
    a.dimensions[0].points = [...twoPoints, { title: '  ', body: 'Orphaned body.' }, { title: 'Orphaned title', body: '' }]
    const r = buildReport(a, coaching, t)
    assert.deepEqual(r.dimensions[0].points, twoPoints, 'only the two complete beats survive')
  })

  test('filtering below two points drops the array entirely', () => {
    const a = baseAnswer(coaching, 'top')
    a.dimensions[0].points = [twoPoints[0], { title: 'Orphaned title', body: '   ' }]
    assert.equal(buildReport(a, coaching, t).dimensions[0].points, undefined)
  })

  test('titles and bodies are trimmed', () => {
    const a = baseAnswer(coaching, 'top')
    a.dimensions[0].points = twoPoints.map((p) => ({ title: `  ${p.title} `, body: `\t${p.body}  ` }))
    assert.deepEqual(buildReport(a, coaching, t).dimensions[0].points, twoPoints)
  })

  test('points are dropped on a not_evidenced dimension', () => {
    const a = baseAnswer(coaching, 'top')
    a.dimensions[0].status = 'not_evidenced'
    a.dimensions[0].evidence = []
    a.dimensions[0].statusReason = 'No check-in appears in the transcript.'
    a.dimensions[0].points = twoPoints
    assert.equal(buildReport(a, coaching, t).dimensions[0].points, undefined, 'nothing was scored to break into beats')
  })

  test('an answer with no points at all still builds — old jsonb rows have none', () => {
    assert.equal(buildReport(baseAnswer(coaching, 'top'), coaching, t).dimensions[0].points, undefined)
  })
})

describe('theOneThing.detail', () => {
  const t = numberTranscript(TRANSCRIPT)

  test('detail is carried through, trimmed', () => {
    const a = baseAnswer(coaching, 'top')
    a.theOneThing.detail = '  He named the block but never tied it to the 12-month goal (L3).  '
    assert.equal(
      buildReport(a, coaching, t).theOneThing.detail,
      'He named the block but never tied it to the 12-month goal (L3).',
    )
  })

  test('a whitespace-only detail becomes undefined rather than an empty paragraph', () => {
    const a = baseAnswer(coaching, 'top')
    a.theOneThing.detail = '   '
    assert.equal(buildReport(a, coaching, t).theOneThing.detail, undefined)
  })

  test('an answer with no detail still builds', () => {
    assert.equal(buildReport(baseAnswer(coaching, 'top'), coaching, t).theOneThing.detail, undefined)
  })
})

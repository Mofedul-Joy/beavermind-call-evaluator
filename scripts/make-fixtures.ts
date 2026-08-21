/**
 * Generates `src/fixtures/runs.json` — realistic Run objects with no API key required.
 *
 * The frontend agent builds every screen against these, so the UI can be finished and
 * reviewed before the model integration lands. They are produced by the real engine from
 * hand-written model answers, so they are structurally identical to production data.
 *
 * Four runs, chosen to cover the states that actually need designing:
 *   1. done   — a thin call, several dimensions not evidenced, a cap biting   (the trap)
 *   2. done   — a good call, everything evidenced
 *   3. running
 *   4. failed
 *
 *   npm run fixtures
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CompiledRubric } from '../src/rubric/types'
import type { ModelAnswer, Run } from '../src/scoring/types'
import { allowedScores, buildReport, numberTranscript } from '../src/scoring/engine'

const ROOT = join(import.meta.dirname, '..')
const rubric = (id: 'coaching' | 'kickoff'): CompiledRubric =>
  JSON.parse(readFileSync(join(ROOT, 'src/rubric/compiled', `${id}.json`), 'utf8'))

const transcript = (name: string) => readFileSync(join(ROOT, 'transcripts', `${name}.txt`), 'utf8')

/** Deterministic ids so fixtures diff cleanly between runs of this script. */
const ID = {
  thin: '9f3a7c21-0000-4000-8000-000000000001',
  good: '9f3a7c21-0000-4000-8000-000000000002',
  running: '9f3a7c21-0000-4000-8000-000000000003',
  failed: '9f3a7c21-0000-4000-8000-000000000004',
}

/**
 * Build a plausible answer.
 *
 * `profile` picks how well the call went; `notEvidenced` names dimensions the transcript
 * simply does not cover, and `capsHolding` names caps that bite.
 */
function answerFor(
  r: CompiledRubric,
  opts: {
    profile: 'thin' | 'good'
    notEvidenced?: number[]
    capsHolding?: string[]
    /** Force specific dimensions to a chosen score, so a fixture can exercise a cap. */
    scores?: Record<number, number>
  },
): ModelAnswer {
  const { profile, notEvidenced = [], capsHolding = [], scores = {} } = opts

  return {
    theOneThing:
      profile === 'thin'
        ? {
            change:
              'Ask why the goal matters before explaining the programme, and build a North Star statement she confirms out loud.',
            wouldScore: 71,
            evidence: [18, 24],
          }
        : {
            change:
              "Connect every current block to the client's named 12-month vision and get him to articulate why the outcome matters.",
            wouldScore: 84,
            evidence: [12, 41],
          },
    brief:
      profile === 'thin'
        ? 'The mechanics were covered and the next steps were clear, but the call stayed transactional. Renata answered in single words for most of it and was never asked why any of this matters to her. She leaves knowing what to do and not why she is doing it.'
        : 'Technically attentive and strong on adapting the plan when the client got worried, but the coaching was aimed at the exercises rather than the journey. He left relieved and re-booked, without the long-term belief that makes a client stay.',
    redFlags:
      profile === 'thin'
        ? [
            {
              title: 'No emotional driver was ever surfaced',
              why: 'Nothing anchors her to the programme when the first hard week arrives. This is the profile that quietly cancels in month two.',
              evidence: [18],
            },
          ]
        : [
            {
              title: 'No connection to long-term vision at any point',
              why: 'The work is being coached, not the outcome. A client who cannot see where this leads re-evaluates at renewal.',
              evidence: [41],
            },
          ],
    dimensions: r.dimensions.map((d) => {
      const allowed = allowedScores(d)
      if (notEvidenced.includes(d.n)) {
        return {
          key: d.key,
          status: 'not_evidenced' as const,
          score: null,
          rationale: `Not scored: nothing in this transcript speaks to ${d.title.toLowerCase()}. The rubric requires scoring conservatively rather than inferring the behaviour.`,
          evidence: [],
          quickFix: null,
          statusReason: `No transcript line covers ${d.title.toLowerCase()}.`,
        }
      }
      // thin → lower third of the scale; good → upper third.
      const idx =
        profile === 'thin'
          ? Math.floor(allowed.length * 0.35)
          : Math.floor(allowed.length * 0.72)
      const score = scores[d.n] ?? allowed[Math.min(allowed.length - 1, Math.max(0, idx))]
      return {
        key: d.key,
        status: 'scored' as const,
        score,
        rationale: `Scored ${score}/${d.max} because ${d.whatToLookFor.replace(/^Does /, 'the coach ').replace(/\?$/, '').toLowerCase()} — partially, and without tying it back to what the client said they wanted.`,
        evidence: profile === 'thin' ? [6, 18, 24] : [12, 27, 41],
        // Empty at the maximum: quickFix completes "To reach {max}: ...", which has
        // nothing to say once the score is the maximum. The engine enforces this.
        quickFix:
          score === d.max
            ? ''
            : `To reach ${d.max}: ${d.positiveSignals[0] ?? 'cover the behaviour explicitly and confirm the client heard it'}.`,
      }
    }),
    capFindings: r.caps.map((c) => ({
      capId: c.id,
      holds: capsHolding.includes(c.id),
      evidence: capsHolding.includes(c.id) ? [24] : [],
      reasoning: capsHolding.includes(c.id)
        ? 'The condition holds — see the cited line.'
        : 'The condition does not hold on this call.',
    })),
  }
}

function makeRun(args: {
  id: string
  callType: 'coaching' | 'kickoff'
  transcriptName: string
  coach: string
  client: string
  profile: 'thin' | 'good'
  notEvidenced?: number[]
  capsHolding?: string[]
  scores?: Record<number, number>
}): Run {
  const r = rubric(args.callType)
  const t = numberTranscript(transcript(args.transcriptName))
  const answer = answerFor(r, {
    profile: args.profile,
    notEvidenced: args.notEvidenced,
    capsHolding: args.capsHolding,
    scores: args.scores,
  })
  const report = buildReport(answer, r, t)

  const inputTokens = Math.round(t.charCount / 3.7)
  const outputTokens = 2600
  const cachedInputTokens = 4000

  return {
    id: args.id,
    callType: args.callType,
    status: 'done',
    coachName: args.coach,
    clientName: args.client,
    rubricHash: r.sourceHash,
    transcript: t,
    report,
    error: null,
    cost: {
      inputTokens,
      cachedInputTokens,
      outputTokens,
      thinkingTokens: null,
      usd:
        Number(
          (
            (inputTokens / 1e6) * 2 +
            (cachedInputTokens / 1e6) * 0.2 +
            (outputTokens / 1e6) * 10
          ).toFixed(4),
        ),
      model: 'claude-sonnet-5',
    },
    isSample: true,
    createdAt: '2026-08-21T12:04:00.000Z',
    startedAt: '2026-08-21T12:04:01.000Z',
    finishedAt: '2026-08-21T12:05:12.000Z',
  }
}

const coachingRubric = rubric('coaching')
const kickoffRubric = rubric('kickoff')

// The cap that fires on the thin kickoff call: no North Star statement constructed.
const northStarCap = kickoffRubric.caps.find((c) => /north star/i.test(c.condition))?.id
// The one that fires on the good-but-visionless coaching call.
const visionCap = coachingRubric.caps.find((c) => /long-term vision/i.test(c.condition))?.id

const runs: Run[] = [
  makeRun({
    id: ID.thin,
    callType: 'kickoff',
    transcriptName: 'kickoff-02',
    coach: 'Ivan Petrov',
    client: 'Renata Cruz',
    profile: 'thin',
    // The behaviours this call genuinely never exhibits.
    notEvidenced: [4, 6, 8],
    capsHolding: northStarCap ? [northStarCap] : [],
  }),
  makeRun({
    id: ID.good,
    callType: 'coaching',
    transcriptName: 'coaching-02',
    coach: 'Marcus Reid',
    client: 'Hannah Vogel',
    profile: 'good',
    // D3 earns full marks on its own, so the vision cap visibly knocks it 15 → 10.
    // The UI needs a genuinely capped dimension to render.
    scores: { 3: 15 },
    capsHolding: visionCap ? [visionCap] : [],
  }),
]

const running: Run = {
  ...runs[1],
  id: ID.running,
  status: 'running',
  coachName: 'Dana Whitlock',
  clientName: 'Owen Brandt',
  callType: 'kickoff',
  report: null,
  cost: null,
  isSample: false,
  startedAt: new Date(Date.parse('2026-08-21T12:09:00.000Z')).toISOString(),
  finishedAt: null,
}

const failed: Run = {
  ...runs[0],
  id: ID.failed,
  status: 'failed',
  coachName: 'Priya Raman',
  clientName: 'Malik Osei',
  callType: 'coaching',
  report: null,
  cost: null,
  isSample: false,
  error: {
    code: 'invalid_evidence',
    message:
      'The scorer cited transcript lines that do not exist, twice. Nothing was saved rather than show you evidence we could not verify.',
    detail: 'D3 evidence: line 812 is outside the transcript (1–345); D7 evidence: line 999 is outside the transcript (1–345)',
    at: '2026-08-21T12:11:40.000Z',
  },
  finishedAt: '2026-08-21T12:11:40.000Z',
}

const all = [...runs, running, failed]

mkdirSync(join(ROOT, 'src/fixtures'), { recursive: true })
writeFileSync(join(ROOT, 'src/fixtures/runs.json'), JSON.stringify(all, null, 2))

for (const r of all) {
  const n = r.report?.trace
  console.log(
    `✓ ${r.status.padEnd(7)} ${r.callType.padEnd(8)} ${(r.clientName ?? '').padEnd(14)} ` +
      (n
        ? `${n.normalised}/100 ${n.band.name.padEnd(12)} raw ${n.rawTotal}/${n.denominator} · ` +
          `${n.capsApplied.length} cap(s) · ` +
          `${r.report!.dimensions.filter((d) => d.status === 'not_evidenced').length} not evidenced · ` +
          `$${r.cost!.usd}`
        : `— ${r.error?.code ?? ''}`),
  )
}

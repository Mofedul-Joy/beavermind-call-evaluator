/**
 * Re-scores the sample transcripts against the live API and prints what actually matters
 * for calibration: the score, how many dimensions sat at their maximum, how many were not
 * evidenced, how many the engine took off maximum, and the real token split.
 *
 * This exists because scoring quality cannot be eyeballed from the code. The defect it
 * caught — the contract requiring a quickFix on a dimension scored at its own maximum, so
 * the answer was forced to contradict itself — was invisible in review and obvious in one
 * line of this output.
 *
 *   npx tsx scripts/calibrate.ts
 *   ANTHROPIC_EFFORT=medium npx tsx scripts/calibrate.ts   # compare a cheaper budget
 */
process.loadEnvFile('.env.local')
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scoreTranscript } from '../src/lib/anthropic'
import { buildReport, numberTranscript } from '../src/scoring/engine'
import { RUBRICS } from '../src/server/runs'
import type { CallType } from '../src/scoring/types'

const ROOT = join(import.meta.dirname, '..')
const targets: { file: string; callType: CallType }[] = [
  { file: 'coaching-01.txt', callType: 'coaching' },
  { file: 'kickoff-01.txt', callType: 'kickoff' },
  { file: 'kickoff-02.txt', callType: 'kickoff' },
]

async function main() {
for (const { file, callType } of targets) {
  const rubric = RUBRICS[callType]
  const t = numberTranscript(readFileSync(join(ROOT, 'transcripts', file), 'utf8'))
  const { answer, cost } = await scoreTranscript(rubric, t)
  const r = buildReport(answer, rubric, t)
  const atMax = r.dimensions.filter((d) => d.score !== null && d.score === d.max).length
  const ne = r.dimensions.filter((d) => d.status === 'not_evidenced').length
  const adj = r.trace.ceilingAdjustments.length
  console.log(
    `${file.padEnd(16)} ${String(r.trace.normalised).padStart(5)}/100 ${r.trace.band.name.padEnd(12)} ` +
      `at-max ${atMax}/12  not_ev ${ne}  ceiling-adj ${adj}  $${cost.usd.toFixed(4)} ` +
      `(in ${cost.inputTokens} cached ${cost.cachedInputTokens} out ${cost.outputTokens} ` +
      `thinking ${cost.thinkingTokens ?? '?'})`,
  )
  console.log('   scores: ' + r.dimensions.map((d) => `${d.n}:${d.score ?? '—'}/${d.max}`).join(' '))
  console.log('   theOneThing: ' + r.theOneThing.change.slice(0, 130))
}
}

main().catch((e)=>{console.error(e);process.exit(1)})

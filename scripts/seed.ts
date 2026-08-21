/**
 * Scores the four sample transcripts for real against the live API and inserts them as
 * `is_sample = true` runs, so the app has something to show on first load.
 *
 * Order matters: processed sequentially (not in parallel) so each insert's `created_at` is
 * strictly later than the last, and kickoff-02 is scored last so it sits newest — at the
 * top of the list.
 *
 *   npx tsx scripts/seed.ts
 */
process.loadEnvFile('.env.local')
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scoreTranscript } from '../src/lib/anthropic'
import { supabaseAdmin } from '../src/lib/supabase'
import { buildReport, numberTranscript } from '../src/scoring/engine'
import { RUBRICS } from '../src/server/runs'
import type { CallType } from '../src/scoring/types'

const ROOT = join(import.meta.dirname, '..')

const FILES: { file: string; callType: CallType }[] = [
  { file: 'coaching-01.txt', callType: 'coaching' },
  { file: 'coaching-02.txt', callType: 'coaching' },
  { file: 'kickoff-01.txt', callType: 'kickoff' },
  { file: 'kickoff-02.txt', callType: 'kickoff' }, // last — must be newest
]

async function main() {
  const db = supabaseAdmin()

  for (const { file, callType } of FILES) {
    const raw = readFileSync(join(ROOT, 'transcripts', file), 'utf8')
    const rubric = RUBRICS[callType]
    const transcript = numberTranscript(raw)

    console.log(`scoring ${file} (${callType})…`)
    const { answer, cost } = await scoreTranscript(rubric, transcript)
    const report = buildReport(answer, rubric, transcript)

    const { data, error } = await db
      .from('runs')
      .insert({
        call_type: callType,
        status: 'done',
        rubric_hash: rubric.sourceHash,
        transcript,
        report,
        cost,
        is_sample: true,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw error

    console.log(
      `  id=${(data as { id: string }).id} score=${report.trace.normalised} band=${report.trace.band.name} cost=$${cost.usd.toFixed(4)}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

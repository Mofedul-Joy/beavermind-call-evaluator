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

  // Idempotent: clear the previous samples first. Without this, re-seeding after an engine
  // change leaves the old scores sitting in the list next to the new ones, which is worse
  // than either — two runs of the same call showing different numbers with nothing saying
  // why. Only `is_sample` rows are touched; real runs are never deleted.
  const { error: clearError, count } = await db
    .from('runs')
    .delete({ count: 'exact' })
    .eq('is_sample', true)
  if (clearError) throw clearError
  console.log(`cleared ${count ?? 0} previous sample run(s)`)

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
        // Derived, not hardcoded. In all four transcripts the coach speaks first — they
        // open the call — so speaker order gives the labels without a lookup table that
        // would silently rot if the samples were ever swapped. Without these the list
        // showed four rows reading "Untitled", which is the first thing anyone sees.
        coach_name: transcript.speakers[0] ?? null,
        client_name: transcript.speakers[1] ?? null,
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

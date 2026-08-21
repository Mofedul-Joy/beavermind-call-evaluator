/**
 * Run lifecycle: create a run (rate-limited, returns immediately), score it in the
 * background, and read it back. The route handlers in `src/app/api/runs/**` are thin
 * wrappers around this file.
 */
import Anthropic from '@anthropic-ai/sdk'
import coachingRubric from '../rubric/compiled/coaching.json'
import kickoffRubric from '../rubric/compiled/kickoff.json'
import type { CompiledRubric } from '../rubric/types'
import { AnswerInvalid, buildReport, numberTranscript } from '../scoring/engine'
import type { CallType, NumberedTranscript, Run, RunError, RunSummary } from '../scoring/types'
import { ModelRefused, ModelTruncated, scoreTranscript } from '../lib/anthropic'
import { supabaseAdmin } from '../lib/supabase'

export const RUBRICS: Record<CallType, CompiledRubric> = {
  coaching: coachingRubric as unknown as CompiledRubric,
  kickoff: kickoffRubric as unknown as CompiledRubric,
}

export const MAX_TRANSCRIPT_CHARS = 80_000

export class TranscriptTooLong extends Error {}

export type CreateRunInput = {
  transcript: string
  callType: CallType
  coachName?: string | null
  clientName?: string | null
  clientIp: string
}

export type CreateRunResult =
  | { ok: true; id: string }
  | { ok: false; code: 'rate_limited' | 'daily_cap_reached'; retryAfter: number }

export async function createRun(input: CreateRunInput): Promise<CreateRunResult> {
  if (input.transcript.length > MAX_TRANSCRIPT_CHARS) throw new TranscriptTooLong()

  const db = supabaseAdmin()

  const { data: slotRows, error: slotErr } = await db.rpc('claim_run_slot', { p_ip: input.clientIp })
  if (slotErr) throw slotErr
  const slot = (slotRows as { allowed: boolean; reason: string | null; retry_after: number }[])[0]
  if (!slot.allowed)
    return { ok: false, code: slot.reason as 'rate_limited' | 'daily_cap_reached', retryAfter: slot.retry_after }

  const rubric = RUBRICS[input.callType]
  const transcript = numberTranscript(input.transcript)

  const { data: row, error: insertErr } = await db
    .from('runs')
    .insert({
      call_type: input.callType,
      status: 'queued',
      coach_name: input.coachName ?? null,
      client_name: input.clientName ?? null,
      rubric_hash: rubric.sourceHash,
      transcript,
      client_ip: input.clientIp,
    })
    .select('id')
    .single()
  if (insertErr) throw insertErr

  return { ok: true, id: (row as { id: string }).id }
}

/** Run the model call and write the result. Called from `after()` — no retries if killed. */
export async function runScoring(id: string): Promise<void> {
  const db = supabaseAdmin()

  const { data: row, error } = await db.from('runs').select('call_type, transcript').eq('id', id).single()
  if (error || !row) return

  await db.from('runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', id)

  const rubric = RUBRICS[(row as { call_type: CallType }).call_type]
  const transcript = (row as { transcript: NumberedTranscript }).transcript

  try {
    const { answer, cost } = await scoreTranscript(rubric, transcript)
    const report = buildReport(answer, rubric, transcript)
    await db
      .from('runs')
      .update({ status: 'done', report, cost, finished_at: new Date().toISOString() })
      .eq('id', id)
  } catch (err) {
    await db
      .from('runs')
      .update({ status: 'failed', error: toRunError(err), finished_at: new Date().toISOString() })
      .eq('id', id)
  }
}

/** Every problem `validateAnswer` can raise names either a bad evidence line or a shape
 *  defect. If every surviving problem is evidence-shaped, call it `invalid_evidence`;
 *  otherwise the answer itself was malformed, which is `schema_violation`. */
function classifyInvalid(problems: string[]): RunError['code'] {
  const evidenceShaped = /evidence|outside the transcript/i
  return problems.every((p) => evidenceShaped.test(p)) ? 'invalid_evidence' : 'schema_violation'
}

function toRunError(err: unknown): RunError {
  const at = new Date().toISOString()

  if (err instanceof ModelRefused)
    return {
      code: 'model_refused',
      message: 'The model declined to score this call. Start the run again — if it keeps happening, something in the transcript is triggering a safety refusal.',
      detail: err.message,
      at,
    }

  if (err instanceof ModelTruncated)
    return {
      code: 'model_error',
      message: 'The model ran out of room before it finished scoring. This is usually transient — start the run again.',
      detail: err.message,
      at,
    }

  if (err instanceof AnswerInvalid) {
    const code = classifyInvalid(err.problems)
    return {
      code,
      message:
        code === 'invalid_evidence'
          ? 'The model cited evidence that did not hold up against the transcript, twice in a row. Start the run again.'
          : "The model's answer did not match the expected shape, twice in a row. Start the run again.",
      detail: err.problems.join('; '),
      at,
    }
  }

  if (err instanceof Anthropic.APIError)
    return {
      code: 'model_error',
      message: 'The scoring model returned an error. Start the run again in a moment.',
      detail: `${err.status}: ${err.message}`,
      at,
    }

  return {
    code: 'unknown',
    message: 'Something unexpected went wrong while scoring this call. Start the run again.',
    detail: err instanceof Error ? err.message : String(err),
    at,
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

const RUN_COLUMNS =
  'id, call_type, status, coach_name, client_name, rubric_hash, transcript, report, error, cost, is_sample, created_at, started_at, finished_at'

function rowToRun(row: Record<string, unknown>): Run {
  return {
    id: row.id as string,
    callType: row.call_type as CallType,
    status: row.status as Run['status'],
    coachName: (row.coach_name as string | null) ?? null,
    clientName: (row.client_name as string | null) ?? null,
    rubricHash: row.rubric_hash as string,
    transcript: row.transcript as Run['transcript'],
    report: (row.report as Run['report']) ?? null,
    error: (row.error as Run['error']) ?? null,
    cost: (row.cost as Run['cost']) ?? null,
    isSample: row.is_sample as boolean,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
  }
}

export async function getRun(id: string): Promise<Run | null> {
  const db = supabaseAdmin()
  const { data, error } = await db.from('runs').select(RUN_COLUMNS).eq('id', id).maybeSingle()
  if (error || !data) return null
  return rowToRun(data as Record<string, unknown>)
}

export async function listRuns(): Promise<RunSummary[]> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('runs')
    .select('id, call_type, status, coach_name, client_name, is_sample, created_at, report, cost')
    .order('created_at', { ascending: false })
  if (error || !data) return []

  return (data as Record<string, unknown>[]).map((row) => {
    const report = row.report as Run['report']
    const cost = row.cost as Run['cost']
    return {
      id: row.id as string,
      callType: row.call_type as CallType,
      status: row.status as Run['status'],
      coachName: (row.coach_name as string | null) ?? null,
      clientName: (row.client_name as string | null) ?? null,
      isSample: row.is_sample as boolean,
      createdAt: row.created_at as string,
      score: report?.trace.normalised ?? null,
      band: report?.trace.band.name ?? null,
      costUsd: cost?.usd ?? null,
    }
  })
}

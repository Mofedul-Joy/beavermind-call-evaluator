/**
 * Delivery-analytics lifecycle: attach a recording to a run, hand it to the Modal worker,
 * and take the worker's callback. The route handlers in `src/app/api/**` are thin wrappers
 * around this file, exactly as they are for `runs.ts`.
 *
 * The bytes never pass through Vercel. A Vercel function caps a request body at 4.5 MB and
 * a call recording is routinely fifty times that, so the browser PUTs straight to Supabase
 * Storage with a signed upload URL and the worker is handed a signed READ url to fetch. Two
 * short-lived credentials, one private bucket, no public object ever.
 *
 * Nothing here throws at the caller. Starting the worker is best-effort by design: the
 * transcript report is the brief and delivery analysis is the extension, so a missing token
 * or an unreachable worker has to land as `deliveryStatus: 'failed'` with a sentence a human
 * can act on — never as a 500 that takes the page down with it.
 */
import type { DeliveryReport } from '../delivery/types'
import type { DeliveryStatus, RunError } from '../scoring/types'
import { supabaseAdmin } from '../lib/supabase'

/** Supabase's per-object ceiling, and the bucket's own `file_size_limit`. */
export const MAX_RECORDING_BYTES = 52_428_800

export const RECORDINGS_BUCKET = 'recordings'

/**
 * How long the worker has to fetch the media.
 *
 * Two hours against a measured 5-12 minute wall clock. The URL is unguessable and scoped to
 * one object, so the generosity costs nothing and removes a whole class of "expired while
 * the queue was cold" failure.
 */
const READ_URL_TTL_SECONDS = 2 * 60 * 60

/** What every delivery route hands back. The client reads status and never has to know
 *  whether the worker was reached. */
export type DeliveryState = {
  recordingFilename: string | null
  deliveryStatus: DeliveryStatus
  deliveryError: RunError | null
}

function deliveryError(message: string, detail: string): RunError {
  return { code: 'model_error', message, detail, at: new Date().toISOString() }
}

/** Storage object keys are not filenames. Namespace by run so a bucket listing is readable,
 *  and prefix with a uuid so re-uploading `call.mp4` cannot clobber the previous attempt. */
export function recordingPath(runId: string, filename: string): string {
  return `${runId}/${crypto.randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
}

export type UploadTarget = { path: string; token: string; signedUrl: string }

/** Mint the credential the browser uploads with. Null when the run does not exist. */
export async function createRecordingUpload(
  runId: string,
  filename: string,
): Promise<UploadTarget | null> {
  const db = supabaseAdmin()

  const { data: run } = await db.from('runs').select('id').eq('id', runId).maybeSingle()
  if (!run) return null

  const path = recordingPath(runId, filename)
  const { data, error } = await db.storage.from(RECORDINGS_BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw error ?? new Error('no signed upload url returned')

  return { path: data.path, token: data.token, signedUrl: data.signedUrl }
}

/**
 * Record the upload against the run and start the worker.
 *
 * The row moves to `processing` BEFORE the worker is called, so a crash between the two
 * leaves a row the staleness reaper will pick up rather than a recording nobody is
 * analysing. Same `after()`-has-no-retries reasoning as `reap_stale_runs`.
 */
export async function startDelivery(
  runId: string,
  path: string,
  filename: string,
  origin: string,
): Promise<DeliveryState | null> {
  const db = supabaseAdmin()

  const { data: run } = await db
    .from('runs')
    .select('id, delivery_status, recording_filename')
    .eq('id', runId)
    .maybeSingle()
  if (!run) return null

  // A delivery is already in flight for this run. Starting a second worker on top of it
  // would leave two jobs racing to write the same row — whichever calls back second wins,
  // silently discarding the other's result (or, worse, discarding the newer recording's
  // result because the older job happened to finish later). Refuse instead: the current
  // attempt has to finish or be reaped before another can start.
  if (run.delivery_status === 'processing')
    return {
      recordingFilename: run.recording_filename,
      deliveryStatus: 'processing',
      deliveryError: null,
    }

  // Our own correlation token, independent of Modal's `call_id` (which the response to
  // `/start` hasn't given us yet at this point). Embedded in the callback URL and checked
  // again in `completeDelivery`, so a callback from an attempt this row has moved past —
  // reaped as stale, then superseded by a fresh upload — cannot land on the newer attempt.
  const attempt = crypto.randomUUID()

  await db
    .from('runs')
    .update({
      recording_path: path,
      recording_filename: filename,
      delivery_status: 'processing',
      delivery_started_at: new Date().toISOString(),
      delivery_call_id: attempt,
      delivery_report: null,
      delivery_error: null,
      delivery_finished_at: null,
    })
    .eq('id', runId)

  const failed = async (message: string, detail: string): Promise<DeliveryState> => {
    const error = deliveryError(message, detail)
    await db
      .from('runs')
      .update({
        delivery_status: 'failed',
        delivery_error: error,
        delivery_finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
    return { recordingFilename: filename, deliveryStatus: 'failed', deliveryError: error }
  }

  const workerUrl = process.env.DELIVERY_WORKER_URL
  const workerToken = process.env.DELIVERY_WORKER_TOKEN
  if (!workerUrl)
    return failed(
      'Delivery analysis is not configured on this deployment, so the recording was stored but not measured.',
      'DELIVERY_WORKER_URL is not set',
    )

  const { data: signed, error: signErr } = await db.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(path, READ_URL_TTL_SECONDS)
  if (signErr || !signed)
    return failed(
      'The recording could not be handed to the analyser. Try uploading it again.',
      `createSignedUrl failed: ${signErr?.message ?? 'no url returned'}`,
    )

  const callbackUrl =
    `${origin}/api/delivery/callback` +
    `?runId=${encodeURIComponent(runId)}&attempt=${encodeURIComponent(attempt)}`
  const start =
    `${workerUrl}/start` +
    `?filename=${encodeURIComponent(filename)}` +
    `&media_url=${encodeURIComponent(signed.signedUrl)}` +
    `&callback_url=${encodeURIComponent(callbackUrl)}`

  try {
    const res = await fetch(start, {
      method: 'POST',
      headers: { 'x-worker-token': workerToken ?? '' },
    })
    if (!res.ok)
      return failed(
        'The delivery analyser refused the recording. The transcript report above is unaffected.',
        `${res.status} ${(await res.text()).slice(0, 300)}`,
      )

    // `body.call_id` is Modal's own handle, useful for manual debugging but not the
    // correlation mechanism (that's `attempt`, already stored) — this app never polls
    // `/result` with it, only the callback path is used.
    return { recordingFilename: filename, deliveryStatus: 'processing', deliveryError: null }
  } catch (err) {
    return failed(
      'The delivery analyser could not be reached. The transcript report above is unaffected.',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Take the worker's finished report.
 *
 * Guarded on BOTH `delivery_status = 'processing'` AND `delivery_call_id = attempt`. Status
 * alone isn't enough: if the operator (or a page reload racing the reaper) starts a second
 * upload while an earlier worker call is still in flight, `startDelivery` now refuses to
 * start it — but a worker call already reaped as stale can still call back after a *third*,
 * unrelated attempt has since moved the row back to `processing`. Status alone would accept
 * that stale report onto the wrong attempt's row; requiring the attempt token too means a
 * callback can only ever complete the run it was actually started for. Returns whether the
 * row actually moved.
 */
export async function completeDelivery(
  runId: string,
  attempt: string,
  report: DeliveryReport,
): Promise<boolean> {
  const db = supabaseAdmin()
  const { data } = await db
    .from('runs')
    .update({
      delivery_status: 'done',
      delivery_report: report,
      delivery_finished_at: new Date().toISOString(),
      delivery_error: null,
    })
    .eq('id', runId)
    .eq('delivery_status', 'processing')
    .eq('delivery_call_id', attempt)
    .select('id')

  return (data?.length ?? 0) > 0
}

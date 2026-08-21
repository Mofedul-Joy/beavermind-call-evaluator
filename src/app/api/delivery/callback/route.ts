/**
 * Where the Modal worker posts its finished report.
 *
 * Public by necessity — Modal holds no session — so the shared `x-worker-token` is the
 * only thing standing in front of it. The body is the raw DeliveryReport, not wrapped in
 * `{status, report}`; that wrapper belongs to the `/result` poll path we do not use.
 *
 * Validation is deliberately thin. This is a trusted internal service writing into a
 * jsonb column that only the TONE tab reads, not user input; a version number is enough to
 * catch a contract drift or a stray request, and anything stricter would just be a second
 * copy of `delivery/contract.py` to keep in sync.
 */
import type { NextRequest } from 'next/server'
import type { DeliveryReport } from '../../../../delivery/types'
import { completeDelivery } from '../../../../server/delivery'

export async function POST(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get('runId')
  if (!runId) return Response.json({ error: 'runId is required' }, { status: 400 })

  // Our own correlation token, set on the row when this specific worker call was started
  // (see `startDelivery`). Required so a callback from a stale or superseded attempt can
  // never land on a run a newer upload has since taken over.
  const attempt = request.nextUrl.searchParams.get('attempt')
  if (!attempt) return Response.json({ error: 'attempt is required' }, { status: 400 })

  // Unset token means an unconfigured local dev box, which matches the worker: its own
  // `check()` is a no-op when WORKER_TOKEN is absent. Never a crash.
  const expected = process.env.DELIVERY_WORKER_TOKEN
  if (expected && request.headers.get('x-worker-token') !== expected)
    return Response.json({ error: 'bad or missing x-worker-token' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'body must be JSON' }, { status: 400 })
  }

  if (typeof (body as { version?: unknown })?.version !== 'number')
    return Response.json({ error: 'body must be a DeliveryReport' }, { status: 400 })

  // `applied` is false for a replay, or for a callback that arrives after the staleness
  // reaper already failed the row. Both are fine and both are a 200 — telling the worker
  // it errored would only make it retry into the same guard.
  const applied = await completeDelivery(runId, attempt, body as DeliveryReport)
  return Response.json({ ok: true, applied })
}

/**
 * The browser tells us the upload landed; we hand the object to the Modal worker.
 *
 * Always 200 when the run exists. Whether the worker was reachable is not the client's
 * problem to branch on — it reads `deliveryStatus` off this response, and off every
 * subsequent poll of the run, and renders the same three states either way.
 */
import type { NextRequest } from 'next/server'
import { startDelivery } from '../../../../../../server/delivery'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/runs/[id]/recording/complete'>) {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const { path, filename } = body as Record<string, unknown>

  if (typeof path !== 'string' || !path.startsWith(`${id}/`))
    return Response.json({ error: 'path must be an upload path for this run' }, { status: 400 })
  if (typeof filename !== 'string' || !filename.trim())
    return Response.json({ error: 'filename must be a non-empty string' }, { status: 400 })

  // `request.nextUrl.origin` is the deployment's own origin — localhost in dev, the
  // preview or production host on Vercel. No APP_URL env var to keep in sync.
  const state = await startDelivery(id, path, filename, request.nextUrl.origin)
  if (!state) return Response.json({ error: 'not found' }, { status: 404 })

  return Response.json(state)
}

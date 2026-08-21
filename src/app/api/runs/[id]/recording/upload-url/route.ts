/**
 * Mint a signed upload URL so the browser can PUT the recording straight to Supabase
 * Storage. A Vercel function body is capped at 4.5 MB and a call recording is routinely
 * fifty times that, so the bytes must not come through here.
 *
 * The size and type checks are a courtesy, not the enforcement: the bucket itself carries
 * `file_size_limit` and `allowed_mime_types`, so a client that skips this route still gets
 * rejected by Storage. Checking here just turns that into a sentence before the upload
 * starts rather than a failure after it.
 */
import type { NextRequest } from 'next/server'
import { createRecordingUpload, MAX_RECORDING_BYTES } from '../../../../../../server/delivery'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/runs/[id]/recording/upload-url'>) {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const { filename, contentType, sizeBytes } = body as Record<string, unknown>

  if (typeof filename !== 'string' || !filename.trim())
    return Response.json({ error: 'filename must be a non-empty string' }, { status: 400 })

  if (typeof contentType !== 'string' || !/^(audio|video)\//.test(contentType))
    return Response.json(
      { error: 'Only audio or video recordings can be analysed for delivery.' },
      { status: 400 },
    )

  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0)
    return Response.json({ error: 'sizeBytes must be a positive number' }, { status: 400 })

  if (sizeBytes > MAX_RECORDING_BYTES)
    return Response.json(
      { error: `Recordings are capped at 50 MB. This one is ${(sizeBytes / 1_048_576).toFixed(1)} MB.` },
      { status: 400 },
    )

  const target = await createRecordingUpload(id, filename)
  if (!target) return Response.json({ error: 'not found' }, { status: 404 })

  return Response.json(target)
}

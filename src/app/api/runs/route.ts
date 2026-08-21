import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRun, listRuns, runScoring, TranscriptTooLong } from '../../../server/runs'
import type { CallType } from '../../../scoring/types'

export const maxDuration = 300

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const { transcript, callType, coachName, clientName } = body as Record<string, unknown>

  if (typeof transcript !== 'string' || !transcript.trim())
    return Response.json({ error: 'transcript must be a non-empty string' }, { status: 400 })
  if (callType !== 'coaching' && callType !== 'kickoff')
    return Response.json({ error: 'callType must be "coaching" or "kickoff"' }, { status: 400 })

  try {
    const result = await createRun({
      transcript,
      callType: callType as CallType,
      coachName: typeof coachName === 'string' ? coachName : null,
      clientName: typeof clientName === 'string' ? clientName : null,
      clientIp: clientIp(request),
    })

    if (!result.ok)
      return Response.json(
        { code: result.code, message: 'Too many runs from this address. Try again later.', retryAfter: result.retryAfter },
        { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
      )

    after(() => runScoring(result.id))

    return Response.json({ id: result.id }, { status: 201 })
  } catch (err) {
    if (err instanceof TranscriptTooLong)
      return Response.json(
        { code: 'transcript_too_long', message: `Transcripts are capped at 80,000 characters.` },
        { status: 400 },
      )
    throw err
  }
}

export async function GET() {
  return Response.json(await listRuns())
}

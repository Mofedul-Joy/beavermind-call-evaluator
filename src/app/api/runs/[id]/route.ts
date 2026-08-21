import type { NextRequest } from 'next/server'
import { getRun } from '../../../../server/runs'

export async function GET(_request: NextRequest, ctx: RouteContext<'/api/runs/[id]'>) {
  const { id } = await ctx.params
  const run = await getRun(id)
  if (!run) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(run)
}

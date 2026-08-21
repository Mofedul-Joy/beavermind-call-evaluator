/**
 * Daily keep-alive. Free Supabase projects pause after ~7 days of DB inactivity, and
 * resuming is a manual dashboard click — this is what keeps "the URL still works next
 * week" true without anyone visiting. Also reaps runs killed mid-flight (see
 * `reap_stale_runs` in schema.sql), since `after()` gives no retries.
 */
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response('unauthorized', { status: 401 })

  const db = supabaseAdmin()
  const { data, error } = await db.rpc('daily_heartbeat')
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

  return Response.json(data)
}

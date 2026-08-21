/**
 * Server-only Supabase client, authenticated with the secret key (bypasses RLS).
 *
 * Never imported by client components — every route that touches this runs on the server.
 * The browser only ever reads a run through the frontend's own publishable-key client.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (client) return client
  client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  return client
}

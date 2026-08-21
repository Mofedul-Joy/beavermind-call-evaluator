/**
 * Applies supabase/schema.sql to the project in .env.local, over the transaction pooler
 * (DATABASE_URL) since no `sbp_` personal access token exists for `supabase link` or the
 * Management API. Prints the resulting tables and functions so the run can be pasted into
 * VERIFY.md as proof.
 *
 *   npx tsx scripts/apply-schema.ts
 */
process.loadEnvFile('.env.local')
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const ROOT = join(import.meta.dirname, '..')

async function main() {
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  await client.query(sql)
  console.log('schema.sql applied.\n')

  const tables = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `)
  console.log('Tables:', tables.rows.map((r) => r.table_name).join(', '))

  const functions = await client.query(`
    select routine_name from information_schema.routines
    where routine_schema = 'public' and routine_type = 'FUNCTION' order by routine_name
  `)
  console.log('Functions:', functions.rows.map((r) => r.routine_name).join(', '))

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

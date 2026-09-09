/**
 * Apply pending Drizzle migrations statement-by-statement (no wrapping transaction), recording each
 * in drizzle.__drizzle_migrations exactly like drizzle-kit does. We use this instead of
 * `drizzle-kit migrate` because Postgres refuses enum changes inside a transaction and drizzle-kit
 * fails silently on them.
 *
 *   npx tsx scripts/db-migrate.ts
 */
import 'dotenv/config'
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()
await c.query('create schema if not exists drizzle')
await c.query('create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)')
const applied = new Set((await c.query('select hash from drizzle.__drizzle_migrations')).rows.map((r) => r.hash as string))
const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: { tag: string; when: number }[] }
let n = 0
for (const e of journal.entries) {
  const sql = readFileSync(`drizzle/${e.tag}.sql`, 'utf8')
  const hash = createHash('sha256').update(sql).digest('hex')
  if (applied.has(hash)) continue
  console.log('applying', e.tag)
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const q = stmt.trim()
    if (!q) continue
    try {
      await c.query(q)
    } catch (err) {
      const msg = (err as Error).message
      if (/already exists/.test(msg)) { console.log('  skip (exists):', q.slice(0, 70)); continue }
      console.error('  FAILED:', q.slice(0, 120), '\n ', msg)
      await c.end()
      process.exit(1)
    }
  }
  await c.query('insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)', [hash, e.when])
  n++
}
console.log(n ? `applied ${n} migration(s)` : 'up to date')
await c.end()

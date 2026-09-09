import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __faviePool: Pool | undefined
}

function makePool() {
  // Web process prefers the transaction pooler (DATABASE_URL_WEB); the worker uses the session
  // pooler (DATABASE_URL). Supabase's free pooler caps session-mode clients at 15, so keep pools small.
  const isWorker = process.env.FAVIE_PROCESS === 'worker'
  const url = (!isWorker && process.env.DATABASE_URL_WEB) || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return new Pool({ connectionString: url, max: isWorker ? 4 : 3, idleTimeoutMillis: 20_000 })
}

// One pool per process (Next.js dev hot-reload would otherwise leak pools).
const pool = globalThis.__faviePool ?? makePool()
if (process.env.NODE_ENV !== 'production') globalThis.__faviePool = pool

export const db = drizzle(pool, { schema })
export type Db = typeof db
export { schema }

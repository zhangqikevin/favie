import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __faviePool: Pool | undefined
  // eslint-disable-next-line no-var
  var __favieWarm: boolean | undefined
}

function makePool() {
  // Web process prefers the transaction pooler (DATABASE_URL_WEB); the worker uses the session
  // pooler (DATABASE_URL). Supabase's free pooler caps session-mode clients at 15, so keep pools small.
  const isWorker = process.env.FAVIE_PROCESS === 'worker'
  const url = (!isWorker && process.env.DATABASE_URL_WEB) || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  // Web: the transaction pooler takes hundreds of clients, so a wider pool that never closes idle sockets
  // is cheap — and opening a socket is NOT: TCP + TLS + pooler auth is 6+ round trips (0.6 s at 100 ms
  // from Replit to us-west-2, seconds when the pooler is cold). With max 3 / 20 s idle, the first click
  // after a pause paid that for every connection, and parallel queries queued behind three sockets.
  return new Pool(isWorker
    ? { connectionString: url, max: 4, idleTimeoutMillis: 20_000, keepAlive: true, connectionTimeoutMillis: 10_000 }
    : { connectionString: url, max: 8, idleTimeoutMillis: 0, keepAlive: true, keepAliveInitialDelayMillis: 10_000, connectionTimeoutMillis: 10_000 })
}

// One pool per process (Next.js dev hot-reload would otherwise leak pools).
const pool = globalThis.__faviePool ?? makePool()
if (process.env.NODE_ENV !== 'production') globalThis.__faviePool = pool

// Keep a few web connections warm in production so a click after a quiet minute does not start with handshakes.
if (process.env.FAVIE_PROCESS !== 'worker' && process.env.NODE_ENV === 'production' && !globalThis.__favieWarm) {
  globalThis.__favieWarm = true
  const warm = () => { void Promise.all([0, 1, 2, 3].map(() => pool.query('select 1').catch(() => {}))) }
  warm()
  setInterval(warm, 25_000).unref()
}

export const db = drizzle(pool, { schema })
export type Db = typeof db
export { schema }

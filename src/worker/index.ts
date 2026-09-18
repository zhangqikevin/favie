/**
 * Favie background worker (pg-boss). Run with `npm run worker`.
 * Everything that must poll ZooWork, hold a stream, or talk to Zoodata lives here, not in Next.js.
 */
import 'dotenv/config'
process.env.FAVIE_PROCESS = 'worker'
import { PgBoss } from 'pg-boss'
import { JOBS } from '@/server/jobs/enqueue'
import { provisionAgent } from '@/lib/zoowork/provisioning'
import { reconcileSchedule } from '@/lib/zoowork/schedule'
import { verifyConnection } from '@/lib/zoowork/verify'
import { startHandoff, confirmLogin, startOpsHandoff, releaseOpsHandoff, releaseOpsHandoffs } from '@/lib/zoowork/handoff'
import { runManualPrompt } from '@/lib/zoowork/manual'
import { collectRuns, staleRuns } from '@/lib/zoowork/collect'
import { decommissionAgent } from '@/lib/zoowork/teardown'
import { zoodataSync } from '@/lib/zoodata'
import { weeklyDigest } from './jobs/weeklyDigest'
import { runMenuPull, runMenuGenerate, runMenuApply } from '@/lib/zoowork/menu'
import { prepareZoowork } from '@/lib/zoowork/client'
import { refreshSettings } from '@/server/settings'
import { runDisputesCheck, disputesTick, InflightError } from '@/lib/zoowork/disputes'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
// keepAlive keeps the Supabase pooler from silently dropping idle sockets (the Mac sleeps, the network
// changes). connectionTimeoutMillis is pg-boss's default 10s; the watchdog below handles the case where
// every connect attempt keeps timing out — pg-pool never recovers from that on its own (observed 2026-09-12:
// 12 hours of "timeout exceeded when trying to connect" on every queue while the process looked alive).
const boss = new PgBoss({ connectionString: url, schema: 'pgboss', max: 4, keepAlive: true } as ConstructorParameters<typeof PgBoss>[0])
const DEAD_POOL = /timeout exceeded when trying to connect|Connection terminated|ECONNRESET|EADDRNOTAVAIL|ETIMEDOUT/
let deadPoolErrors: number[] = []
boss.on('error', (e) => {
  console.error('[pg-boss]', e)
  const msg = e instanceof Error ? e.message : String(e)
  if (!DEAD_POOL.test(msg)) return
  const now = Date.now()
  deadPoolErrors = deadPoolErrors.filter((t) => now - t < 120_000)
  deadPoolErrors.push(now)
  if (deadPoolErrors.length >= 8) {
    console.error(`[worker] database pool unusable (${deadPoolErrors.length} connection errors in 2 min) — exiting so the supervisor restarts the process`)
    process.exit(75) // EX_TEMPFAIL; scripts/worker-forever.sh restarts us
  }
})
await boss.start()
await prepareZoowork()
setInterval(() => { refreshSettings().catch(() => {}) }, 60_000).unref()

for (const name of Object.values(JOBS)) await boss.createQueue(name).catch(() => {})

await boss.work<{ restaurantAgentId: string }>(JOBS.provisionAgent, { batchSize: 1 }, async ([job]) => {
  console.log('[provisionAgent]', job.data.restaurantAgentId)
  await provisionAgent(job.data.restaurantAgentId)
  const { db, schema } = await import('@/lib/db/client')
  const { eq } = await import('drizzle-orm')
  const [a] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.id, job.data.restaurantAgentId)).limit(1)
  if (a) await reconcileSchedule(a.restaurantId, 'post-provision')
})

await boss.work<{ restaurantId: string }>(JOBS.reconcileSchedule, { batchSize: 1 }, async ([job]) => {
  await reconcileSchedule(job.data.restaurantId, 'job')
})

await boss.work<{ restaurantId: string; platform: 'uber_eats' | 'doordash' }>(JOBS.verifyConnection, { batchSize: 1, pollingIntervalSeconds: 1 }, async ([job]) => {
  console.log('[verifyConnection]', job.data.restaurantId, job.data.platform)
  await verifyConnection(job.data.restaurantId, job.data.platform)
})
await boss.work<{ restaurantId: string; platform: 'uber_eats' | 'doordash' }>(JOBS.startHandoff, { batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([job]) => {
  console.log('[startHandoff]', job.data.restaurantId, job.data.platform)
  await startHandoff(job.data.restaurantId, job.data.platform)
})
await boss.work<{ restaurantId: string; platform: 'uber_eats' | 'doordash' }>(JOBS.confirmLogin, { batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([job]) => {
  console.log('[confirmLogin]', job.data.restaurantId, job.data.platform)
  await confirmLogin(job.data.restaurantId, job.data.platform)
})

await boss.work(JOBS.collectRuns, { batchSize: 1 }, async () => { await collectRuns() })
await boss.work(JOBS.staleRuns, { batchSize: 1 }, async () => { await staleRuns() })
await boss.work<{ restaurantId?: string }>(JOBS.zoodataSync, { batchSize: 1 }, async ([job]) => { await zoodataSync(job.data?.restaurantId) })
await boss.work<{ restaurantId: string; prompt?: string }>(JOBS.manualRun, { batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([job]) => {
  console.log('[manualRun]', job.data.restaurantId)
  const { DAILY_MESSAGE } = await import('@/lib/zoowork/schedule')
  await runManualPrompt(job.data.restaurantId, job.data.prompt ?? DAILY_MESSAGE)
})
await boss.work(JOBS.weeklyDigest, { batchSize: 1 }, async () => { await weeklyDigest() })
// Menu Clinic. Browser jobs (pull/save) run in parallel across restaurants; runMenuPull/runMenuApply
// serialize per restaurant themselves (one browser per agent, locked profile).
await boss.work<{ jobId: string; restaurantId: string; platform: 'uber_eats' | 'doordash' }>(JOBS.menuPull, { batchSize: 4, pollingIntervalSeconds: 0.5 }, async (jobs) => {
  await Promise.all(jobs.map(async (job) => { console.log('[menuPull]', job.data.restaurantId, job.data.platform); await runMenuPull(job.data.jobId) }))
})
await boss.work<{ jobId: string; menuItemId: string }>(JOBS.menuGenerate, { batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([job]) => {
  console.log('[menuGenerate]', job.data.menuItemId)
  await runMenuGenerate(job.data.jobId)
})
await boss.work<{ jobId: string; restaurantId: string; platform: string }>(JOBS.menuApply, { batchSize: 4, pollingIntervalSeconds: 0.5 }, async (jobs) => {
  await Promise.all(jobs.map(async (job) => { console.log('[menuApply]', job.data.restaurantId, job.data.platform); await runMenuApply(job.data.jobId) }))
})
await boss.work<{ opsId: string; op: 'start' | 'release' }>(JOBS.opsHandoff, { batchSize: 1, pollingIntervalSeconds: 0.5 }, async ([job]) => {
  console.log('[opsHandoff]', job.data.op, job.data.opsId)
  if (job.data.op === 'release') await releaseOpsHandoff(job.data.opsId)
  else await startOpsHandoff(job.data.opsId)
})
// Auto-release ops browsers whose live view expired (60 min), so restaurants get their profile back.
await boss.work(JOBS.opsHandoffSweep, { batchSize: 1 }, async () => { const n = await releaseOpsHandoffs(); if (n) console.log('[opsHandoff] auto-released', n) })
// Disputes: hourly tick decides who is due (08:00 local, retries until 20:00); checks run in parallel across restaurants.
await boss.work(JOBS.disputesTick, { batchSize: 1 }, async () => { const n = await disputesTick(); if (n) console.log('[disputes] queued', n) })
await boss.work<{ restaurantId: string; platform: 'uber_eats' | 'doordash'; date: string }>(JOBS.disputesCheck, { batchSize: 3, pollingIntervalSeconds: 1 }, async (jobs) => {
  await Promise.all(jobs.map(async (job) => {
    console.log('[disputesCheck]', job.data.restaurantId, job.data.platform, job.data.date)
    try { await runDisputesCheck(job.data.restaurantId, job.data.platform, job.data.date) } catch (e) {
      if (e instanceof InflightError) { console.log('[disputesCheck] agent busy, next tick retries'); return }
      console.error('[disputesCheck] failed', (e as Error).message)
    }
  }))
})
await boss.work<{ restaurantId: string; platform: 'uber_eats' | 'doordash'; mode: 'check' | 'process' }>(JOBS.disputesManual, { batchSize: 3, pollingIntervalSeconds: 0.5 }, async (jobs) => {
  await Promise.all(jobs.map(async (job) => {
    console.log('[disputesManual]', job.data.mode, job.data.restaurantId, job.data.platform)
    try { await runDisputesCheck(job.data.restaurantId, job.data.platform, undefined, { mode: job.data.mode, manual: true }) } catch (e) { console.error('[disputesManual] failed', (e as Error).message) }
  }))
})
await boss.work<{ restaurantAgentId: string }>(JOBS.decommissionAgent, { batchSize: 1 }, async ([job]) => { await decommissionAgent(job.data.restaurantAgentId) })

// Cron
await boss.schedule(JOBS.collectRuns, '*/5 * * * *', {}, { tz: 'UTC' })
await boss.schedule(JOBS.staleRuns, '17 * * * *', {}, { tz: 'UTC' })
await boss.schedule(JOBS.opsHandoffSweep, '*/5 * * * *', {}, { tz: 'UTC' })
// 05:30 UTC was 22:30 Pacific the evening BEFORE, so "yesterday" resolved to the day before that and the
// orders chart lagged two days. 10:30 UTC is 03:30 Pacific / 06:30 Eastern — after midnight everywhere in
// the US; the 17:30 UTC pass picks up late corrections (the sync always re-fetches the last 3 days).
await boss.schedule(JOBS.zoodataSync, '30 10,17 * * *', {}, { tz: 'UTC' })
await boss.schedule(JOBS.disputesTick, '5 * * * *', {}, { tz: 'UTC' })
// weeklyDigest intentionally NOT scheduled in V1 (placeholder job only).

console.log('[worker] up; queues:', Object.values(JOBS).join(', '))

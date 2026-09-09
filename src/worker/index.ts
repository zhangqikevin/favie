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
import { startHandoff, confirmLogin } from '@/lib/zoowork/handoff'
import { runManualPrompt } from '@/lib/zoowork/manual'
import { collectRuns, staleRuns } from '@/lib/zoowork/collect'
import { decommissionAgent } from '@/lib/zoowork/teardown'
import { zoodataSync } from '@/lib/zoodata'
import { weeklyDigest } from './jobs/weeklyDigest'
import { prepareZoowork } from '@/lib/zoowork/client'
import { refreshSettings } from '@/server/settings'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const boss = new PgBoss({ connectionString: url, schema: 'pgboss', max: 4 })
boss.on('error', (e) => console.error('[pg-boss]', e))
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
await boss.work<{ restaurantAgentId: string }>(JOBS.decommissionAgent, { batchSize: 1 }, async ([job]) => { await decommissionAgent(job.data.restaurantAgentId) })

// Cron
await boss.schedule(JOBS.collectRuns, '*/5 * * * *', {}, { tz: 'UTC' })
await boss.schedule(JOBS.staleRuns, '17 * * * *', {}, { tz: 'UTC' })
await boss.schedule(JOBS.zoodataSync, '30 5 * * *', {}, { tz: 'UTC' })
// weeklyDigest intentionally NOT scheduled in V1 (placeholder job only).

console.log('[worker] up; queues:', Object.values(JOBS).join(', '))

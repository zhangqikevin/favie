import { PgBoss } from 'pg-boss'

export const JOBS = {
  reconcileSchedule: 'reconcile-schedule',
  provisionAgent: 'provision-agent',
  verifyConnection: 'verify-connection',
  collectRuns: 'collect-runs',
  staleRuns: 'stale-runs',
  zoodataSync: 'zoodata-sync',
  startHandoff: 'start-handoff',
  confirmLogin: 'confirm-login',
  manualRun: 'manual-run',
  weeklyDigest: 'weekly-digest', // placeholder in V1
  decommissionAgent: 'decommission-agent',
} as const

declare global {
  // eslint-disable-next-line no-var
  var __favieBoss: PgBoss | undefined
}

/** A lightweight pg-boss handle for enqueueing from the web process (workers live in src/worker). */
export async function boss() {
  if (globalThis.__favieBoss) return globalThis.__favieBoss
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const b = new PgBoss({ connectionString: url, schema: 'pgboss', max: 2, supervise: false, schedule: false })
  await b.start()
  globalThis.__favieBoss = b
  return b
}

export async function enqueueReconcileSchedule(restaurantId: string) {
  const b = await boss()
  await b.send(JOBS.reconcileSchedule, { restaurantId }, { singletonKey: restaurantId, singletonSeconds: 30 })
}

export async function enqueueProvisionAgent(restaurantAgentId: string) {
  const b = await boss()
  await b.send(JOBS.provisionAgent, { restaurantAgentId }, { singletonKey: restaurantAgentId, retryLimit: 5, retryBackoff: true })
}

export async function enqueueVerifyConnection(restaurantId: string, platform: 'uber_eats' | 'doordash') {
  const b = await boss()
  await b.send(JOBS.verifyConnection, { restaurantId, platform }, { singletonKey: `${restaurantId}:${platform}`, singletonSeconds: 120 })
}

/** Ask the agent to open the platform login page and hand the live browser to the user. */
export async function enqueueStartHandoff(restaurantId: string, platform: 'uber_eats' | 'doordash') {
  const b = await boss()
  await b.send(JOBS.startHandoff, { restaurantId, platform }, { singletonKey: `handoff:${restaurantId}:${platform}`, singletonSeconds: 60, retryLimit: 1, retryDelay: 10 })
}

/** User clicked "I've logged in": have the agent save the login profile and verify the store. */
export async function enqueueConfirmLogin(restaurantId: string, platform: 'uber_eats' | 'doordash') {
  const b = await boss()
  await b.send(JOBS.confirmLogin, { restaurantId, platform }, { singletonKey: `confirm:${restaurantId}:${platform}`, singletonSeconds: 60, retryLimit: 3, retryDelay: 20 })
}

/** Admin: run the restaurant's custom prompt (or an ad-hoc one) on its agent right now. */
export async function enqueueManualRun(restaurantId: string, prompt?: string) {
  const b = await boss()
  await b.send(JOBS.manualRun, { restaurantId, prompt }, { singletonKey: `manual:${restaurantId}`, singletonSeconds: 30, retryLimit: 0, expireInSeconds: 30 * 60 })
}

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
  menuPull: 'menu-pull',
  menuGenerate: 'menu-generate',
  menuApply: 'menu-apply',
  opsHandoff: 'ops-handoff',
  opsHandoffSweep: 'ops-handoff-sweep',
  disputesTick: 'disputes-tick',
  disputesCheck: 'disputes-check',
  disputesManual: 'disputes-manual',
} as const

declare global {
  // eslint-disable-next-line no-var
  var __favieBoss: PgBoss | undefined
}

/** A lightweight pg-boss handle for enqueueing from the web process (workers live in src/worker). */
export async function boss() {
  if (globalThis.__favieBoss) return globalThis.__favieBoss
  // The web process only *sends* jobs (plain inserts), so it can use the transaction pooler and leave the
  // 15-client session pooler to the worker (which needs session mode for LISTEN). Falls back to DATABASE_URL.
  const url = process.env.DATABASE_URL_WEB || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const b = new PgBoss({ connectionString: url, schema: 'pgboss', max: 2, supervise: false, schedule: false })
  await b.start()
  // pg-boss 12 refuses to send to a queue that was never created. The worker creates them at boot, but a
  // freshly added queue must also exist for a web process whose worker has not restarted yet.
  for (const name of Object.values(JOBS)) await b.createQueue(name).catch(() => {})
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

/** Menu Clinic: read the platform menu (browser) — one per restaurant+platform at a time. */
export async function enqueueMenuPull(jobId: string, restaurantId: string, platform: 'uber_eats' | 'doordash') {
  const b = await boss()
  await b.send(JOBS.menuPull, { jobId, restaurantId, platform }, { singletonKey: `menu-pull:${restaurantId}:${platform}`, singletonSeconds: 60, retryLimit: 0, expireInSeconds: 40 * 60 })
}
/** Menu Clinic: AI description + photo for one item (no browser). */
export async function enqueueMenuGenerate(jobId: string, menuItemId: string, scope: 'text' | 'image' | 'both' = 'both') {
  const b = await boss()
  await b.send(JOBS.menuGenerate, { jobId, menuItemId }, { singletonKey: `menu-gen:${menuItemId}:${scope}`, singletonSeconds: 30, retryLimit: 0, expireInSeconds: 15 * 60 })
}
/** Menu Clinic: write approved drafts to the platform (browser) — one item (menuItemId) or every draft of that platform. */
export async function enqueueMenuApply(jobId: string, restaurantId: string, platform: 'uber_eats' | 'doordash') {
  const b = await boss()
  await b.send(JOBS.menuApply, { jobId, restaurantId, platform }, { singletonKey: `menu-apply:${restaurantId}:${platform}`, singletonSeconds: 30, retryLimit: 0, expireInSeconds: 45 * 60 })
}

/** Ops: open (or release) a live browser on the restaurant's saved login for Favie's team. */
export async function enqueueOpsHandoff(opsId: string, op: 'start' | 'release') {
  const b = await boss()
  await b.send(JOBS.opsHandoff, { opsId, op }, { singletonKey: `ops-handoff:${opsId}:${op}`, singletonSeconds: 30, retryLimit: 0, expireInSeconds: 10 * 60 })
}

/** Disputes: run today's check for one restaurant × platform now (the hourly tick enqueues these at 08:00 local). */
/** One job per restaurant: its platforms are checked one after the other (a restaurant has ONE agent browser). */
export async function enqueueDisputesCheck(restaurantId: string, platforms: ('uber_eats' | 'doordash')[], date: string) {
  const b = await boss()
  await b.send(JOBS.disputesCheck, { restaurantId, platforms, date }, { singletonKey: `disputes:${restaurantId}:${date}`, singletonSeconds: 3000, retryLimit: 0, expireInSeconds: 80 * 60 })
}
/** Disputes: owner/admin-triggered run right now — `check` reads only, `process` files appeals. Not part of the daily ledger. */
export async function enqueueDisputesManual(restaurantId: string, platform: 'uber_eats' | 'doordash', mode: 'check' | 'process' | 'fast', orderId?: string | null) {
  const b = await boss()
  await b.send(JOBS.disputesManual, { restaurantId, platform, mode, orderId: orderId ?? null }, { singletonKey: `disputes-manual:${restaurantId}:${platform}:${orderId ?? 'all'}`, singletonSeconds: 60, retryLimit: 0, expireInSeconds: 40 * 60 })
}

import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'
import { streamTurn } from './streamTurn'
import { collectRun, localDate } from './collect'
import type { Platform } from '@/lib/db/schema'

const PLATFORM_WORD: Record<Platform, string> = { uber_eats: 'uber_eats', doordash: 'doordash' }

/**
 * One interactive turn: log in, find the store, change nothing, report. Optionally opens an
 * invitation link first. Result is parsed through the same collector as daily runs.
 */
export async function verifyConnection(restaurantId: string, platform: Platform) {
  const [agent] = await db.select().from(schema.restaurantAgents)
    .where(and(eq(schema.restaurantAgents.restaurantId, restaurantId), eq(schema.restaurantAgents.kind, 'delivery-ops'))).limit(1)
  if (!agent?.zooworkAgentId || agent.agentStatus !== 'ready') throw new Error(`agent not ready for restaurant ${restaurantId} (${agent?.agentStatus ?? 'missing'})`)
  const [restaurant] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!restaurant) throw new Error('restaurant not found')

  // Serialize browser use per agent: skip if a run is in flight.
  const inflight = await db.select({ id: schema.agentRuns.id }).from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.restaurantAgentId, agent.id), eq(schema.agentRuns.status, 'running'))).limit(1)
  if (inflight.length) throw new Error('another run is in flight for this agent; retry later')

  const zc = zoowork()
  const [conn] = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform))).limit(1)
  const attempt = (conn?.verifyAttempts ?? 0) + 1
  const message = [
    `FAVIE_VERIFY ${PLATFORM_WORD[platform]}. Use the favie-ops skill in mode "verify".`,
    'Fetch the context URL from AGENTS.md, restore this platform\'s saved login profile, locate the store, change nothing, close the browser session, and end with the favie-summary block (mode "verify"). Never type credentials.',
  ].filter(Boolean).join('\n')

  const session = await logged('createSession.verify', agent.id, { platform, attempt }, () =>
    zc.createSession(agent.zooworkAgentId!, {
      initial_events: [{ type: 'user.message', content: message }],
      metadata: { kind: 'verify', restaurant_id: restaurantId, platform },
    }, `verify-${restaurantId}-${platform}-${attempt}-${Date.now()}`))

  const [run] = await db.insert(schema.agentRuns).values({
    restaurantId, restaurantAgentId: agent.id, zooworkAgentId: agent.zooworkAgentId, zooworkSessionId: session.session_id,
    sessionKey: session.session_key ?? null, channel: 'api', kind: 'verify', status: 'running',
    runDate: localDate(new Date(), restaurant.timezone), startedAt: new Date(),
  }).returning()

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 10 * 60_000)
  try {
    const res = await streamTurn(zc, agent.zooworkAgentId, session.session_id, {
      signal: ctl.signal,
      onEvent: (ev) => { if (ev.cursor) void db.update(schema.agentRuns).set({ lastCursor: ev.cursor }).where(eq(schema.agentRuns.id, run!.id)).catch(() => {}) },
    })
    if (!res.outcome) {
      await zc.postEvents(agent.zooworkAgentId, session.session_id, [{ type: 'user.interrupt' }]).catch(() => {})
      await db.update(schema.agentRuns).set({ status: 'timed_out', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
      return
    }
  } finally {
    clearTimeout(timer)
  }
  await db.update(schema.agentRuns).set({ status: 'finished', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
  const [fresh] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run!.id)).limit(1)
  await collectRun(fresh!, restaurant.timezone)
}

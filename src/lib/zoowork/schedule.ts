import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged, ZooworkError } from './client'
import { computeDesiredEnabled } from '@/server/billing/gate'

export const DAILY_SCHEDULE_ID = 'daily-ops'
export const DAILY_MESSAGE =
  'Run the daily Favie ops routine using the favie-ops skill: fetch the context URL from AGENTS.md, log into Uber Eats Manager and DoorDash Merchant Portal, apply the monthly ad cap policy, close the browser session, and end with the favie-summary block.'

type RestaurantAgent = typeof schema.restaurantAgents.$inferSelect



/** Creates the daily cron if missing. Idempotent: identical definition on the same id is accepted. */
export async function ensureDailySchedule(agent: RestaurantAgent, timezone: string, enabled: boolean, message = DAILY_MESSAGE) {
  if (!agent.zooworkAgentId) throw new Error('agent has no zoowork_agent_id')
  const zc = zoowork()
  const agentId = agent.zooworkAgentId
  try {
    await zc.getSchedule(agentId, DAILY_SCHEDULE_ID)
    return
  } catch (e) {
    if (!(e instanceof ZooworkError && e.status === 404)) throw e
  }
  const input = {
    schedule_id: DAILY_SCHEDULE_ID,
    schedule: { kind: 'cron' as const, expr: `${agent.cronMinute} 6 * * *`, tz: timezone },
    payload: { kind: 'agentTurn' as const, message },
    sessionTarget: 'isolated' as const,
    delivery: { mode: 'none' as const },
    enabled,
  }
  await logged('createSchedule', agent.id, input, () => zc.createSchedule(agentId, input, `${DAILY_SCHEDULE_ID}-${agent.id}-v1`))
  const stored = await zc.getSchedule(agentId, DAILY_SCHEDULE_ID)
  if (stored.enabled !== enabled) {
    await logged('updateSchedule', agent.id, { enabled }, () => zc.updateSchedule(agentId, DAILY_SCHEDULE_ID, { enabled }))
  }
}

/** Reads our DB, decides desired `enabled`, and makes ZooWork match. Safe to call often. */
export async function reconcileSchedule(restaurantId: string, reason = 'reconcile') {
  const [restaurant] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!restaurant) return
  const agents = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.restaurantId, restaurantId))
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.restaurantId, restaurantId)).limit(1)
  const conns = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.restaurantId, restaurantId))

  for (const agent of agents) {
    if (!agent.zooworkAgentId || agent.agentStatus !== 'ready') continue
    const desired = computeDesiredEnabled({
      subscriptionStatus: sub?.status,
      serviceDisabled: restaurant.serviceDisabled,
      dailySchedulePaused: restaurant.dailySchedulePaused,
      agentStatus: agent.agentStatus,
      connectionStatuses: conns.map((c) => c.status),
    })
    const zc = zoowork()
    let current: boolean | undefined
    const wantMessage = DAILY_MESSAGE
    try {
      const s = await zc.getSchedule(agent.zooworkAgentId, DAILY_SCHEDULE_ID)
      current = s.enabled
      // Keep the cron's message in sync with the admin prompt. The read shape nests the payload; be defensive.
      const have = (s as { payload?: { message?: string }; spec?: { payload?: { message?: string } } }).payload?.message
        ?? (s as { spec?: { payload?: { message?: string } } }).spec?.payload?.message
      if (have !== undefined && have !== wantMessage) {
        await logged('updateSchedule.message', agent.id, { chars: wantMessage.length }, () =>
          zc.updateSchedule(agent.zooworkAgentId!, DAILY_SCHEDULE_ID, { payload: { kind: 'agentTurn', message: wantMessage } }))
      }
    } catch (e) {
      if (e instanceof ZooworkError && e.status === 404) {
        await ensureDailySchedule(agent, restaurant.timezone, desired, wantMessage)
        continue
      }
      throw e
    }
    if (current === desired) continue
    const action = desired
      ? (sub?.status === 'active' ? 'auto_enable_billing' : 'auto_enable_connection')
      : (!sub || sub.status !== 'active' ? 'auto_disable_billing' : restaurant.dailySchedulePaused || restaurant.serviceDisabled ? 'admin_disable' : 'auto_disable_connection')
    try {
      await logged('updateSchedule', agent.id, { enabled: desired, reason }, () => zc.updateSchedule(agent.zooworkAgentId!, DAILY_SCHEDULE_ID, { enabled: desired }))
      await db.insert(schema.scheduleEvents).values({ restaurantAgentId: agent.id, action, reason, scheduleUpdateOk: true, scheduleEnabledAfter: desired })
    } catch (e) {
      await db.insert(schema.scheduleEvents).values({ restaurantAgentId: agent.id, action, reason, scheduleUpdateOk: false, error: (e as Error).message })
      throw e
    }
  }
}

import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'

/** Order matters: schedules outlive agents, and deleteAgent stops nothing. */
export async function decommissionAgent(restaurantAgentId: string) {
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.id, restaurantAgentId)).limit(1)
  if (!agent?.zooworkAgentId) return
  const zc = zoowork()
  const id = agent.zooworkAgentId
  for (const s of await zc.listSchedules(id)) {
    const sid = (s as { name?: string; memo?: { schedule_id?: string } }).name ?? (s as { memo?: { schedule_id?: string } }).memo?.schedule_id
    if (sid) await logged('deleteSchedule', agent.id, { sid }, () => zc.deleteSchedule(id, sid)).catch(() => {})
  }
  await logged('stopAgent', agent.id, {}, () => zc.stopAgent(id)).catch(() => {})
  await logged('deleteAgent', agent.id, {}, () => zc.deleteAgent(id))
  await db.update(schema.restaurantAgents).set({ agentStatus: 'none', zooworkAgentId: null, updatedAt: new Date() }).where(eq(schema.restaurantAgents.id, agent.id))
}

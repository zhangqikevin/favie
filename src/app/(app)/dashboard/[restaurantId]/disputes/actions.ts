'use server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, schema } from '@/lib/db/client'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser } from '@/server/restaurants'

/** Owner switch: Favie checks and files disputes every morning (on by default). */
export async function setDisputesEnabled(fd: FormData) {
  const user = await requireUser()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) return
  const enabled = String(fd.get('enabled')) === 'true'
  await db.update(schema.restaurants).set({ disputesEnabled: enabled, updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  revalidatePath(`/dashboard/${r.id}/disputes`)
}

export async function dismissDisputesIntro(fd: FormData) {
  const user = await requireUser()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) return
  await db.update(schema.restaurants).set({ disputesIntroSeenAt: new Date(), updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  revalidatePath(`/dashboard/${r.id}/disputes`)
}

export type ManualState = { ok?: string; error?: string } | undefined

/** Testing aid: run the agent on this restaurant's Uber Eats disputes right now — `check` reads only, `process` files appeals. */
export async function runDisputesManual(_prev: ManualState, fd: FormData): Promise<ManualState> {
  const user = await requireUser()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const mode = String(fd.get('mode')) === 'process' ? 'process' : 'check'
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) return { error: 'not_found' }
  const { getConnections, getPrimaryAgent } = await import('@/server/restaurants')
  const conns = await getConnections(r.id)
  if (!conns.some((c) => c.platform === 'uber_eats' && c.status === 'connected')) return { error: 'not_connected' }
  const agent = await getPrimaryAgent(r.id)
  if (!agent || agent.agentStatus !== 'ready') return { error: 'agent_not_ready' }
  const { and, eq } = await import('drizzle-orm')
  const [inflight] = await db.select({ id: schema.agentRuns.id }).from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.restaurantAgentId, agent.id), eq(schema.agentRuns.status, 'running'))).limit(1)
  if (inflight) return { error: 'inflight' }
  const { enqueueDisputesManual } = await import('@/server/jobs/enqueue')
  await enqueueDisputesManual(r.id, 'uber_eats', mode)
  revalidatePath(`/dashboard/${r.id}/disputes`)
  return { ok: mode }
}

'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { requireAdmin } from '@/server/admin'
import { enqueueManualRun, enqueueReconcileSchedule } from '@/server/jobs/enqueue'
import { publishOperatingPrompt, rollbackTo } from '@/lib/zoowork/skill-publish'

export type AdminState = { ok?: string; error?: string } | undefined

/** Publish a new version of the global operating prompt → new favie-ops skill version → all agents. */
export async function publishPrompt(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin()
  const body = String(fd.get('prompt') ?? '').replace(/\r\n/g, '\n')
  const note = String(fd.get('note') ?? '').trim() || undefined
  if (body.trim().length < 50) return { error: 'The prompt is too short to be the agents\' daily routine.' }
  try {
    const r = await publishOperatingPrompt(body, user.id, note)
    revalidatePath('/admin')
    return { ok: `Published as prompt v${r.version} (skill version ${r.skillVersion}). Every agent uses it from its next run.` }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function rollbackPrompt(fd: FormData) {
  const user = await requireAdmin()
  const version = Number(fd.get('version'))
  if (!Number.isInteger(version)) return
  await rollbackTo(version, user.id)
  revalidatePath('/admin')
}

/** Run the standard daily routine on one restaurant's agent right now (to test the current prompt). */
export async function runNow(_prev: AdminState, fd: FormData): Promise<AdminState> {
  await requireAdmin()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!r) return { error: 'restaurant not found' }
  await enqueueManualRun(restaurantId)
  revalidatePath(`/admin/${restaurantId}`)
  return { ok: 'Queued. The run appears below within seconds; refresh to follow it.' }
}

export async function setDailyPaused(fd: FormData) {
  await requireAdmin()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const paused = String(fd.get('paused')) === 'true'
  await db.update(schema.restaurants).set({ dailySchedulePaused: paused, updatedAt: new Date() }).where(eq(schema.restaurants.id, restaurantId))
  await enqueueReconcileSchedule(restaurantId).catch(() => {})
  revalidatePath(`/admin/${restaurantId}`)
  revalidatePath('/admin')
}

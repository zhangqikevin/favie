'use server'

import { revalidatePath } from 'next/cache'
import { eq, isNotNull } from 'drizzle-orm'
import { createZooworkClient } from '@zoowork-ai/sdk'
import { SETTING_KEYS, setSetting, deleteSetting } from '@/server/settings'
import { zoowork, resolveModel, logged } from '@/lib/zoowork/client'
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

// ---- Platform settings (ZooWork key, default model) ----

/** Verify the new org key against ZooWork (listModels) before storing it encrypted. Takes effect within 60s in every process. */
export async function saveZooworkKey(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin()
  const key = String(fd.get('key') ?? '').trim()
  if (!/^zct_[A-Za-z0-9_-]{20,}$/.test(key)) return { error: 'That does not look like a ZooWork organization key (zct_…).' }
  try {
    const models = await createZooworkClient({ apiKey: key }).listModels()
    if (!models.length) return { error: 'ZooWork accepted the key but returned no models.' }
  } catch (e) {
    return { error: `ZooWork rejected the key: ${(e as Error).message.slice(0, 160)}` }
  }
  await setSetting(SETTING_KEYS.zooworkApiKey, key, { secret: true, userId: user.id })
  revalidatePath('/admin')
  return { ok: 'Key verified and saved. This process uses it now; the worker picks it up within a minute.' }
}

/** Remove the saved key → fall back to ZOOWORK_API_KEY from the environment. */
export async function clearZooworkKey() {
  await requireAdmin()
  await deleteSetting(SETTING_KEYS.zooworkApiKey)
  revalidatePath('/admin')
}

export async function saveDefaultModel(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin()
  const model = String(fd.get('model') ?? '').trim()
  const models = await zoowork().listModels()
  if (!models.some((m) => m.model === model)) return { error: 'Pick a model from the list.' }
  await setSetting(SETTING_KEYS.zooworkDefaultModel, model, { userId: user.id })
  revalidatePath('/admin')
  return { ok: `Default model is now ${model}. New agents use it immediately; use "Apply to existing agents" to switch the ones already running.` }
}

/** Switch every provisioned agent to the current default model (updateAgent merges per section, so persona/skills stay). */
export async function applyModelToAgents(_prev: AdminState, _fd: FormData): Promise<AdminState> {
  await requireAdmin()
  const model = await resolveModel()
  const agents = await db.select().from(schema.restaurantAgents).where(isNotNull(schema.restaurantAgents.zooworkAgentId))
  let ok = 0
  const failed: string[] = []
  for (const a of agents) {
    try {
      await logged('updateAgent.model', a.id, { model }, () => zoowork().updateAgent(a.zooworkAgentId!, { model: { primary: model } }))
      ok++
    } catch (e) {
      failed.push(`${a.zooworkAgentId}: ${(e as Error).message.slice(0, 80)}`)
    }
  }
  revalidatePath('/admin')
  return failed.length ? { error: `Updated ${ok}; failed ${failed.length}: ${failed.join(' · ')}` } : { ok: `All ${ok} agents now run ${model}.` }
}

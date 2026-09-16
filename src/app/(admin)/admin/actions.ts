'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, isNotNull } from 'drizzle-orm'
import { createZooworkClient } from '@zoowork-ai/sdk'
import { SETTING_KEYS, setSetting, deleteSetting } from '@/server/settings'
import { zoodataMenuTools } from '@/lib/menu/zoodata-menu'
import { ZOODATA_MENU_MCP_DEFAULT, ZOODATA_MENU_TOOL_DEFAULT } from '@/lib/menu/provider'
import { zoowork, resolveModel, logged } from '@/lib/zoowork/client'
import { db, schema } from '@/lib/db/client'
import { requireAdmin } from '@/server/admin'
import { enqueueManualRun, enqueueReconcileSchedule, enqueueOpsHandoff } from '@/server/jobs/enqueue'
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
    revalidatePath('/admin/prompt')
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
  revalidatePath('/admin/prompt')
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
  revalidatePath('/admin/settings')
  return { ok: 'Key verified and saved. This process uses it now; the worker picks it up within a minute.' }
}

/** Remove the saved key → fall back to ZOOWORK_API_KEY from the environment. */
export async function clearZooworkKey() {
  await requireAdmin()
  await deleteSetting(SETTING_KEYS.zooworkApiKey)
  revalidatePath('/admin/settings')
}

export async function saveDefaultModel(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin()
  const model = String(fd.get('model') ?? '').trim()
  const models = await zoowork().listModels()
  if (!models.some((m) => m.model === model)) return { error: 'Pick a model from the list.' }
  await setSetting(SETTING_KEYS.zooworkDefaultModel, model, { userId: user.id })
  revalidatePath('/admin/settings')
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
  revalidatePath('/admin/settings')
  return failed.length ? { error: `Updated ${ok}; failed ${failed.length}: ${failed.join(' · ')}` } : { ok: `All ${ok} agents now run ${model}.` }
}

/** Per-restaurant kill switch: off = the agent observes and recommends only; on = it may change ads/promotions within the cap. */
export async function setAgentActionsEnabled(fd: FormData) {
  await requireAdmin()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const enabled = String(fd.get('enabled')) === 'true'
  await db.update(schema.restaurants).set({ agentActionsEnabled: enabled, updatedAt: new Date() }).where(eq(schema.restaurants.id, restaurantId))
  revalidatePath(`/admin/${restaurantId}`)
  revalidatePath('/admin')
}

// ---- Menu Clinic prompts (description writing guidelines, dish photo prompt) ----

const MENU_PROMPT_KEYS = { describe: SETTING_KEYS.menuDescribePrompt, image: SETTING_KEYS.menuImagePrompt } as const

export async function saveMenuPrompt(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin()
  const which = String(fd.get('which')) as keyof typeof MENU_PROMPT_KEYS
  const key = MENU_PROMPT_KEYS[which]
  if (!key) return { error: 'unknown prompt' }
  const body = String(fd.get('prompt') ?? '').replace(/\r\n/g, '\n').trim()
  if (body.length < 40) return { error: 'The prompt is too short.' }
  if (which === 'image' && !body.includes('{name}')) return { error: 'The photo prompt must contain {name}.' }
  await setSetting(key, body, { userId: user.id })
  revalidatePath('/admin/menu-prompts')
  return { ok: 'Saved. The next "Favie AI optimize" uses it.' }
}

export async function resetMenuPrompt(fd: FormData) {
  await requireAdmin()
  const which = String(fd.get('which')) as keyof typeof MENU_PROMPT_KEYS
  const key = MENU_PROMPT_KEYS[which]
  if (key) await deleteSetting(key)
  revalidatePath('/admin/menu-prompts')
}

// ---- Firecrawl (Menu Clinic storefront reads) ----

/** Verify the key with a tiny search call, then store it encrypted. The worker picks it up within a minute. */
export async function saveFirecrawlKey(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin()
  const key = String(fd.get('key') ?? '').trim()
  if (!/^fc-[A-Za-z0-9]{16,}$/.test(key)) return { error: 'That does not look like a Firecrawl key (fc-…).' }
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/search', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ query: 'doordash', limit: 1 }), signal: AbortSignal.timeout(20_000) })
    if (res.status === 401 || res.status === 403) return { error: 'Firecrawl rejected the key.' }
  } catch (e) { return { error: `Could not reach Firecrawl: ${(e as Error).message.slice(0, 120)}` } }
  await setSetting(SETTING_KEYS.firecrawlApiKey, key, { secret: true, userId: user.id })
  revalidatePath('/admin/settings')
  return { ok: 'Key verified and saved. Menu Clinic reads store pages server-side from now on.' }
}

export async function clearFirecrawlKey() {
  await requireAdmin()
  await deleteSetting(SETTING_KEYS.firecrawlApiKey)
  revalidatePath('/admin/settings')
}

/** Menu Clinic: which image model the agent's image_generate tool uses ("provider/model" or a provider name). */
export async function saveMenuImageModel(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin()
  const model = String(fd.get('model') ?? '').trim()
  if (!/^[a-z0-9][a-z0-9._/-]{1,60}$/i.test(model)) return { error: 'Use provider/model, e.g. openai/gpt-image-1.5.' }
  await setSetting(SETTING_KEYS.menuImageModel, model, { userId: user.id })
  revalidatePath('/admin/menu-prompts')
  return { ok: `Dish photos now use ${model}.` }
}

/** Ops finished (or dropped) a "Favie AI optimize my menu" request. */
export async function completeMenuOptimization(fd: FormData) {
  await requireAdmin()
  const id = String(fd.get('id') ?? '')
  const note = String(fd.get('note') ?? '').trim() || null
  await db.update(schema.menuOptimizations).set({ status: 'done', completedAt: new Date(), note, updatedAt: new Date() }).where(eq(schema.menuOptimizations.id, id))
  revalidatePath('/admin')
}

// ---- Menu reads: provider + Zoodata platform key ----

export async function saveMenuReadProvider(fd: FormData) {
  const user = await requireAdmin()
  const provider = String(fd.get('provider') ?? 'firecrawl') === 'zoodata' ? 'zoodata' : 'firecrawl'
  await setSetting(SETTING_KEYS.menuReadProvider, provider, { userId: user.id })
  revalidatePath('/admin/settings')
}

export async function saveZoodataPlatformKey(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin()
  const key = String(fd.get('key') ?? '').trim()
  const url = String(fd.get('url') ?? '').trim() || ZOODATA_MENU_MCP_DEFAULT
  const tool = String(fd.get('tool') ?? '').trim() || ZOODATA_MENU_TOOL_DEFAULT
  if (key.length < 12) return { error: 'That key looks too short.' }
  if (!/^https:\/\//.test(url)) return { error: 'The MCP endpoint must be an https URL.' }
  let tools: string[]
  try { tools = await zoodataMenuTools({ url, key }) } catch (e) { return { error: `Zoodata rejected the key or endpoint: ${(e as Error).message.slice(0, 160)}` } }
  if (tools.length && !tools.includes(tool)) return { error: `Key verified, but this endpoint has no tool named "${tool}". Available: ${tools.slice(0, 12).join(', ')}` }
  await setSetting(SETTING_KEYS.zoodataPlatformKey, key, { secret: true, userId: user.id })
  await setSetting(SETTING_KEYS.zoodataMenuMcpUrl, url, { userId: user.id })
  await setSetting(SETTING_KEYS.zoodataMenuTool, tool, { userId: user.id })
  revalidatePath('/admin/settings')
  return { ok: `Key verified (${tools.length} tools listed) and saved.` }
}

export async function clearZoodataPlatformKey() {
  await requireAdmin()
  await deleteSetting(SETTING_KEYS.zoodataPlatformKey)
  revalidatePath('/admin/settings')
}

// ---- Ops browser: a live browser on the restaurant's saved login (menu work, support) ----

export async function openOpsBrowser(fd: FormData) {
  const user = await requireAdmin()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const platform = String(fd.get('platform') ?? '')
  if (platform !== 'uber_eats' && platform !== 'doordash') throw new Error('platform')
  const [row] = await db.insert(schema.opsHandoffs).values({ restaurantId, platform, requestedByUserId: user.id, note: 'Queued…' }).returning()
  await enqueueOpsHandoff(row!.id, 'start')
  revalidatePath(`/admin/${restaurantId}/portal`)
  redirect(`/admin/${restaurantId}/portal?platform=${platform}`)
}

export async function releaseOpsBrowser(fd: FormData) {
  await requireAdmin()
  const id = String(fd.get('id') ?? '')
  const restaurantId = String(fd.get('restaurantId') ?? '')
  await db.update(schema.opsHandoffs).set({ note: 'Releasing…', updatedAt: new Date() }).where(eq(schema.opsHandoffs.id, id))
  await enqueueOpsHandoff(id, 'release')
  revalidatePath(`/admin/${restaurantId}/portal`)
}

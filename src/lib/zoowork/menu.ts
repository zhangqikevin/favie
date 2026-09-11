import { and, eq } from 'drizzle-orm'
import { toolCall, type SessionEvent } from '@zoowork-ai/sdk'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'
import { streamTurn } from './streamTurn'
import { collectRun, localDate } from './collect'
import { descriptionFlags, photoFlags } from '@/lib/menu/diagnose'
import { dishPrompt, generateDishImage, imageGenerationAvailable } from '@/lib/ai/image'
import { putImage } from '@/lib/storage'
import { zoodataFor, toZoodataPlatform } from '@/lib/zoodata'
import type { Platform } from '@/lib/db/schema'

type MenuJob = typeof schema.menuJobs.$inferSelect
type MenuItem = typeof schema.menuItems.$inferSelect

const PLATFORM_LABEL: Record<Platform, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash' }

async function note(jobId: string, text: string, patch: Partial<typeof schema.menuJobs.$inferInsert> = {}) {
  await db.update(schema.menuJobs).set({ note: text.slice(0, 300), updatedAt: new Date(), ...patch }).where(eq(schema.menuJobs.id, jobId)).catch(() => {})
}
async function fail(jobId: string, error: string) {
  await db.update(schema.menuJobs).set({ status: 'failed', error: error.slice(0, 1000), updatedAt: new Date() }).where(eq(schema.menuJobs.id, jobId))
}

/** One agent turn recorded as a `menu` run; returns the assistant text. Mirrors runManualPrompt without the daily-summary collection. */
async function runAgentTurn(restaurantId: string, message: string, jobId: string, opts: { collect?: boolean; budgetMs?: number } = {}) {
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.restaurantId, restaurantId)).limit(1)
  if (!r) throw new Error('restaurant not found')
  if (!agent?.zooworkAgentId || agent.agentStatus !== 'ready') throw new Error(`agent not ready (${agent?.agentStatus ?? 'missing'})`)
  const zc = zoowork()
  const session = await logged('createSession.menu', agent.id, { chars: message.length, jobId }, () =>
    zc.createSession(agent.zooworkAgentId!, { initial_events: [{ type: 'user.message', content: message }], metadata: { kind: 'menu', restaurant_id: restaurantId, job_id: jobId } }))
  const [run] = await db.insert(schema.agentRuns).values({
    restaurantId, restaurantAgentId: agent.id, zooworkAgentId: agent.zooworkAgentId, zooworkSessionId: session.session_id,
    channel: 'api', kind: 'menu', status: 'running', runDate: localDate(new Date(), r.timezone), startedAt: new Date(),
  }).returning()
  await note(jobId, 'Agent started', { runId: run!.id, status: 'running' })
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), opts.budgetMs ?? 25 * 60_000)
  let res
  try {
    res = await streamTurn(zc, agent.zooworkAgentId, session.session_id, {
      signal: ctl.signal,
      onEvent: (ev: SessionEvent) => {
        const t = toolCall(ev)
        if (t?.phase === 'start') {
          const a = (t.args ?? {}) as Record<string, unknown>
          const line = t.toolName === 'browser' ? `${a.action ?? ''} ${a.url ?? a.selector ?? a.op ?? ''}` : t.toolName
          void note(jobId, line.trim())
        }
      },
    })
  } finally { clearTimeout(timer) }
  if (!res.outcome) {
    await zc.postEvents(agent.zooworkAgentId, session.session_id, [{ type: 'user.interrupt' }]).catch(() => {})
    await db.update(schema.agentRuns).set({ status: 'timed_out', finalText: res.text.slice(-20_000), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    throw new Error('the agent did not finish in time')
  }
  await db.update(schema.agentRuns).set({ status: 'finished', finalText: res.text.slice(-50_000), outcome: res.outcome, finishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
  if (opts.collect) {
    const [fresh] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run!.id)).limit(1)
    await collectRun(fresh!, r.timezone).catch(() => {})
  }
  return { text: res.text, outcome: res.outcome, runId: run!.id }
}

function fenced(text: string, lang: string): unknown | null {
  const re = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)\\n```', 'g')
  let last: string | null = null
  for (const m of text.matchAll(re)) last = m[1]
  if (!last) return null
  try { return JSON.parse(last) } catch { return null }
}

// ---------------------------------------------------------------------------------------------
// Pull

type PulledItem = { external_id?: string | null; category?: string | null; name: string; description?: string | null; price_cents?: number | null; image_url?: string | null; availability?: string | null; unit?: string | null; position?: number | null }

export async function runMenuPull(jobId: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job) return
  try {
    const message = `FAVIE_MENU_PULL ${job.platform}\nRead the complete ${PLATFORM_LABEL[job.platform]} menu of the store in the context and reply with the favie-menu block. Change nothing.`
    const { text } = await runAgentTurn(job.restaurantId, message, jobId, { budgetMs: 35 * 60_000 })
    const parsed = fenced(text, 'favie-menu') as { items?: PulledItem[]; truncated?: boolean } | null
    if (!parsed?.items) throw new Error('the agent did not return a favie-menu block')
    await note(jobId, `Read ${parsed.items.length} items; checking photos and descriptions…`)
    // Zoodata sales counts, when the restaurant has a key (matched by platform item id, then by name).
    const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    let sales: Awaited<ReturnType<ReturnType<typeof zoodataFor>['client']['getMenuItems']>> = []
    try { sales = (await zoodataFor(r!).client.getMenuItems()).filter((m) => m.platform === toZoodataPlatform(job.platform)) } catch { sales = [] }
    const byId = new Map(sales.filter((m) => m.platformItemId).map((m) => [m.platformItemId!, m]))
    const byName = new Map(sales.map((m) => [m.name.trim().toLowerCase(), m]))

    const now = new Date()
    const seen = new Set<string>()
    let i = 0
    for (const it of parsed.items) {
      if (!it?.name) continue
      i++
      const key = it.external_id ? `id:${it.external_id}` : `name:${(it.category ?? '').trim().toLowerCase()}/${it.name.trim().toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      const [photo, desc] = [await photoFlags(it.image_url), descriptionFlags(it.description)]
      const s = (it.external_id ? byId.get(it.external_id) : undefined) ?? byName.get(it.name.trim().toLowerCase())
      const values = {
        restaurantId: job.restaurantId, platform: job.platform, itemKey: key, externalId: it.external_id ?? null, category: it.category ?? null, name: it.name,
        description: it.description ?? null, priceCents: it.price_cents ?? s?.priceCents ?? null, imageUrl: photo.photoMissing ? null : (it.image_url ?? null),
        availability: it.availability ?? 'unknown', unit: it.unit ?? null, position: it.position ?? i, orderCnt: s?.orderCnt ?? null,
        raw: { pulled: it, photo }, pulledAt: now, photoMissing: photo.photoMissing, photoPoor: photo.photoPoor, descMissing: desc.descMissing, descThin: desc.descThin, updatedAt: now,
      }
      await db.insert(schema.menuItems).values(values).onConflictDoUpdate({
        target: [schema.menuItems.restaurantId, schema.menuItems.platform, schema.menuItems.itemKey],
        // Keep Favie's drafts and status; refresh what the platform shows.
        set: { externalId: values.externalId, category: values.category, name: values.name, description: values.description, priceCents: values.priceCents, imageUrl: values.imageUrl, availability: values.availability, unit: values.unit, position: values.position, orderCnt: values.orderCnt, raw: values.raw, pulledAt: now, photoMissing: values.photoMissing, photoPoor: values.photoPoor, descMissing: values.descMissing, descThin: values.descThin, updatedAt: now },
      })
      if (i % 20 === 0) await note(jobId, `Checked ${i} of ${parsed.items.length} items…`)
    }
    // Items that vanished from the platform menu are removed unless Favie has a pending draft on them.
    const stale = await db.select().from(schema.menuItems).where(and(eq(schema.menuItems.restaurantId, job.restaurantId), eq(schema.menuItems.platform, job.platform)))
    for (const row of stale) if (!seen.has(row.itemKey) && row.status !== 'draft' && row.status !== 'saving') await db.delete(schema.menuItems).where(eq(schema.menuItems.id, row.id))
    await note(jobId, parsed.truncated ? `Read ${seen.size} items (menu longer than the agent could finish)` : `Read ${seen.size} items`, { status: 'done' })
  } catch (e) {
    await fail(jobId, (e as Error).message)
  }
}

// ---------------------------------------------------------------------------------------------
// Generate (AI description + photo)

export async function runMenuGenerate(jobId: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job?.menuItemId) return
  const [item] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, job.menuItemId)).limit(1)
  if (!item) return
  try {
    const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    await note(jobId, 'Writing the description…', { status: 'running' })
    const message = `FAVIE_MENU_DESCRIBE\nRestaurant: ${r?.name ?? ''}${r?.cuisine ? ` (${r.cuisine})` : ''}.\nItems:\n- name: ${item.name}\n  category: ${item.category ?? ''}\n  current_description: ${item.description ?? '(none)'}\nReply with the favie-menu-text block only.`
    const { text } = await runAgentTurn(job.restaurantId, message, jobId, { budgetMs: 6 * 60_000 })
    const parsed = fenced(text, 'favie-menu-text') as { items?: { name: string; description_en?: string; description_zh?: string }[] } | null
    const got = parsed?.items?.[0]
    if (!got?.description_en) throw new Error('the agent did not return a description')
    const en = got.description_en.trim(), zh = (got.description_zh ?? '').trim()
    await db.update(schema.menuItems).set({ aiDescriptionEn: en, aiDescriptionZh: zh || null, draftDescription: zh ? `${en}\n${zh}` : en, status: 'draft', updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
    if (imageGenerationAvailable()) {
      await note(jobId, 'Generating the photo…')
      const img = await generateDishImage(dishPrompt(item.name, { category: item.category, cuisine: r?.cuisine, descriptionEn: en }))
      const url = await putImage(job.restaurantId, `${item.id}-ai-${Date.now()}.jpg`, img.bytes, img.contentType)
      await db.update(schema.menuItems).set({ aiImageUrl: url, draftImageUrl: url, updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
      await note(jobId, 'Description and photo ready', { status: 'done' })
    } else {
      await note(jobId, 'Description ready (photo generation not configured)', { status: 'done' })
    }
  } catch (e) {
    await fail(jobId, (e as Error).message)
  }
}

// ---------------------------------------------------------------------------------------------
// Save to the platform

export async function runMenuSave(jobId: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job?.menuItemId) return
  const [item] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, job.menuItemId)).limit(1)
  if (!item) return
  if (!item.draftDescription && !item.draftImageUrl) { await fail(jobId, 'nothing to save'); return }
  try {
    await db.update(schema.menuItems).set({ status: 'saving', lastError: null, updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
    const message = [
      `FAVIE_MENU_SAVE ${job.platform}`,
      `item: ${JSON.stringify({ name: item.name, category: item.category, external_id: item.externalId })}`,
      `description: ${item.draftDescription ? JSON.stringify(item.draftDescription) : 'null'}`,
      `image_url: ${item.draftImageUrl ? JSON.stringify(item.draftImageUrl) : 'null'}`,
      'Write exactly these values to this one item, change nothing else, then end with the favie-summary block.',
    ].join('\n')
    const { text } = await runAgentTurn(job.restaurantId, message, jobId, { collect: true, budgetMs: 15 * 60_000 })
    const ok = /"category":\s*"menu_item_updated"/.test(text)
    if (!ok) {
      const why = (text.match(/"reason":\s*"([^"]{0,300})/)?.[1]) ?? 'the agent did not confirm the save'
      throw new Error(why)
    }
    await db.update(schema.menuItems).set({
      status: 'saved', lastSavedAt: new Date(), lastError: null,
      description: item.draftDescription ?? item.description, imageUrl: item.draftImageUrl ?? item.imageUrl,
      photoMissing: item.draftImageUrl ? false : item.photoMissing, photoPoor: item.draftImageUrl ? false : item.photoPoor,
      ...(item.draftDescription ? descriptionFlags(item.draftDescription) : {}),
      updatedAt: new Date(),
    }).where(eq(schema.menuItems.id, item.id))
    await note(jobId, 'Saved to the platform', { status: 'done' })
  } catch (e) {
    await db.update(schema.menuItems).set({ status: 'failed', lastError: (e as Error).message.slice(0, 500), updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
    await fail(jobId, (e as Error).message)
  }
}

/** Shared by the API route and the pages: items grouped by category plus the diagnostics counters. */
export async function menuState(restaurantId: string, platform: Platform) {
  const [items, jobs] = await Promise.all([
    db.select().from(schema.menuItems).where(and(eq(schema.menuItems.restaurantId, restaurantId), eq(schema.menuItems.platform, platform))).orderBy(schema.menuItems.position),
    db.select().from(schema.menuJobs).where(and(eq(schema.menuJobs.restaurantId, restaurantId), eq(schema.menuJobs.platform, platform))).orderBy(schema.menuJobs.createdAt),
  ])
  const recent = jobs.slice(-40)
  const pull = [...recent].reverse().find((j) => j.kind === 'pull') ?? null
  const active = recent.filter((j) => j.status === 'queued' || j.status === 'running')
  const counts = {
    total: items.length,
    photoMissing: items.filter((i) => i.photoMissing && !i.draftImageUrl).length,
    photoPoor: items.filter((i) => i.photoPoor && !i.draftImageUrl).length,
    descMissing: items.filter((i) => i.descMissing && !i.draftDescription).length,
    descThin: items.filter((i) => i.descThin && !i.draftDescription).length,
    drafts: items.filter((i) => i.status === 'draft').length,
  }
  return { items: items as MenuItem[], pull: pull as MenuJob | null, active: active as MenuJob[], counts, imageGeneration: imageGenerationAvailable() }
}
export type MenuState = Awaited<ReturnType<typeof menuState>>

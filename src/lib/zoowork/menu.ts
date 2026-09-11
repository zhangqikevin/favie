import { and, eq, inArray, ne } from 'drizzle-orm'
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

/** Name key: NFKC folds CJK radical / compatibility variants (⽣ vs 生), then case and whitespace. */
const norm = (v: string | null | undefined) => (v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
/** Loose keys for matching a platform item name against Zoodata's copy of it: letters/digits only, and the
 *  English part alone ("Beef Rib Oil SplashedHand-Pulled Noodles" ≈ "Beef Rib Oil Splashed Hand-Pulled Noodles-牛肋骨油泼面"). */
function looseKeys(v: string | null | undefined): string[] {
  const n = norm(v)
  const all = n.replace(/[^\p{L}\p{N}]+/gu, '')
  const en = n.replace(/[\u3000-\u9fff\uf900-\ufaff].*$/u, '').replace(/[^\p{L}\p{N}]+/gu, '')
  return [all, en].filter((k, i, a) => k.length >= 4 && a.indexOf(k) === i)
}
/** Zoodata reports every item a handful of times; only a clear sales signal marks a missing item as hidden. */
const HIDDEN_MIN_ORDERS = 3

function fenced(text: string, lang: string): unknown | null {
  const re = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)\\n```', 'g')
  let last: string | null = null
  for (const m of text.matchAll(re)) last = m[1]
  if (!last) return null
  try { return JSON.parse(last) } catch { return null }
}

// ---------------------------------------------------------------------------------------------
// Pull

/**
 * Accept the block whether the agent followed the flat schema or nested items under categories, and map
 * the field names models tend to drift to (status/in_stock, price/price_dollars, image/photo_url…).
 */
function normalizeMenu(raw: unknown): { items: PulledItem[]; truncated: boolean } | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const out: PulledItem[] = []
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !Number.isNaN(Number(v.replace(/[$,]/g, ''))) ? Number(v.replace(/[$,]/g, '')) : null)
  const push = (it: Record<string, unknown>, category: string | null, idx: number) => {
    const name = String(it.name ?? it.title ?? '').trim()
    if (!name) return
    const price = num(it.price_cents) ?? (num(it.price) != null ? Math.round(num(it.price)! * (num(it.price)! < 500 && String(it.price).includes('.') ? 100 : 1)) : null)
    const statusRaw = String(it.availability ?? it.status ?? it.stock ?? 'unknown').toLowerCase()
    const availability = /sold|out/.test(statusRaw) ? 'sold_out' : /hid|inactive|off/.test(statusRaw) ? 'hidden' : /avail|in_stock|active|in stock/.test(statusRaw) ? 'available' : 'unknown'
    const img = (it.image_url ?? it.image ?? it.photo_url ?? it.photo ?? null) as string | null
    out.push({
      external_id: (it.external_id ?? it.id ?? it.item_id ?? null) as string | null, category: (it.category as string | undefined) ?? category, name,
      description: (it.description as string | null | undefined) ?? null, price_cents: price, image_url: img && /^https?:/.test(img) ? img : null,
      has_photo: typeof it.has_photo === 'boolean' ? it.has_photo : typeof it.hasPhoto === 'boolean' ? (it.hasPhoto as boolean) : img ? true : null,
      availability, unit: (it.unit as string | null | undefined) ?? null, position: num(it.position) ?? idx,
    })
  }
  if (Array.isArray(o.items)) o.items.forEach((it, i) => push(it as Record<string, unknown>, null, i + 1))
  if (Array.isArray(o.categories)) {
    let i = 0
    for (const c of o.categories as Record<string, unknown>[]) {
      const cname = String(c.name ?? c.category ?? '').trim() || null
      for (const it of (Array.isArray(c.items) ? c.items : []) as Record<string, unknown>[]) push(it, cname, ++i)
    }
  }
  if (!out.length) return null
  return { items: out, truncated: o.truncated === true }
}

type PulledItem = { external_id?: string | null; category?: string | null; name: string; description?: string | null; price_cents?: number | null; image_url?: string | null; has_photo?: boolean | null; availability?: string | null; unit?: string | null; position?: number | null }


/** Public storefront URL from the Zoodata store binding, when the restaurant has a key. */
/** Uber Eats canonical storefront: /store/<slug>/<base64url of the store uuid>. The slug is cosmetic. */
function ueStorefrontUrl(name: string, storeUuid: string) {
  const hex = storeUuid.replace(/-/g, '')
  const short = /^[0-9a-f]{32}$/i.test(hex) ? Buffer.from(hex, 'hex').toString('base64url') : storeUuid
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store'
  return `https://www.ubereats.com/store/${slug}/${short}`
}

async function storefrontUrl(r: typeof schema.restaurants.$inferSelect, platform: Platform): Promise<string | null> {
  const [conn] = await db.select({ storeId: schema.platformConnections.storeExternalId }).from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform))).limit(1)
  if (conn?.storeId) return platform === 'doordash' ? `https://www.doordash.com/store/${conn.storeId}/` : ueStorefrontUrl(r.name, conn.storeId)
  try {
    const list = await zoodataFor(r).client.listRestaurants()
    const want = toZoodataPlatform(platform)
    for (const z of list) for (const b of z.platformBindings) if (b.platform === want && b.platformStoreId) {
      return platform === 'doordash' ? `https://www.doordash.com/store/${b.platformStoreId}/` : ueStorefrontUrl(r.name, b.platformStoreId)
    }
  } catch {}
  return null
}

/** One browser per agent: wait until no other pull/save job for this restaurant is running. */
async function waitForAgentBrowser(restaurantId: string, jobId: string, maxMs = 30 * 60_000) {
  const started = Date.now()
  let noted = false
  for (;;) {
    const busy = await db.select({ id: schema.menuJobs.id }).from(schema.menuJobs)
      .where(and(eq(schema.menuJobs.restaurantId, restaurantId), eq(schema.menuJobs.status, 'running'), ne(schema.menuJobs.id, jobId), inArray(schema.menuJobs.kind, ['pull', 'save'])))
      .limit(1)
    if (!busy.length) return
    if (Date.now() - started > maxMs) throw new Error('another Favie browser task on this restaurant did not finish in time')
    if (!noted) { noted = true; await db.update(schema.menuJobs).set({ note: 'Waiting for another Favie task on this restaurant…', updatedAt: new Date() }).where(eq(schema.menuJobs.id, jobId)) }
    await new Promise((r) => setTimeout(r, 5000))
  }
}

export async function runMenuPull(jobId: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job) return
  try {
    await waitForAgentBrowser(job.restaurantId, jobId)
    const [rr] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    const url = rr ? await storefrontUrl(rr, job.platform) : null
    const message = [
      `FAVIE_MENU_PULL ${job.platform}`,
      url ? `storefront_url: ${url}` : 'storefront_url: unknown — open the merchant portal and follow its "View store" / "Preview menu" link.',
      `Read the complete ${PLATFORM_LABEL[job.platform]} menu from the public storefront as the skill describes (scroll + snapshot rounds,`,
      'no item clicks, skip Featured / Most Ordered carousels). Change nothing. Reply with ONE ```favie-menu``` block: flat `items`',
      'array, each item with its own `category`, `description` (null if none), `has_photo`, `price_cents`, `availability`.',
    ].join('\n')
    const { text } = await runAgentTurn(job.restaurantId, message, jobId, { budgetMs: 35 * 60_000 })
    await ingestMenu(jobId, text)
  } catch (e) {
    await fail(jobId, (e as Error).message)
  }
}

/** Turn the agent's reply into menu_items rows (also used to re-ingest a stored reply without a new browser run). */
export async function ingestMenu(jobId: string, text: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job) return
  try {
    const parsed = normalizeMenu(fenced(text, 'favie-menu') ?? fenced(text, 'json'))
    if (!parsed) throw new Error('the agent did not return a favie-menu block')
    await note(jobId, `Read ${parsed.items.length} items; checking photos and descriptions…`, { status: 'running' })
    // Zoodata sales counts, when the restaurant has a key (matched by platform item id, then by name).
    const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    let sales: Awaited<ReturnType<ReturnType<typeof zoodataFor>['client']['getMenuItems']>> = []
    try { sales = (await zoodataFor(r!).client.getMenuItems()).filter((m) => m.platform === toZoodataPlatform(job.platform)) } catch { sales = [] }
    const byId = new Map(sales.filter((m) => m.platformItemId).map((m) => [m.platformItemId!, m]))
    const byName = new Map<string, (typeof sales)[number]>()
    for (const m of sales) for (const k of looseKeys(m.name)) if (!byName.has(k)) byName.set(k, m)
    const findSale = (name: string) => { for (const k of looseKeys(name)) { const m = byName.get(k); if (m) return m } }

    const now = new Date()
    const seen = new Set<string>()
    let i = 0
    for (const it of parsed.items) {
      if (!it?.name) continue
      i++
      const key = it.external_id ? `id:${it.external_id}` : `name:${norm(it.category)}/${norm(it.name)}`
      if (seen.has(key)) continue
      seen.add(key)
      const photo = it.image_url ? await photoFlags(it.image_url) : { photoMissing: it.has_photo === false, photoPoor: false }
      const desc = descriptionFlags(it.description)
      const s = (it.external_id ? byId.get(it.external_id) : undefined) ?? findSale(it.name)
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
    // Items Zoodata saw selling recently but the storefront does not show are hidden (or removed) on the platform.
    const seenNames = new Set(parsed.items.flatMap((x) => looseKeys(x.name)))
    let hidden = 0
    for (const m of sales) {
      if (!m.orderCnt || m.orderCnt < HIDDEN_MIN_ORDERS || looseKeys(m.name).some((k) => seenNames.has(k))) continue
      if (/^(add|extra|choose|select|no |with )/i.test(m.name)) continue // modifiers, not items
      const key = `name:${norm(m.category)}/${norm(m.name)}`
      if (seen.has(key)) continue
      seen.add(key); hidden++
      const values = { restaurantId: job.restaurantId, platform: job.platform, itemKey: key, externalId: m.platformItemId, category: m.category, name: m.name, description: null, priceCents: m.priceCents, imageUrl: null, availability: 'hidden', unit: null, position: 9000 + hidden, orderCnt: m.orderCnt, raw: { from: 'zoodata' }, pulledAt: now, photoMissing: false, photoPoor: false, descMissing: false, descThin: false, updatedAt: now }
      await db.insert(schema.menuItems).values(values).onConflictDoUpdate({ target: [schema.menuItems.restaurantId, schema.menuItems.platform, schema.menuItems.itemKey], set: { availability: 'hidden', orderCnt: m.orderCnt, pulledAt: now, updatedAt: now } })
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

/** Models drift: accept description_en/description_zh, en/zh, or one combined string (split on the first CJK run). */
function splitBilingual(got: Record<string, unknown> | undefined): { en: string; zh: string } {
  if (!got) return { en: '', zh: '' }
  const str = (k: string) => (typeof got[k] === 'string' ? (got[k] as string).trim() : '')
  let en = str('description_en') || str('en') || str('english'), zh = str('description_zh') || str('zh') || str('chinese')
  if (!en || !zh) {
    const combined = str('description') || str('text')
    if (combined) {
      const m = combined.match(/[㐀-鿿]/)
      if (m && m.index != null && m.index > 0) { en ||= combined.slice(0, m.index).trim(); zh ||= combined.slice(m.index).trim() }
      else en ||= combined
    }
  }
  return { en, zh }
}

export async function runMenuGenerate(jobId: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job?.menuItemId) return
  const [item] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, job.menuItemId)).limit(1)
  if (!item) return
  try {
    const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    await note(jobId, 'Writing the description…', { status: 'running' })
    const message = [
      'FAVIE_MENU_DESCRIBE',
      `Restaurant: ${r?.name ?? ''}${r?.cuisine ? ` (${r.cuisine})` : ''}.`,
      'Items:',
      `- name: ${item.name}`,
      `  category: ${item.category ?? ''}`,
      `  current_description: ${item.description ?? '(none)'}`,
      'Reply with ONE ```favie-menu-text``` block and nothing else, exactly this shape — two SEPARATE fields, English in',
      '`description_en` and Chinese in `description_zh` (never combined into one string):',
      '{ "items": [ { "name": "<same name>", "description_en": "3-4 sentences in English", "description_zh": "3-4 句中文" } ] }',
    ].join('\n')
    const { text } = await runAgentTurn(job.restaurantId, message, jobId, { budgetMs: 6 * 60_000 })
    const parsed = (fenced(text, 'favie-menu-text') ?? fenced(text, 'json')) as { items?: Record<string, unknown>[] } | null
    const got = parsed?.items?.[0]
    const { en, zh } = splitBilingual(got)
    if (!en) throw new Error('the agent did not return a description')
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
    await waitForAgentBrowser(job.restaurantId, jobId)
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

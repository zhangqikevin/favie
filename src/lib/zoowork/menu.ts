import { and, eq, inArray, isNotNull, ne, sql, desc } from 'drizzle-orm'
import { canonicalStorefrontUrl, firecrawlKey, readStorefront, searchStorefront } from '@/lib/menu/firecrawl'
import { menuReadConfig } from '@/lib/menu/provider'
import { readStorefrontViaZoodata } from '@/lib/menu/zoodata-menu'
import { menuDescribePrompt, menuImageModel } from '@/lib/menu/prompts'
import { generateDishImageViaAgent } from './menu-image'
import { buildApplyScript } from '@/lib/menu/recipes'
import { toolCall, type SessionEvent } from '@zoowork-ai/sdk'
import { db, schema } from '@/lib/db/client'
import { activeOpsHandoff, releaseOpsHandoffs, resolveLoginLabel, PORTAL_URL } from './handoff'
import { storefrontFromId } from '@/server/connections/transitions'
import { zoowork, logged } from './client'
import { streamTurn } from './streamTurn'
import { collectRun, localDate } from './collect'
import { descriptionFlags, photoFlags } from '@/lib/menu/diagnose'
import { dishPrompt, generateDishImage, imageGenerationAvailable, directOpenAiAvailable } from '@/lib/ai/image'
import { putImage } from '@/lib/storage'
import { zoodataFor, toZoodataPlatform } from '@/lib/zoodata'
import type { Platform } from '@/lib/db/schema'

type MenuJob = typeof schema.menuJobs.$inferSelect
type MenuItem = typeof schema.menuItems.$inferSelect

const PLATFORM_LABEL: Record<Platform, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash' }

// A job the owner cancelled (error = 'cancelled') stays cancelled: late progress notes and failures never revive it.
const notCancelled = sql`${schema.menuJobs.error} is distinct from 'cancelled'`
async function note(jobId: string, text: string, patch: Partial<typeof schema.menuJobs.$inferInsert> = {}) {
  await db.update(schema.menuJobs).set({ note: text.slice(0, 300), updatedAt: new Date(), ...patch }).where(and(eq(schema.menuJobs.id, jobId), notCancelled)).catch(() => {})
}
async function fail(jobId: string, error: string) {
  await db.update(schema.menuJobs).set({ status: 'failed', error: error.slice(0, 1000), updatedAt: new Date() }).where(and(eq(schema.menuJobs.id, jobId), notCancelled))
}
/** The owner pressed × while the AI was working: whatever comes back must not overwrite what they typed meanwhile. */
async function wasCancelled(jobId: string) {
  const [j] = await db.select({ error: schema.menuJobs.error }).from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  return j?.error === 'cancelled'
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
  // The model sometimes hands its final block to the `message` tool instead of writing it as its reply;
  // that text never reaches the assistant transcript, so capture it here and append it.
  const misdelivered: string[] = []
  try {
    res = await streamTurn(zc, agent.zooworkAgentId, session.session_id, {
      signal: ctl.signal,
      onEvent: (ev: SessionEvent) => {
        const t = toolCall(ev)
        if (t?.phase === 'start') {
          const a = (t.args ?? {}) as Record<string, unknown>
          if (t.toolName === 'message' && typeof a.message === 'string') misdelivered.push(a.message)
          // Tool-call details stay in agent_runs / the admin run view; owners only see the step-level notes.
        }
      },
    })
  } finally { clearTimeout(timer) }
  if (misdelivered.length) res = { ...res, text: `${res.text}\n${misdelivered.join('\n')}` }
  if (!res.outcome) {
    await zc.postEvents(agent.zooworkAgentId, session.session_id, [{ type: 'user.interrupt' }]).catch(() => {})
    await db.update(schema.agentRuns).set({ status: 'timed_out', finalText: res.text.slice(-20_000), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    throw new Error('the agent did not finish in time')
  }
  await db.update(schema.agentRuns).set({ status: 'finished', finalText: res.text.slice(-50_000), outcome: res.outcome, finishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
  if (res.outcome === 'failed' && !res.text.trim()) {
    // The run died before the model answered (e.g. ZooWork "402 insufficient credits"): surface the
    // platform's message instead of a generic "did not return …" downstream.
    const evs = await zc.listAllEvents(agent.zooworkAgentId, session.session_id).catch(() => [])
    const err = (evs.find((e) => e.eventType === 'agent.error')?.payload as { errorMessage?: string } | undefined)?.errorMessage
    throw new Error(`Favie's AI service failed: ${(err ?? 'unknown error').slice(0, 300)}`)
  }
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
function normalizeMenu(raw: unknown): { items: PulledItem[]; truncated: boolean; storefrontUrl: string | null } | null {
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
  // Promo carousels repeat real items; drop them here so the agent's compliance does not matter.
  const CAROUSEL = /^(featured items?|most ordered|popular items?|save on select items|frequently bought|recommended|buy 1,? get 1|picked for you)/i
  const real = out.filter((it) => !(it.category && CAROUSEL.test(it.category.trim())))
  const kept = real.length ? real : out
  if (!kept.length) return null
  out.length = 0; out.push(...kept)
  const su = typeof o.storefront_url === 'string' && /^https:\/\/(www\.)?(doordash|ubereats)\.com\/store\//i.test(o.storefront_url) ? o.storefront_url.split('?')[0] : null
  return { items: out, truncated: o.truncated === true, storefrontUrl: su }
}

export type PulledItem = { external_id?: string | null; category?: string | null; name: string; description?: string | null; price_cents?: number | null; image_url?: string | null; has_photo?: boolean | null; availability?: string | null; unit?: string | null; position?: number | null; rating?: { pct: number; count: number } }


/** Public storefront URL from the Zoodata store binding, when the restaurant has a key. */
/**
 * Public store page for a connection: confirmed URL → Uber Eats store uuid from the connection →
 * Zoodata binding (real key only). Null means the caller should search (or fall back to the agent).
 */
/** The store's name on THIS platform (it can differ from the restaurant's canonical Uber Eats name). */
async function storeNameFor(r: typeof schema.restaurants.$inferSelect, platform: Platform): Promise<string> {
  const [conn] = await db.select({ name: schema.platformConnections.storeName }).from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform))).limit(1)
  return conn?.name ?? r.name
}

async function storefrontUrl(r: typeof schema.restaurants.$inferSelect, platform: Platform): Promise<string | null> {
  const [conn] = await db.select({ storeId: schema.platformConnections.storeExternalId, url: schema.platformConnections.storefrontUrl, name: schema.platformConnections.storeName }).from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform))).limit(1)
  if (conn?.url) return conn.url
  const name = conn?.name ?? r.name
  // Uber Eats store ids are uuids, so the saved one is safe to use. DoorDash's saved id may be the business id, not the store.
  if (platform === 'uber_eats' && conn?.storeId && /^[0-9a-f-]{36}$/i.test(conn.storeId)) return canonicalStorefrontUrl('uber_eats', conn.storeId, name)
  try {
    const zd = zoodataFor(r)
    if (zd.source !== 'zoodata') return null // sample data must never point at another store
    const list = await zd.client.listRestaurants()
    const want = toZoodataPlatform(platform)
    for (const z of list) for (const b of z.platformBindings) if (b.platform === want && b.platformStoreId) return canonicalStorefrontUrl(platform, b.platformStoreId, name)
  } catch {}
  return null
}

/** Same store? Loose comparison of the storefront's own title with the name we have on file. */
function sameStore(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return true // nothing to compare against
  const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N}]+/gu, '')
  const x = norm(a), y = norm(b)
  if (!x || !y) return true
  if (x.includes(y) || y.includes(x)) return true
  // English part only (Chinese names are often appended differently on the storefront)
  const en = (s: string) => s.replace(/[^a-z0-9]/g, '')
  const ex = en(x), ey = en(y)
  return ex.length >= 5 && ey.length >= 5 && (ex.includes(ey) || ey.includes(ex))
}

/**
 * The owner is logged in, so the agent can read the store id straight from the merchant portal URL
 * (Uber Eats: uuid in the path; DoorDash: `store_id=` query parameter) — no web search, no picker.
 * One short browser turn (~30 s).
 */
async function storeIdFromPortal(r: typeof schema.restaurants.$inferSelect, platform: Platform, jobId: string): Promise<string | null> {
  const label = await resolveLoginLabel(r.id)
  const storeName = await storeNameFor(r, platform)
  // Accounts with several stores: the portal opens on whichever store was used last, and on Uber Eats the
  // home URL can keep the previous store's uuid after a switch. So: switch first, then read the id from a
  // page that is per-store, and report the store name shown next to it so the backend can verify.
  const message = [
    `FAVIE_STORE_URL ${platform}. Read the id of ONE store from the merchant portal URL. No context fetch, change nothing, type nothing except in the store switcher's search box.`,
    `1. browser action "session" op "restart" with loginLabel "${label}" and egressCountry "US".`,
    `2. browser action "navigate" to ${PORTAL_URL[platform]}; act kind "wait" 4 seconds; snapshot (mode "efficient").`,
    `3. Open the store / location switcher and select exactly "${storeName}". If the account has a single store, skip this. Wait 3 seconds after selecting.`,
    platform === 'doordash'
      ? '4. Click "Menu" (Menu Manager) or "Orders" in the sidebar, wait 4 seconds, snapshot. The store id is the `store_id=` query parameter of THAT URL. Ignore the number in the store switcher (business id).'
      : '4. browser action "navigate" to https://merchants.ubereats.com/manager/menumaker, wait 4 seconds, snapshot. The store id is the UUID path segment of THAT URL (/manager/menumaker/<uuid>); if the URL has no uuid, select the store again in the switcher on this page and re-read.',
    '5. Read the store name shown as selected on that page (header or switcher).',
    '6. Close the browser session (action "session" op "close"). Reply with exactly one line: STORE <id> | <store name shown> | <current url>. If you cannot find it, reply: STORE none | <store name shown> | <current url>.',
  ].join('\n')
  await note(jobId, 'Reading the store id from your merchant portal…')
  const { text } = await runAgentTurn(r.id, message, jobId, { budgetMs: 5 * 60_000 })
  const m = /STORE\s+([A-Za-z0-9-]+)\s*\|\s*([^|\n]*)\|/.exec(text) ?? /STORE\s+([A-Za-z0-9-]+)/.exec(text)
  const id = m && m[1] !== 'none' ? m[1] : null
  const shown = m?.[2]?.trim() || null
  if (!id || !storefrontFromId(platform, id, storeName)) return null
  // A different store's id is worse than none: the daily run and Menu Clinic would act on that store.
  if (shown && !sameStore(shown, storeName)) { console.warn('[menuPull] portal showed another store selected; ignoring id', shown, 'wanted', storeName); return null }
  return id
}

/**
 * No URL on file: web-search the store page. Exactly one candidate (or one matching a store id we know)
 * is confirmed automatically; several are stored for the owner to pick in Menu Clinic.
 */
async function discoverStorefront(r: typeof schema.restaurants.$inferSelect, platform: Platform, key: string): Promise<{ url: string } | { candidates: number }> {
  const [conn] = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform))).limit(1)
  const cands = await searchStorefront(key, platform, conn?.storeName ?? r.name, r.city)
  const known = conn?.storeExternalId?.toLowerCase()
  // Chains list one page per location ("Tigawok Mini Bowls (Irvine)" / "(Burbank)"): the connection's store
  // name includes the location, so a title that contains the whole name — location kept — is a safe pick.
  const strict = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  const want = conn?.storeName ? strict(conn.storeName) : ''
  const byName = want.length >= 6 ? cands.filter((c) => strict(c.title ?? '').includes(want)) : []
  const pick = cands.length === 1 ? cands[0] : cands.find((c) => known && c.storeId.toLowerCase() === known) ?? (byName.length === 1 ? byName[0] : undefined)
  const where = and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform))
  if (pick) {
    await db.update(schema.platformConnections).set({ storefrontUrl: pick.url, storefrontCandidates: null, updatedAt: new Date() }).where(where)
    return { url: pick.url }
  }
  await db.update(schema.platformConnections).set({ storefrontCandidates: cands, updatedAt: new Date() }).where(where)
  return { candidates: cands.length }
}

/** One browser per agent: wait until no other pull/save job for this restaurant is running. */
async function waitForAgentBrowser(restaurantId: string, jobId: string, maxMs = 30 * 60_000) {
  const started = Date.now()
  let noted: string | null = null
  const say = async (n: string) => { if (noted !== n) { noted = n; await db.update(schema.menuJobs).set({ note: n, updatedAt: new Date() }).where(eq(schema.menuJobs.id, jobId)) } }
  for (;;) {
    // Expired ops browsers (Favie's team) are closed right away; a live one is waited for like any other task.
    await releaseOpsHandoffs(restaurantId).catch(() => {})
    if (await activeOpsHandoff(restaurantId)) {
      if (Date.now() - started > maxMs) throw new Error('the Favie team is working in this restaurant\'s browser; try again later')
      await say('Favie is working on this menu in the portal right now; this task waits until they are done…')
      await new Promise((r) => setTimeout(r, 10_000))
      continue
    }
    const busy = await db.select({ id: schema.menuJobs.id }).from(schema.menuJobs)
      .where(and(eq(schema.menuJobs.restaurantId, restaurantId), eq(schema.menuJobs.status, 'running'), ne(schema.menuJobs.id, jobId), inArray(schema.menuJobs.kind, ['pull', 'save', 'apply'])))
      .limit(1)
    if (!busy.length) return
    if (Date.now() - started > maxMs) throw new Error('another Favie browser task on this restaurant did not finish in time')
    await say('Waiting for another Favie task on this restaurant…')
    await new Promise((r) => setTimeout(r, 5000))
  }
}

/** Photo URLs: one no-browser agent turn (web_fetch → markdown with image links), merged into menu_items by name. */
export async function runMenuPhotos(jobId: string, restaurantId: string, platform: Platform, url: string) {
  await note(jobId, 'Collecting photo links…')
  const message = [
    `FAVIE_MENU_PHOTOS ${platform}`,
    `storefront_url: ${url}`,
    'No browser, no context fetch, change nothing. Call web_fetch ONCE on storefront_url with extractMode "markdown" and',
    'maxChars 200000. The markdown shape varies (`![name](url)`, `[![name](url)](link)`, images inside list items or next to',
    'headings). Collect EVERY dish image: the dish name is the image alt text or the nearest item name, the URL is the image',
    'address verbatim (Uber Eats: tb-static.uber.com; DoorDash: img.cdn4dd.com / doordash-static). Skip store header, logo,',
    'banner and promo images. If the fetch is truncated, return what you have. Reply with exactly one block:',
    '```favie-menu-photos',
    '{ "items": [ { "name": "exact item name from the ### heading", "image_url": "https://…" } ] }',
    '```',
  ].join('\n')
  const { text } = await runAgentTurn(restaurantId, message, jobId, { budgetMs: 6 * 60_000 })
  const block = fenced(text, 'favie-menu-photos') ?? fenced(text, 'json')
  const list = Array.isArray((block as { items?: unknown } | null)?.items) ? ((block as { items: unknown[] }).items as { name?: unknown; image_url?: unknown }[]) : []
  const rows = await db.select({ id: schema.menuItems.id, name: schema.menuItems.name, imageUrl: schema.menuItems.imageUrl })
    .from(schema.menuItems).where(and(eq(schema.menuItems.restaurantId, restaurantId), eq(schema.menuItems.platform, platform)))
  const byKey = new Map<string, typeof rows[number]>()
  for (const r of rows) for (const k of looseKeys(r.name)) if (!byKey.has(k)) byKey.set(k, r)
  let matched = 0
  for (const it of list) {
    const name = typeof it.name === 'string' ? it.name : ''
    const img = typeof it.image_url === 'string' && /^https?:\/\//.test(it.image_url) ? it.image_url : null
    if (!name || !img) continue
    let row: typeof rows[number] | undefined
    for (const k of looseKeys(name)) { row = byKey.get(k); if (row) break }
    if (!row) continue
    const photo = await photoFlags(img)
    await db.update(schema.menuItems).set({ imageUrl: img, photoMissing: false, photoPoor: photo.photoPoor, updatedAt: new Date() }).where(eq(schema.menuItems.id, row.id))
    matched++
  }
  return { listed: list.length, matched, total: rows.length }
}

export async function runMenuPull(jobId: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job) return
  try {
    const [rr] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    if (!rr) throw new Error('restaurant not found')
    const cfg = await menuReadConfig()
    const key = cfg.firecrawlKey // web search for the store page still goes through Firecrawl when a key exists
    const connWhere = and(eq(schema.platformConnections.restaurantId, job.restaurantId), eq(schema.platformConnections.platform, job.platform))
    const [conn0] = await db.select().from(schema.platformConnections).where(connWhere).limit(1)
    let url = await storefrontUrl(rr, job.platform)
    let pendingStoreId: string | null = null
    let candidates = 0
    if (!url && key) {
      await note(jobId, 'Finding the store page…', { status: 'running' })
      const found = await discoverStorefront(rr, job.platform, key)
      if ('url' in found) url = found.url
      else candidates = found.candidates
    }
    // Still ambiguous or unknown: the owner is logged in, so read the store id from the portal URL and
    // build the page from it — the picker is only the very last resort.
    if (!url && conn0?.status === 'connected') {
      await waitForAgentBrowser(job.restaurantId, jobId)
      const id = await storeIdFromPortal(rr, job.platform, jobId).catch((e) => { console.warn('[menuPull] store id read failed:', (e as Error).message); return null })
      if (id) {
        url = storefrontFromId(job.platform, id, conn0?.storeName ?? rr.name)
        pendingStoreId = id // saved only once the store page's title matches (below)
      }
    }
    if (!url && candidates > 0) { await fail(jobId, 'Several stores match this name — pick yours in Menu Clinic, then read again.'); return }
    // Fast path: server-side read of the public store page (seconds, with photo URLs and item ids), through the
    // provider chosen in /admin/settings; Zoodata falls back to Firecrawl, and both fall back to the agent's browser.
    const useZoodata = cfg.provider === 'zoodata' && !!cfg.zoodata.key
    if (url && (key || useZoodata)) {
      try {
        await note(jobId, 'Reading the store page…', { status: 'running' })
        const t0 = Date.now()
        let menu: Awaited<ReturnType<typeof readStorefront>>
        if (useZoodata) {
          try { menu = await readStorefrontViaZoodata({ url: cfg.zoodata.url, key: cfg.zoodata.key!, tool: cfg.zoodata.tool }, job.platform, url) }
          catch (e) { console.warn('[menuPull] zoodata menu read failed, trying firecrawl:', (e as Error).message); if (!key) throw e; menu = await readStorefront(key, job.platform, url) }
          if (menu.items.length < 3 && key) menu = await readStorefront(key, job.platform, url)
        } else menu = await readStorefront(key!, job.platform, url)
        menu.ms = Date.now() - t0
        if (menu.items.length >= 3 && !sameStore(menu.storeName, conn0?.storeName)) {
          // A wrong id (a DoorDash business id, the uuid of another store in a multi-store Uber Eats account)
          // points at another restaurant's page: never ingest it, and stop trusting the id it came from.
          console.warn('[menuPull] storefront title does not match the connected store; discarding url', url, menu.storeName, conn0?.storeName)
          const fromStoredId = !!conn0?.storeExternalId && url === storefrontFromId(job.platform, conn0.storeExternalId, conn0.storeName ?? rr.name)
          await db.update(schema.platformConnections).set({ storefrontUrl: null, ...(fromStoredId ? { storeExternalId: null } : {}), updatedAt: new Date() }).where(connWhere)
          await fail(jobId, `The store page found (${menu.storeName ?? url}) does not look like ${conn0?.storeName ?? 'your store'}. Please read again — Favie will look it up from your merchant portal.`)
          return
        }
        if (menu.items.length >= 3) {
          await db.update(schema.platformConnections).set({ storefrontUrl: url, storefrontCandidates: null, ...(pendingStoreId ? { storeExternalId: pendingStoreId } : {}), updatedAt: new Date() })
            .where(and(eq(schema.platformConnections.restaurantId, job.restaurantId), eq(schema.platformConnections.platform, job.platform)))
          const block = JSON.stringify({ favie_menu_version: 1, platform: job.platform, store_name: menu.storeName, storefront_url: url, truncated: false, items: menu.items })
          await ingestMenu(jobId, '```favie-menu\n' + block + '\n```', { source: useZoodata ? 'zoodata' : 'firecrawl', ms: menu.ms })
          return
        }
        console.warn('[menuPull] firecrawl read too small, using the agent', menu.items.length, url)
      } catch (e) { console.warn('[menuPull] firecrawl failed, using the agent:', (e as Error).message) }
    }
    // Slow path: the agent's browser (skill protocol), then a separate no-browser turn for photo URLs.
    await waitForAgentBrowser(job.restaurantId, jobId)
    const message = [
      `FAVIE_MENU_PULL ${job.platform}`,
      url ? `storefront_url: ${url}` : 'storefront_url: unknown — open the merchant portal and follow its "View store" / "Preview menu" link.',
      `Read the complete ${PLATFORM_LABEL[job.platform]} menu from the public storefront as the skill describes (scroll + snapshot rounds,`,
      'no item clicks, skip Featured / Most Ordered carousels, no web_fetch — photos are collected separately). Change nothing.',
      'Reply with ONE ```favie-menu``` block: `storefront_url` plus a flat `items` array, each item with its own `category`,',
      '`description` (null if none), `has_photo`, `price_cents`, `availability`.',
    ].join('\n')
    const { text } = await runAgentTurn(job.restaurantId, message, jobId, { budgetMs: 35 * 60_000 })
    await ingestMenu(jobId, text)
    const [fresh] = await db.select({ status: schema.menuJobs.status, note: schema.menuJobs.note }).from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
    const [conn] = await db.select({ url: schema.platformConnections.storefrontUrl }).from(schema.platformConnections)
      .where(and(eq(schema.platformConnections.restaurantId, job.restaurantId), eq(schema.platformConnections.platform, job.platform))).limit(1)
    const photoUrl = conn?.url ?? url
    if (fresh?.status === 'done' && photoUrl) {
      try {
        const res = await runMenuPhotos(jobId, job.restaurantId, job.platform, photoUrl)
        await note(jobId, `${fresh.note ?? 'Read menu'} · photos for ${res.matched} of ${res.total}`, { status: 'done' })
      } catch (e) { console.warn('[menuPull] photo step failed:', (e as Error).message); await note(jobId, fresh.note ?? 'Read menu', { status: 'done' }) }
    }
  } catch (e) {
    await fail(jobId, (e as Error).message)
  }
}

export async function ingestMenu(jobId: string, text: string, meta: { source?: 'firecrawl' | 'agent' | 'zoodata'; ms?: number } = {}) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job) return
  try {
    const parsed = normalizeMenu(fenced(text, 'favie-menu') ?? fenced(text, 'json'))
    if (!parsed) throw new Error('the agent did not return a favie-menu block')
    await note(jobId, `Read ${parsed.items.length} items; checking photos and descriptions…`, { status: 'running' })
    if (parsed.storefrontUrl) await db.update(schema.platformConnections).set({ storefrontUrl: parsed.storefrontUrl, updatedAt: new Date() })
      .where(and(eq(schema.platformConnections.restaurantId, job.restaurantId), eq(schema.platformConnections.platform, job.platform)))
    // Zoodata sales counts, when the restaurant has a key (matched by platform item id, then by name).
    const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    let sales: Awaited<ReturnType<ReturnType<typeof zoodataFor>['client']['getMenuItems']>> = []
    const zd = zoodataFor(r!)
    if (zd.source === 'zoodata') { try { sales = (await zd.client.getMenuItems()).filter((m) => m.platform === toZoodataPlatform(job.platform)) } catch { sales = [] } }
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
      const key = `name:${norm(it.category)}/${norm(it.name)}` // stable across read methods; external_id is kept as data
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
    for (const row of stale) {
      if (seen.has(row.itemKey) || row.status === 'draft' || row.status === 'saving' || row.status === 'queued') continue
      // Old generate/apply jobs still point at the item (foreign key): detach them first. One stubborn row must
      // never fail the whole read — the menu itself was ingested fine (seen: "Rose Milk" left the menu with 2 jobs).
      try {
        await db.update(schema.menuJobs).set({ menuItemId: null }).where(eq(schema.menuJobs.menuItemId, row.id))
        await db.delete(schema.menuItems).where(eq(schema.menuItems.id, row.id))
      } catch (e) { console.warn('[menuPull] could not remove vanished item', row.id, (e as Error).message.slice(0, 120)) }
    }
    const withPhoto = await db.$count(schema.menuItems, and(eq(schema.menuItems.restaurantId, job.restaurantId), eq(schema.menuItems.platform, job.platform), isNotNull(schema.menuItems.imageUrl)))
    const tail = meta.source === 'firecrawl' ? ` · photos for ${withPhoto} of ${seen.size} · ${Math.round((meta.ms ?? 0) / 1000)}s` : ''
    await note(jobId, parsed.truncated ? `Read ${seen.size} items (menu longer than the agent could finish)` : `Read ${seen.size} items${tail}`, { status: 'done' })
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

/**
 * 2–3 of the restaurant's OWN platform photos to hand the image model as style references: same platform,
 * same category first (then any category), best sellers first, never Favie-generated pictures. Empty when
 * the menu has no usable photos — the prompt then drops the style-reference paragraph.
 */
export async function referencePhotos(item: typeof schema.menuItems.$inferSelect, max = 3): Promise<string[]> {
  const rows = await db.select({ id: schema.menuItems.id, category: schema.menuItems.category, imageUrl: schema.menuItems.imageUrl, aiImageUrl: schema.menuItems.aiImageUrl, orderCnt: schema.menuItems.orderCnt, status: schema.menuItems.status })
    .from(schema.menuItems)
    .where(and(eq(schema.menuItems.restaurantId, item.restaurantId), eq(schema.menuItems.platform, item.platform), isNotNull(schema.menuItems.imageUrl), ne(schema.menuItems.id, item.id)))
  const real = rows.filter((x) => x.imageUrl && x.imageUrl !== x.aiImageUrl && !/supabase\.co\//.test(x.imageUrl) && /^https:\/\//.test(x.imageUrl))
  const rank = (x: typeof real[number]) => (x.category === item.category ? 0 : 1) * 1_000_000 - (x.orderCnt ?? 0)
  return real.sort((a, b) => rank(a) - rank(b)).slice(0, max).map((x) => x.imageUrl!)
}

export async function runMenuGenerate(jobId: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job?.menuItemId) return
  const [item] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, job.menuItemId)).limit(1)
  if (!item) return
  // scope 'text' = description only, 'image' = photo only, null = both (legacy button).
  const scope = job.scope === 'text' || job.scope === 'image' ? job.scope : 'both'
  try {
    const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    let en = item.aiDescriptionEn ?? (item.draftDescription ?? item.description ?? '').split('\n')[0] ?? ''
    if (scope !== 'image') {
    await note(jobId, 'Writing the description…', { status: 'running' })
    const message = [
      'FAVIE_MENU_DESCRIBE',
      `Restaurant: ${r?.name ?? ''}${r?.cuisine ? ` (${r.cuisine})` : ''}.`,
      'Items:',
      `- name: ${item.name}`,
      `  category: ${item.category ?? ''}`,
      `  current_description: ${item.description ?? '(none)'}`,
      '',
      'Writing guidelines:',
      await menuDescribePrompt(),
      '',
      'Reply with ONE ```favie-menu-text``` block and nothing else, exactly this shape — two SEPARATE fields, English in',
      '`description_en` and Chinese in `description_zh` (never combined into one string):',
      '{ "items": [ { "name": "<same name>", "description_en": "3-4 sentences in English", "description_zh": "3-4 句中文" } ] }',
    ].join('\n')
    const { text } = await runAgentTurn(job.restaurantId, message, jobId, { budgetMs: 6 * 60_000 })
    const parsed = (fenced(text, 'favie-menu-text') ?? fenced(text, 'json')) as { items?: Record<string, unknown>[] } | null
    const got = parsed?.items?.[0]
    const bi = splitBilingual(got)
    if (!bi.en) throw new Error('the agent did not return a description')
    en = bi.en
    if (await wasCancelled(jobId)) return
    await db.update(schema.menuItems).set({ aiDescriptionEn: en, aiDescriptionZh: bi.zh || null, draftDescription: bi.zh ? `${en}\n${bi.zh}` : en, status: 'draft', updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
    if (scope === 'text') { await note(jobId, 'Description ready', { status: 'done' }); return }
    }
    // Photo: the agent's image_generate tool (ZooWork-hosted providers); the legacy direct-OpenAI path only when forced.
    await note(jobId, 'Generating the photo…', scope === 'image' ? { status: 'running' } : undefined)
    try {
      const references = await referencePhotos(item)
      const renderPrompt = (styleAttributes?: string) => dishPrompt(item.name, { category: item.category, cuisine: r?.cuisine, descriptionEn: en, hasReferences: references.length > 0, styleAttributes })
      let img: { bytes: Uint8Array; contentType: string; model: string; artifactUrl: string | null; r2Key: string | null; ms: number; prompt: string; attempts?: number; check?: unknown; styleText?: string }
      if (process.env.MENU_IMAGE_DIRECT_OPENAI === '1' && directOpenAiAvailable()) {
        const prompt = await renderPrompt()
        img = { ...(await generateDishImage(prompt)), model: 'openai-direct', artifactUrl: null, r2Key: null, ms: 0, prompt }
      } else {
        const stepNote: Record<string, string> = { analyze: 'Studying your existing photos…', generate: 'Generating the photo…', check: 'Checking the photo against your menu style…', retry: 'Adjusting and generating again…' }
        img = await generateDishImageViaAgent(job.restaurantId, { renderPrompt, model: await menuImageModel(), filename: `${item.id}.jpg`, references, jobId, onProgress: (step) => note(jobId, stepNote[step] ?? 'Generating the photo…') })
      }
      if (await wasCancelled(jobId)) return
      const url = await putImage(job.restaurantId, `${item.id}-ai-${Date.now()}.jpg`, img.bytes, img.contentType)
      await db.update(schema.menuItems).set({ aiImageUrl: url, draftImageUrl: url, status: 'draft', raw: { ...(item.raw as Record<string, unknown> ?? {}), aiImage: { model: img.model, r2Key: img.r2Key, artifactUrl: img.artifactUrl, prompt: img.prompt, references, styleText: img.styleText ?? null, ms: img.ms, check: img.check ?? null, attempts: img.attempts ?? 1 } }, updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
      await note(jobId, scope === 'image' ? 'Photo ready' : 'Description and photo ready', { status: 'done' })
    } catch (e) {
      console.warn('[menuGenerate] photo failed:', (e as Error).message)
      if (scope === 'image') throw e
      await note(jobId, `Description ready · photo failed: ${(e as Error).message.slice(0, 160)}`, { status: 'done' })
    }
  } catch (e) {
    await fail(jobId, (e as Error).message)
  }
}

// ---------------------------------------------------------------------------------------------
// Save to the platform

/**
 * Write the owner-approved drafts to the platform: one agent session per (restaurant, platform) batch,
 * executing a precomputed recipe (see lib/menu/recipes.ts). `job.menuItemId` set = a single item;
 * null = every item in `draft` status for that platform. Results come back per item and are then
 * cross-checked against a fresh Firecrawl read of the storefront when a key is configured.
 */
export async function runMenuApply(jobId: string) {
  const [job] = await db.select().from(schema.menuJobs).where(eq(schema.menuJobs.id, jobId)).limit(1)
  if (!job) return
  // Batch: the action already moved the queued items to `saving`; single item: whatever the owner pointed at.
  const scope = and(eq(schema.menuItems.restaurantId, job.restaurantId), eq(schema.menuItems.platform, job.platform), job.menuItemId ? eq(schema.menuItems.id, job.menuItemId) : inArray(schema.menuItems.status, ['saving', 'queued']))
  const items = (await db.select().from(schema.menuItems).where(scope)).filter((i) => i.draftDescription || i.draftImageUrl)
  if (!items.length) { await fail(jobId, 'nothing to save'); return }
  const ids = items.map((i) => i.id)
  try {
    const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, job.restaurantId)).limit(1)
    const [conn] = await db.select().from(schema.platformConnections).where(and(eq(schema.platformConnections.restaurantId, job.restaurantId), eq(schema.platformConnections.platform, job.platform))).limit(1)
    if (!r || conn?.status !== 'connected') throw new Error(`${PLATFORM_LABEL[job.platform]} is not connected`)
    const label = r.browserLoginLabel ?? conn.loginLabel ?? `favie-${r.id.slice(0, 8)}`
    const script = buildApplyScript(
      { platform: job.platform, loginLabel: label, storefrontUrl: conn.storefrontUrl, storeExternalId: conn.storeExternalId, menuEditorUrl: conn.menuEditorUrl },
      items.map((i) => ({ id: i.id, name: i.name, category: i.category, externalId: i.externalId, description: i.draftDescription, imageUrl: i.draftImageUrl })),
    )
    if (!script.text) throw new Error(script.unsupported.join('; ') || 'cannot build the write script')
    await waitForAgentBrowser(job.restaurantId, jobId)
    await db.update(schema.menuItems).set({ status: 'saving', lastError: null, updatedAt: new Date() }).where(inArray(schema.menuItems.id, ids))
    await note(jobId, `Writing ${items.length} item${items.length === 1 ? '' : 's'} to ${PLATFORM_LABEL[job.platform]}…`, { status: 'running' })
    const { text } = await runAgentTurn(job.restaurantId, script.text, jobId, { budgetMs: Math.min(40, 6 + items.length * 2) * 60_000 })
    const block = (fenced(text, 'favie-menu-apply') ?? fenced(text, 'json')) as { menu_editor_url?: unknown; items?: { name?: string; status?: string; reason?: string }[] } | null
    // DoorDash: remember the menu editor URL (with menu id) the agent resolved, so the next batch navigates straight to it.
    if (job.platform === 'doordash' && !conn.menuEditorUrl && typeof block?.menu_editor_url === 'string' && /doordash\.com\/merchant\/menu-editor\/\d+/.test(block.menu_editor_url)) {
      await db.update(schema.platformConnections).set({ menuEditorUrl: block.menu_editor_url.split('#')[0], updatedAt: new Date() }).where(eq(schema.platformConnections.id, conn.id))
    }
    const reported = new Map<string, { status: string; reason?: string }>()
    for (const it of block?.items ?? []) if (typeof it.name === 'string') for (const k of looseKeys(it.name)) reported.set(k, { status: String(it.status ?? 'failed'), reason: it.reason })
    let saved = 0
    for (const item of items) {
      let rep: { status: string; reason?: string } | undefined
      for (const k of looseKeys(item.name)) { rep = reported.get(k); if (rep) break }
      const ok = rep?.status === 'saved' || rep?.status === 'photo_skipped'
      if (ok) {
        saved++
        await db.update(schema.menuItems).set({
          status: 'saved', lastSavedAt: new Date(), lastError: rep?.status === 'photo_skipped' ? 'photo not uploaded' : null,
          description: item.draftDescription ?? item.description, imageUrl: rep?.status === 'photo_skipped' ? item.imageUrl : (item.draftImageUrl ?? item.imageUrl),
          photoMissing: item.draftImageUrl && rep?.status !== 'photo_skipped' ? false : item.photoMissing, photoPoor: item.draftImageUrl && rep?.status !== 'photo_skipped' ? false : item.photoPoor,
          ...(item.draftDescription ? descriptionFlags(item.draftDescription) : {}),
          draftDescription: null, draftImageUrl: rep?.status === 'photo_skipped' ? item.draftImageUrl : null, updatedAt: new Date(),
        }).where(eq(schema.menuItems.id, item.id))
      } else {
        await db.update(schema.menuItems).set({ status: 'failed', lastError: (rep?.reason ?? 'the agent did not confirm the save').slice(0, 500), updatedAt: new Date() }).where(eq(schema.menuItems.id, item.id))
      }
    }
    // Cross-check against the public store page (descriptions only; the page lags a few minutes at times).
    let verified = ''
    const key = await firecrawlKey()
    if (key && conn.storefrontUrl && saved) {
      try {
        const menu = await readStorefront(key, job.platform, conn.storefrontUrl)
        const live = new Map<string, string | null>()
        for (const m of menu.items) for (const k of looseKeys(m.name)) if (!live.has(k)) live.set(k, m.description ?? null)
        let match = 0, checked = 0
        for (const item of items) {
          if (!item.draftDescription) continue
          let d: string | null | undefined
          for (const k of looseKeys(item.name)) { if (live.has(k)) { d = live.get(k); break } }
          if (d === undefined) continue
          checked++
          if (d && norm(d) === norm(item.draftDescription)) match++
        }
        if (checked) verified = ` · storefront check ${match}/${checked}`
      } catch (e) { console.warn('[menuApply] verify failed:', (e as Error).message) }
    }
    await note(jobId, `Saved ${saved} of ${items.length}${verified}${script.calibrate ? ' · calibration steps included' : ''}`, { status: saved ? 'done' : 'failed', error: saved ? null : 'no item was confirmed saved' })
  } catch (e) {
    await db.update(schema.menuItems).set({ status: 'failed', lastError: (e as Error).message.slice(0, 500), updatedAt: new Date() }).where(inArray(schema.menuItems.id, ids))
    await fail(jobId, (e as Error).message)
  }
}

/** Shared by the API route and the pages: items grouped by category plus the diagnostics counters. */
export async function menuState(restaurantId: string, platform: Platform) {
  // A worker that died mid-job would leave "running" rows forever; the UI would spin forever with them.
  await db.update(schema.menuJobs).set({ status: 'failed', error: 'timed out', updatedAt: new Date() })
    .where(and(eq(schema.menuJobs.restaurantId, restaurantId), inArray(schema.menuJobs.status, ['queued', 'running']), sql`${schema.menuJobs.createdAt} < now() - interval '25 minutes'`)).catch(() => {})
  const [items, jobs, [conn], [optimization]] = await Promise.all([
    db.select().from(schema.menuItems).where(and(eq(schema.menuItems.restaurantId, restaurantId), eq(schema.menuItems.platform, platform))).orderBy(schema.menuItems.position),
    db.select().from(schema.menuJobs).where(and(eq(schema.menuJobs.restaurantId, restaurantId), eq(schema.menuJobs.platform, platform))).orderBy(schema.menuJobs.createdAt),
    db.select({ storefrontUrl: schema.platformConnections.storefrontUrl, storefrontCandidates: schema.platformConnections.storefrontCandidates }).from(schema.platformConnections)
      .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform))).limit(1),
    db.select({ id: schema.menuOptimizations.id, requestedAt: schema.menuOptimizations.createdAt }).from(schema.menuOptimizations)
      .where(and(eq(schema.menuOptimizations.restaurantId, restaurantId), eq(schema.menuOptimizations.status, 'requested'))).orderBy(desc(schema.menuOptimizations.createdAt)).limit(1),
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
    queued: items.filter((i) => i.status === 'queued' || i.status === 'saving').length,
  }
  return {
    items: items as MenuItem[], pull: pull as MenuJob | null, active: active as MenuJob[], counts, imageGeneration: imageGenerationAvailable(),
    storefront: { url: conn?.storefrontUrl ?? null, candidates: conn?.storefrontUrl ? null : (conn?.storefrontCandidates ?? null) },
    // Open "Favie AI optimize" request: the owner's Menu Clinic is read-only until ops marks it done.
    optimization: optimization ? { id: optimization.id, requestedAt: optimization.requestedAt } : null,
    fastRead: !!(await firecrawlKey()),
  }
}
export type MenuState = Awaited<ReturnType<typeof menuState>>

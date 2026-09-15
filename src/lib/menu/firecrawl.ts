/**
 * Menu Clinic read side: the public storefront, fetched server-side through Firecrawl.
 *
 * Why not the agent's browser: its DOM snapshot never exposes photo URLs, a full read takes ~10 min
 * and the result depends on the model following a long protocol. Firecrawl returns the rendered page
 * as markdown in 10–40 s with names, prices, descriptions, categories AND photo URLs; Uber Eats even
 * carries the item UUIDs Favie needs for the Menu Maker deep links. Measured 2026-09-11 on the two
 * pilot stores: UE 13 s (one pass), DD 14 s when the store renders every category server-side, 41 s
 * with scroll actions when it lazy-loads (Kirin).
 *
 * The key comes from app_settings (admin → Platform settings) or FIRECRAWL_API_KEY; without either,
 * the pull falls back to the agent browser protocol.
 */
import { settingSync, getSetting, SETTING_KEYS } from '@/server/settings'
import type { PulledItem } from '@/lib/zoowork/menu'

const API = 'https://api.firecrawl.dev/v1'

export async function firecrawlKey(): Promise<string | null> {
  return (await getSetting(SETTING_KEYS.firecrawlApiKey))?.value || process.env.FIRECRAWL_API_KEY || null
}
export function firecrawlKeySync(): string | null {
  return settingSync(SETTING_KEYS.firecrawlApiKey) || process.env.FIRECRAWL_API_KEY || null
}

async function call<T>(key: string, path: string, body: unknown, timeoutMs: number): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  })
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string } & T
  if (!res.ok || json.success === false) throw new Error(`firecrawl ${res.status}: ${json.error ?? JSON.stringify(json).slice(0, 200)}`)
  return json
}

/** One scrape. `scroll` renders lazy-loaded sections (DoorDash stores that only paint the first category). */
export async function scrapeStorefront(key: string, url: string, opts: { scroll?: boolean; html?: boolean } = {}): Promise<{ markdown: string; html: string | null; title: string | null; ms: number }> {
  const actions: unknown[] = []
  if (opts.scroll) {
    actions.push({ type: 'wait', milliseconds: 2500 })
    for (let i = 0; i < 12; i++) actions.push({ type: 'scroll', direction: 'down' }, { type: 'wait', milliseconds: 700 })
  }
  const t0 = Date.now()
  const j = await call<{ data?: { markdown?: string; rawHtml?: string; metadata?: { title?: string } } }>(key, '/scrape',
    { url, formats: opts.html ? ['markdown', 'rawHtml'] : ['markdown'], onlyMainContent: false, waitFor: 2000, location: { country: 'US' }, timeout: 90_000, ...(actions.length ? { actions } : {}) }, 150_000)
  if (!j.data?.markdown) throw new Error('firecrawl: no markdown')
  return { markdown: j.data.markdown, html: j.data.rawHtml ?? null, title: j.data.metadata?.title ?? null, ms: Date.now() - t0 }
}

/**
 * Uber Eats renders only the first ~10 card photos until the page is scrolled, but the page's embedded
 * state carries every item as {"uuid","imageUrl","title"} (with \u0022-escaped quotes). Read those, so a
 * single scrape yields every photo. Keyed by item uuid and by normalized title.
 */
export function embeddedPhotos(html: string | null | undefined): { byId: Map<string, string>; byName: Map<string, string> } {
  const byId = new Map<string, string>(), byName = new Map<string, string>()
  if (!html) return { byId, byName }
  const text = html.replace(/\\u0022/g, '"').replace(/\\\//g, '/')
  const re = /"uuid":"([0-9a-f-]{36})","imageUrl":"(https:\/\/[^"]+)","title":"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (!byId.has(m[1]!)) byId.set(m[1]!, m[2]!)
    const k = nameKey(m[3]!.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, '"'))
    if (k && !byName.has(k)) byName.set(k, m[2]!)
  }
  return { byId, byName }
}
export const nameKey = (n: string) => n.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** Fill missing item photos from a uuid/title → url map; returns how many were filled. */
export function backfillPhotos(items: PulledItem[], photos: { byId: Map<string, string>; byName: Map<string, string> }): number {
  let n = 0
  for (const i of items) {
    if (i.image_url) continue
    const url = (i.external_id && photos.byId.get(i.external_id)) || photos.byName.get(nameKey(i.name))
    if (url) { i.image_url = url; i.has_photo = true; n++ }
  }
  return n
}

// ---------------------------------------------------------------------------------------------
// Finding the store page

export type StoreCandidate = { url: string; title: string; storeId: string }

const STORE_URL: Record<'doordash' | 'uber_eats', RegExp> = {
  doordash: /https?:\/\/(?:www\.)?doordash\.com\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?store\/(?:[^/?#]*?-)?(\d{6,})\/?/i,
  uber_eats: /https?:\/\/(?:www\.)?ubereats\.com\/store\/[^/?#]+\/([A-Za-z0-9_-]{22})(?=[/?#]|$)/i,
}

/** Canonical public URL for a store id: DD numeric store id; UE store uuid (or its 22-char base64url form). */
export function canonicalStorefrontUrl(platform: 'doordash' | 'uber_eats', storeId: string, name?: string | null): string {
  if (platform === 'doordash') return `https://www.doordash.com/store/${storeId}/`
  const hex = storeId.replace(/-/g, '')
  const short = /^[0-9a-f]{32}$/i.test(hex) ? Buffer.from(hex, 'hex').toString('base64url') : storeId
  const slug = (name ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store'
  return `https://www.ubereats.com/store/${slug}/${short}`
}

/** UE short id (22 chars, base64url of the uuid) → uuid, or null when the shape is off. */
export function ueShortIdToUuid(short: string): string | null {
  try {
    const hex = Buffer.from(short, 'base64url').toString('hex')
    if (hex.length !== 32) return null
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  } catch { return null }
}

/**
 * Web search for the store page (≈0.5–0.8 s). Returns distinct store candidates in rank order; the
 * caller matches them against the store id it knows, the restaurant's address, or asks the owner.
 */
export async function searchStorefront(key: string, platform: 'doordash' | 'uber_eats', name: string, city: string | null): Promise<StoreCandidate[]> {
  const site = platform === 'doordash' ? 'doordash.com' : 'ubereats.com'
  const q = `${name} ${city ?? ''} site:${site}`.replace(/\s+/g, ' ').trim()
  const j = await call<{ data?: { url?: string; title?: string }[] }>(key, '/search', { query: q, limit: 8, location: 'United States' }, 30_000)
  const out: StoreCandidate[] = []
  const seen = new Set<string>()
  for (const d of j.data ?? []) {
    const m = d.url ? STORE_URL[platform].exec(d.url) : null
    if (!m) continue
    const storeId = platform === 'uber_eats' ? (ueShortIdToUuid(m[1]!) ?? m[1]!) : m[1]!
    if (seen.has(storeId)) continue
    seen.add(storeId)
    out.push({ url: canonicalStorefrontUrl(platform, storeId, name), title: String(d.title ?? '').replace(/\s*[-|–]\s*(DoorDash|Uber Eats).*$/i, '').replace(/^(Order|Store:)\s*/i, '').trim(), storeId })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Parsing the storefront markdown

export type ParsedMenu = { items: PulledItem[]; storeName: string | null; categoriesSeen: number; emptyCategories: number }

const CAROUSEL = /^(featured items?|most ordered|popular items?|save on select items|frequently bought|recommended|buy 1,? get 1|picked for you|deals? & benefits|trending restaurants|savings and more|rating and reviews|frequently asked questions)/i
const BADGE = /^(#\d+ (best seller|most liked)|\d+\+? recent orders?|popular|new|buy 1,? get 1( free)?|\d+% \(\d+\)|\d+% off|save \$\d+|limited time|top rated)$/i
const SOLD_OUT = /^(sold out|currently unavailable|unavailable|out of stock)$/i
const NOISE = /^(icon loading|loading|add|\+|heart|three dots.*)$/i
/** Site footer starts here; nothing below is menu. */
const FOOTER = /^(trending restaurants|top dishes near me|top cuisines near me|trending categories|nearby cities|get to know us|let us help you|doing business|frequently asked questions)/i

export function parseStorefrontMarkdown(platform: 'doordash' | 'uber_eats', md: string): ParsedMenu {
  const parsed = platform === 'uber_eats' ? parseUberEats(md) : parseDoorDash(md)
  // Dedupe by name (carousel leftovers repeat real items); the first real-category occurrence wins.
  const seen = new Set<string>()
  parsed.items = parsed.items.filter((it) => { const k = it.name.toLowerCase().normalize('NFKC'); if (seen.has(k)) return false; seen.add(k); return true })
  parsed.items.forEach((it, i) => { it.position = i + 1 })
  return parsed
}

const price = (s: string) => { const m = /^\$\s?(\d{1,4}(?:\.\d{1,2})?)/.exec(s); return m ? Math.round(Number(m[1]) * 100) : null }

/**
 * DoorDash markdown (Firecrawl readability output):
 *   ## Category
 *   ### Item name          description paragraph (optional)    $12.99    badge lines    ![Item](img)
 * Categories a lazy-loading store did not render appear as `##` headings with no `###` under them.
 */
function parseDoorDash(md: string): ParsedMenu {
  const lines = md.split(/\r?\n/)
  const items: PulledItem[] = []
  let storeName: string | null = null
  let category: string | null = null, skipping = true, cur: PulledItem | null = null
  let categoriesSeen = 0, emptyCategories = 0, itemsInCategory = 0
  const flush = () => { if (cur && !skipping) items.push(cur); cur = null }
  const closeCategory = () => { if (category && !skipping) { categoriesSeen++; if (!itemsInCategory) emptyCategories++ } }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const h1 = /^#\s+(.+)$/.exec(line)
    if (h1) { if (!storeName) storeName = h1[1]!.trim(); continue }
    const h2 = /^##\s+(.+?)\s*(?:\(\d+\))?$/.exec(line)
    if (h2) {
      flush(); closeCategory()
      category = h2[1]!.trim()
      if (FOOTER.test(category)) { category = null; skipping = true; break }
      skipping = CAROUSEL.test(category) || /delivered to your door/i.test(category); itemsInCategory = 0
      continue
    }
    const h3 = /^###\s+(.+)$/.exec(line)
    if (h3) { flush(); itemsInCategory++; cur = { external_id: null, category, name: h3[1]!.trim(), description: null, price_cents: null, has_photo: false, image_url: null, availability: 'available', unit: null, position: 0 }; continue }
    if (!cur) continue
    const img = /^!\[[^\]]*\]\((https?:[^)\s]+)\)/.exec(line)
    if (img) { cur.image_url = img[1]!; cur.has_photo = true; continue }
    const p = price(line)
    if (p != null) { if (cur.price_cents == null) cur.price_cents = p; continue }
    if (SOLD_OUT.test(line)) { cur.availability = 'sold_out'; continue }
    if (BADGE.test(line) || NOISE.test(line) || /^\[.*\]\(.*\)$/.test(line)) continue
    if (cur.description == null && line.length >= 3 && !/^[#*_-]/.test(line)) cur.description = line
  }
  flush(); closeCategory()
  return { items, storeName, categoriesSeen, emptyCategories }
}

/**
 * Uber Eats markdown: `- ### Category` list headings, then one nested list entry per item whose whole
 * card is a link to the item's quickView. Two card shapes:
 *   - [![Name](img)\ Plus small\ Name\ $price • 80% (12)](…quickView…itemUuid…)
 *   - [Name\ $price • 80% (12)\ description\ ![Name](img)\ Plus small](…quickView…)
 */
function parseUberEats(md: string): ParsedMenu {
  const items: PulledItem[] = []
  const storeName = /^#\s+(.+)$/m.exec(md)?.[1]?.trim() ?? null
  const sections = md.split(/^- ###\s+/m)
  let categoriesSeen = 0, emptyCategories = 0
  for (const sec of sections.slice(1)) {
    const nl = sec.indexOf('\n')
    const category = sec.slice(0, nl).trim()
    if (CAROUSEL.test(category) || /^can i |^is |^how /i.test(category)) continue
    categoriesSeen++
    const body = sec.slice(nl + 1)
    const re = /^\s+- \[([\s\S]*?)\]\((https:\/\/www\.ubereats\.com\/[^)\s]*quickView[^)\s]*)\)/gm
    let m: RegExpExecArray | null, count = 0
    while ((m = re.exec(body))) {
      const card = m[1]!, link = m[2]!
      const img = /!\[([^\]]*)\]\((https?:[^)\s]+)\)/.exec(card)
      const text = card.replace(/!\[[^\]]*\]\([^)]*\)/g, '').split(/\\\\|\n/).map((s) => s.trim()).filter((s) => s && s !== 'Plus small' && !/^plus\b/i.test(s))
      const priceLine = text.find((s) => /^\$\s?\d/.test(s))
      const name = (img?.[1] ?? text[0] ?? '').trim()
      if (!name) continue
      const rest = text.filter((s) => s !== name && s !== priceLine && !BADGE.test(s) && !NOISE.test(s))
      const soldOut = rest.some((s) => SOLD_OUT.test(s))
      const description = rest.find((s) => !SOLD_OUT.test(s) && s.length >= 3) ?? null
      const uuid = /itemUuid(?:%25)?22(?:%25)?3A(?:%25)?22([0-9a-f-]{36})/i.exec(link)?.[1] ?? /itemUuid[^0-9a-f]*([0-9a-f]{8}-[0-9a-f-]{27})/i.exec(decodeURIComponent(decodeURIComponent(link)).replace(/[^0-9a-zA-Z-]/g, ' '))?.[1] ?? null
      const ratingM = priceLine ? /(\d{1,3})% \((\d+)\)/.exec(priceLine) : null
      items.push({
        external_id: uuid, category, name, description, price_cents: priceLine ? price(priceLine) : null,
        has_photo: !!img, image_url: img?.[2] ?? null, availability: soldOut ? 'sold_out' : 'available', unit: null, position: 0,
        rating: ratingM ? { pct: Number(ratingM[1]), count: Number(ratingM[2]) } : undefined,
      })
      count++
    }
    if (!count) emptyCategories++
  }
  return { items, storeName, categoriesSeen, emptyCategories }
}

/** Full read: plain scrape first; DoorDash stores that lazy-load get a second pass with scroll actions. */
export async function readStorefront(key: string, platform: 'doordash' | 'uber_eats', url: string): Promise<ParsedMenu & { ms: number; passes: number }> {
  const first = await scrapeStorefront(key, url, { html: platform === 'uber_eats' })
  let parsed = parseStorefrontMarkdown(platform, first.markdown)
  let ms = first.ms, passes = 1
  if (platform === 'uber_eats') backfillPhotos(parsed.items, embeddedPhotos(first.html))
  // Lazy rendering, two flavours: DoorDash paints only the first category; Uber Eats paints every
  // card but only the first ~10 photos until the page is scrolled (seen 2026-09-15: 10 of 41 photos).
  const withPhoto = parsed.items.filter((i) => i.image_url).length
  const lazySections = platform === 'doordash' && (parsed.items.length < 5 || parsed.emptyCategories > 0)
  const lazyPhotos = parsed.items.length >= 5 && withPhoto > 0 && withPhoto < parsed.items.length * 0.8
  if (lazySections || lazyPhotos) {
    const second = await scrapeStorefront(key, url, { scroll: true })
    const p2 = parseStorefrontMarkdown(platform, second.markdown)
    ms += second.ms; passes = 2
    // Backfill photos from whichever pass rendered them (by uuid, then by name).
    const photos = { byId: new Map<string, string>(), byName: new Map<string, string>() }
    for (const i of [...p2.items, ...parsed.items]) if (i.image_url) { if (i.external_id) photos.byId.set(i.external_id, photos.byId.get(i.external_id) ?? i.image_url); photos.byName.set(nameKey(i.name), photos.byName.get(nameKey(i.name)) ?? i.image_url) }
    const base = p2.items.length > parsed.items.length ? p2 : parsed
    backfillPhotos(base.items, photos)
    parsed = base
  }
  return { ...parsed, ms, passes }
}

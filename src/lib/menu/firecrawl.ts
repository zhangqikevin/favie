/**
 * Server-side storefront read through Firecrawl (https://docs.firecrawl.dev). Optional: used only when
 * FIRECRAWL_API_KEY is set. One scrape with scroll actions renders the lazy-loaded categories and returns
 * markdown that carries item names, prices, descriptions AND photo URLs — the platform's own DOM snapshot
 * (what the agent's browser sees) never exposes image addresses, and the whole read takes seconds instead
 * of an agent browser session of ~10 minutes.
 *
 * NOT yet exercised against the live API (no key configured when written); the parser is covered by the
 * markdown shape observed through the agent's web_fetch tool, which is Firecrawl-backed.
 */
import type { PulledItem } from '@/lib/zoowork/menu'

export function firecrawlEnabled() {
  return Boolean(process.env.FIRECRAWL_API_KEY)
}

export async function scrapeStorefront(url: string): Promise<{ markdown: string } | null> {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) return null
  // Scroll in steps so DoorDash / Uber Eats render every category before the markdown is extracted.
  const actions: unknown[] = [{ type: 'wait', milliseconds: 2500 }]
  for (let i = 0; i < 12; i++) actions.push({ type: 'scroll', direction: 'down' }, { type: 'wait', milliseconds: 700 })
  actions.push({ type: 'scroll', direction: 'up' }, { type: 'wait', milliseconds: 500 })
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: false, waitFor: 2000, actions, location: { country: 'US' }, timeout: 90_000 }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`firecrawl ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = (await res.json()) as { success?: boolean; data?: { markdown?: string }; error?: string }
  if (!json.success || !json.data?.markdown) throw new Error(`firecrawl: ${json.error ?? 'no markdown'}`)
  return { markdown: json.data.markdown }
}

const SKIP_SECTIONS = /^(featured items?|most ordered|popular items?|save on select items|frequently bought|recommended|buy 1,? get 1)/i

/**
 * Parse storefront markdown into pulled items. Shape (both platforms, Firecrawl readability output):
 *   ## Category
 *   ### Item name
 *   description paragraph (optional)
 *   $12.99
 *   ![Item name](https://img…)   (optional)
 * Promo carousels ("Featured Items", "Most Ordered") repeat real items and are skipped.
 */
export function parseStorefrontMarkdown(md: string): { items: PulledItem[]; storeName: string | null } {
  const lines = md.split(/\r?\n/)
  const items: PulledItem[] = []
  let storeName: string | null = null
  let category: string | null = null
  let skipping = false
  let cur: PulledItem | null = null
  let position = 0
  const flush = () => { if (cur && !skipping) items.push(cur); cur = null }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const h1 = /^#\s+(.+)$/.exec(line)
    if (h1 && !storeName) { storeName = h1[1]!.trim(); continue }
    const h2 = /^##\s+(.+?)\s*(?:\(\d+\))?$/.exec(line)
    if (h2) { flush(); category = h2[1]!.trim(); skipping = SKIP_SECTIONS.test(category); continue }
    const h3 = /^###\s+(.+)$/.exec(line)
    if (h3) { flush(); position++; cur = { external_id: null, category, name: h3[1]!.trim(), description: null, price_cents: null, has_photo: false, image_url: null, availability: 'available', unit: null, position }; continue }
    if (!cur) continue
    const img = /^!\[[^\]]*\]\((https?:[^)\s]+)\)/.exec(line)
    if (img) { cur.image_url = img[1]!; cur.has_photo = true; continue }
    const price = /^\$\s?(\d+(?:\.\d{1,2})?)/.exec(line)
    if (price) { if (cur.price_cents == null) cur.price_cents = Math.round(Number(price[1]) * 100); continue }
    if (/^(sold out|currently unavailable|unavailable)$/i.test(line)) { cur.availability = 'sold_out'; continue }
    if (/^(#\d+ best seller|\d+\+? recent orders?|popular|new|\d+% \(\d+\))/i.test(line)) continue // badges
    if (/^\[.*\]\(.*\)$/.test(line) || /^(heart|three dots|add|\+)$/i.test(line)) continue // controls
    if (cur.description == null && !/^\$/.test(line) && line.length >= 3) cur.description = line
  }
  flush()
  // Dedupe by name (carousel leftovers, repeated items).
  const seen = new Set<string>()
  const out = items.filter((it) => { const k = it.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
  return { items: out, storeName }
}

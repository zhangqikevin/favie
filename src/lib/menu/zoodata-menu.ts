import type { ParsedMenu } from './firecrawl'
import type { PulledItem } from '@/lib/zoowork/menu'

type Cfg = { url: string; key: string; tool: string }

async function rpc<T>(cfg: Cfg, method: string, params: unknown): Promise<T> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(120_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`zoodata menu ${method} HTTP ${res.status}: ${text.slice(0, 200)}`)
  const body = /^data: /m.test(text) ? (/data: (.*)/.exec(text)?.[1] ?? '{}') : text // streamable-http may answer as SSE
  const json = JSON.parse(body) as { result?: T; error?: { message: string } }
  if (json.error) throw new Error(`zoodata menu ${method}: ${json.error.message}`)
  return json.result as T
}

/** Verify a platform key: the MCP server must list the configured tool. */
export async function zoodataMenuTools(cfg: Omit<Cfg, 'tool'>): Promise<string[]> {
  const r = await rpc<{ tools?: { name: string }[] }>({ ...cfg, tool: '' }, 'tools/list', {})
  return (r.tools ?? []).map((t) => t.name)
}

const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : null
const str = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null
const pick = (o: Record<string, unknown>, ...keys: string[]) => { for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]; return undefined }

/**
 * Read a public store page through Zoodata's menu tool and map the answer onto Menu Clinic's item shape.
 * The response is read defensively (items may be flat or grouped under categories; field names vary), so a
 * new tool version degrades to "no items" — which makes the caller fall back to Firecrawl / the agent.
 */
export async function readStorefrontViaZoodata(cfg: Cfg, platform: 'doordash' | 'uber_eats', url: string): Promise<ParsedMenu & { ms: number; passes: number }> {
  const t0 = Date.now()
  const r = await rpc<{ content?: { type: string; text?: string }[]; isError?: boolean }>(cfg, 'tools/call', { name: cfg.tool, arguments: { url, platform } })
  const text = r.content?.find((c) => c.type === 'text')?.text ?? '{}'
  if (r.isError) throw new Error(`zoodata menu ${cfg.tool}: ${text.slice(0, 300)}`)
  let env: unknown
  try { env = JSON.parse(text) } catch { throw new Error(`zoodata menu ${cfg.tool}: non-JSON answer`) }
  const root = (env as { data?: unknown }).data ?? env
  const storeName = str(pick(root as Record<string, unknown>, 'storeName', 'store_name', 'name', 'title'))
  const items: PulledItem[] = []
  let pos = 0
  const push = (raw: Record<string, unknown>, category: string | null) => {
    const name = str(pick(raw, 'name', 'title', 'itemName'))
    if (!name) return
    const image = str(pick(raw, 'imageUrl', 'image_url', 'image', 'photoUrl', 'photo'))
    const priceRaw = pick(raw, 'priceCents', 'price_cents', 'price', 'priceAmount')
    const price = num(priceRaw)
    const priceCents = price == null ? null : (typeof priceRaw === 'number' && !Number.isInteger(priceRaw)) || (typeof priceRaw === 'string' && priceRaw.includes('.')) ? Math.round(price * 100) : Math.round(price)
    const avail = str(pick(raw, 'availability', 'status'))
    items.push({
      external_id: str(pick(raw, 'externalId', 'external_id', 'platformItemId', 'itemUuid', 'uuid', 'id')),
      category: category ?? str(pick(raw, 'category', 'section', 'categoryName')), name,
      description: str(pick(raw, 'description', 'itemDescription')), price_cents: priceCents,
      has_photo: !!image, image_url: image,
      availability: avail && /sold|unavailable|out/i.test(avail) ? 'sold_out' : 'available', unit: null, position: ++pos,
    })
  }
  const rootObj = root as Record<string, unknown>
  // SAFETY: this must be ONE store's menu page. A tool that answers with a catalog across stores — like
  // `restaurant_v2_menu_items`, which ignores the url and returns every item of every store the platform
  // key can see — must never be ingested: on 2026-09-21 that put 1,797 dishes of other restaurants into one
  // restaurant's Menu Clinic. Refuse catalogs (several stores, or no descriptions and no photos at all),
  // so the caller falls back to Firecrawl / the agent browser.
  const flatProbe = pick(rootObj, 'items', 'products')
  if (Array.isArray(flatProbe)) {
    const rows = flatProbe as Record<string, unknown>[]
    const stores = new Set(rows.map((x) => String(pick(x, 'storeId', 'store_id', 'restaurantId', 'restaurant_id', 'platformStoreId') ?? '')).filter(Boolean))
    const rich = rows.some((x) => pick(x, 'description', 'itemDescription', 'imageUrl', 'image_url', 'image', 'photoUrl', 'photo') != null)
    if (stores.size > 1) throw new Error(`zoodata menu ${cfg.tool}: the answer spans ${stores.size} stores — this tool is a catalog, not a store-page reader; refusing to ingest`)
    if (rows.length > 0 && !rich) throw new Error(`zoodata menu ${cfg.tool}: no descriptions or photos in the answer — not a store-page reader; refusing to ingest`)
    if (rows.length > 800) throw new Error(`zoodata menu ${cfg.tool}: ${rows.length} items is not one store's menu; refusing to ingest`)
  }
  const cats = pick(rootObj, 'categories', 'sections', 'menu')
  if (Array.isArray(cats)) for (const c of cats as Record<string, unknown>[]) {
    const cname = str(pick(c, 'name', 'title', 'category'))
    const list = pick(c, 'items', 'products') as unknown
    if (Array.isArray(list)) for (const it of list as Record<string, unknown>[]) push(it, cname)
  }
  const flat = pick(rootObj, 'items', 'products')
  if (Array.isArray(flat)) for (const it of flat as Record<string, unknown>[]) push(it, null)
  const seen = new Set<string>()
  const categoriesSeen = new Set(items.map((i) => i.category ?? '')).size
  return { items: items.filter((i) => (seen.has(i.name) ? false : (seen.add(i.name), true))), storeName, categoriesSeen, emptyCategories: 0, ms: Date.now() - t0, passes: 1 }
}

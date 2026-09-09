import type { ChannelRow, DateRange, PlatformDailyRow, PlatformHealthRow, ZoodataClient, ZoodataRestaurant } from './types'

/**
 * Minimal MCP streamable-http client for the Zoodata restaurant server (JSON-RPC over POST).
 * Observed 2026-09-08: tools are `restaurant_v2_*`, money is integer cents, envelope is
 * { success, data: { asOf, isFresh, dqcValid, count, cursor, ... }, error, meta }. 600 req/min.
 */
export class McpZoodataClient implements ZoodataClient {
  private id = 0
  constructor(private url: string, private token: string, private fetchImpl: typeof fetch = fetch) {}

  private async rpc<T>(method: string, params: unknown): Promise<T> {
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }),
    })
    if (!res.ok) throw new Error(`zoodata ${method} HTTP ${res.status}`)
    const json = await res.json() as { result?: T; error?: { code: number; message: string } }
    if (json.error) throw new Error(`zoodata ${method}: ${json.error.message}`)
    return json.result as T
  }

  private async call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const r = await this.rpc<{ content: { type: string; text: string }[]; isError?: boolean }>('tools/call', { name, arguments: args })
    const text = r.content?.find((c) => c.type === 'text')?.text ?? '{}'
    const env = JSON.parse(text) as { success: boolean; data: T; error: unknown }
    if (r.isError || !env.success) throw new Error(`zoodata ${name}: ${JSON.stringify(env.error ?? text).slice(0, 300)}`)
    return env.data
  }

  async listRestaurants() {
    const d = await this.call<{ restaurants: ZoodataRestaurant[] }>('restaurant_v2_list_restaurants', {})
    return d.restaurants ?? []
  }

  async getChannelEconomics(range: DateRange) {
    const d = await this.call<{ channels: ChannelRow[] }>('restaurant_v2_channel_economics', { ...range })
    return d.channels ?? []
  }

  async getPlatformDaily(range: DateRange, platform?: 'doordash' | 'ubereats') {
    const out: PlatformDailyRow[] = []
    let cursor: string | null | undefined
    do {
      const d = await this.call<{ metrics: Record<string, unknown>[]; cursor: string | null }>('restaurant_v2_platform_daily', {
        ...range, ...(platform ? { platform } : {}), granularity: 'store', limit: 200, ...(cursor ? { cursor } : {}),
      })
      for (const m of d.metrics ?? []) out.push(mapPlatformDaily(m))
      cursor = d.cursor
    } while (cursor)
    return out
  }

  async getPlatformHealth(range: DateRange) {
    const d = await this.call<{ reconciliation: Record<string, unknown>[] }>('restaurant_v2_platform_health', { ...range })
    return (d.reconciliation ?? []).map(mapPlatformHealth)
  }
}

/** restaurant_v2_platform_health rows observed 2026-09-09: dt, platform, isMature, ordersCnt, ordersGmvAmount, adAttributedOrdersCnt, adAttributedGmvAmount, platformOrderVolume, platformSalesAmount, platformAdSpendAmount, platformAdRoas. */
export function mapPlatformHealth(m: Record<string, unknown>): PlatformHealthRow {
  const num = (k: string) => (typeof m[k] === 'number' ? (m[k] as number) : null)
  return {
    date: String(m.dt ?? ''), platform: String(m.platform ?? ''), storeId: (m.storeId as string | undefined) ?? undefined, isMature: m.isMature === true,
    ordersCnt: num('ordersCnt'), ordersGmvAmount: num('ordersGmvAmount'), adAttributedOrdersCnt: num('adAttributedOrdersCnt'), adAttributedGmvAmount: num('adAttributedGmvAmount'),
    platformOrderVolume: num('platformOrderVolume'), platformSalesAmount: num('platformSalesAmount'), platformAdSpendAmount: num('platformAdSpendAmount'), platformAdRoas: num('platformAdRoas'),
    raw: m,
  }
}

/**
 * Field mapping is isolated here. Real rows observed 2026-09-09 (restaurant_v2_platform_daily, grain=store):
 * dt, platform, isMature, platformOrderVolume, completedOrderCnt, platformSalesAmount, platformTicketSizeAmount,
 * adSpendAmount, adRoas, ratingAvg, downtimeMinutes, cancelledOrderCnt, ordersWithErrorCnt. Money is integer cents.
 */
export function mapPlatformDaily(m: Record<string, unknown>): PlatformDailyRow {
  const num = (k: string) => (typeof m[k] === 'number' ? (m[k] as number) : null)
  const pick = (...ks: string[]) => { for (const k of ks) { const v = num(k); if (v != null) return v } return null }
  const adSpend = pick('adSpendAmount', 'adsSpendAmount', 'adFeeAmount')
  const roas = num('adRoas')
  return {
    date: String(m.dt ?? m.date ?? m.day ?? m.snapshotDay ?? ''),
    platform: String(m.platform ?? ''),
    storeId: (m.storeId as string | undefined) ?? undefined,
    isMature: m.isMature === true,
    rating: pick('ratingAvg', 'rating', 'avgRating'),
    downtimeMinutes: pick('downtimeMinutes', 'downtimeMin'),
    adSpendAmount: adSpend,
    adAttributedOrderCnt: pick('adAttributedOrderCnt', 'adOrderCnt'),
    adAttributedSalesAmount: adSpend != null && roas != null && adSpend > 0 ? Math.round(adSpend * roas) : null,
    platformReportedSalesAmount: pick('platformSalesAmount', 'platformReportedSalesAmount', 'salesAmount', 'gmvAmount'),
    orderCnt: pick('platformOrderVolume', 'completedOrderCnt', 'orderCnt', 'orders'),
    errorCnt: pick('ordersWithErrorCnt', 'errorCnt'),
    cancelCnt: pick('cancelledOrderCnt', 'cancelCnt', 'cancellationCnt'),
    raw: m,
  }
}

import type { ChannelRow, DateRange, PlatformDailyRow, PlatformHealthRow, ZoodataClient, ZoodataRestaurant } from './types'

/** Deterministic PRNG so the same restaurant/day always renders the same numbers. */
function rng(seed: string) {
  let h = 2166136261
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10_000) / 10_000 }
}

function* days(range: DateRange) {
  const d = new Date(range.start + 'T00:00:00Z'), end = new Date(range.end + 'T00:00:00Z')
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) yield d.toISOString().slice(0, 10)
}

export class MockZoodataClient implements ZoodataClient {
  constructor(private seed = 'favie-mock') {}

  async listRestaurants(): Promise<ZoodataRestaurant[]> {
    return [{ restaurantId: 'mock', name: 'Mock Restaurant', timezone: 'America/Los_Angeles', platformBindings: [{ platform: 'doordash', platformStoreId: '1' }, { platform: 'ubereats', platformStoreId: '2' }] }]
  }

  async getPlatformDaily(range: DateRange, platform?: 'doordash' | 'ubereats'): Promise<PlatformDailyRow[]> {
    const out: PlatformDailyRow[] = []
    for (const date of days(range)) {
      for (const p of ['doordash', 'ubereats'] as const) {
        if (platform && p !== platform) continue
        const r = rng(`${this.seed}:${p}:${date}`)
        const dow = new Date(date + 'T00:00:00Z').getUTCDay()
        const weekend = dow === 5 || dow === 6 ? 1.35 : dow === 0 ? 1.15 : 1
        const base = p === 'doordash' ? 34 : 26
        const orders = r() < 0.03 ? 0 : Math.round(base * weekend * (0.75 + r() * 0.5))
        const aov = 2200 + Math.round(r() * 900)
        const adSpend = Math.round((p === 'doordash' ? 2800 : 2200) * (0.8 + r() * 0.4))
        out.push({
          date, platform: p, isMature: true, orderCnt: orders, platformReportedSalesAmount: orders * aov, adSpendAmount: adSpend,
          adAttributedOrderCnt: Math.round(orders * (0.18 + r() * 0.1)), rating: Math.round((4.4 + r() * 0.5) * 10) / 10,
          downtimeMinutes: r() < 0.1 ? Math.round(r() * 90) : 0, cancelCnt: Math.round(orders * 0.02), errorCnt: 0, raw: { mock: true },
        })
      }
    }
    return out
  }

  async getPlatformHealth(range: DateRange): Promise<PlatformHealthRow[]> {
    return (await this.getPlatformDaily(range)).map((d) => ({
      date: d.date, platform: d.platform, isMature: true,
      ordersCnt: d.orderCnt ?? null, ordersGmvAmount: d.platformReportedSalesAmount ?? null,
      adAttributedOrdersCnt: d.adAttributedOrderCnt ?? null, adAttributedGmvAmount: d.adAttributedOrderCnt != null && d.orderCnt ? Math.round((d.adAttributedOrderCnt / d.orderCnt) * (d.platformReportedSalesAmount ?? 0)) : null,
      platformOrderVolume: d.orderCnt ?? null, platformSalesAmount: d.platformReportedSalesAmount ?? null, platformAdSpendAmount: d.adSpendAmount ?? null, platformAdRoas: null, raw: d.raw,
    }))
  }

  async getChannelEconomics(range: DateRange): Promise<ChannelRow[]> {
    const daily = await this.getPlatformDaily(range)
    const rows: ChannelRow[] = []
    for (const p of ['doordash', 'ubereats'] as const) {
      const mine = daily.filter((d) => d.platform === p)
      const orderCnt = mine.reduce((s, d) => s + (d.orderCnt ?? 0), 0)
      const gmv = mine.reduce((s, d) => s + (d.platformReportedSalesAmount ?? 0), 0)
      rows.push({ platform: p, orderCnt, validOrderCnt: orderCnt, gmvAmount: gmv, netRevenueAmount: Math.round(gmv * 0.72), commissionAmount: Math.round(gmv * 0.25), discountAmount: Math.round(gmv * 0.04), refundCnt: Math.round(orderCnt * 0.01), refundAmount: Math.round(gmv * 0.008), aovAmount: orderCnt ? Math.round(gmv / orderCnt) : null, currency: 'USD' })
    }
    return rows
  }
}

import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { decrypt } from '@/lib/crypto'
import { MockZoodataClient } from './mock'
import { McpZoodataClient } from './mcp'
import { fromZoodataPlatform, type ZoodataClient } from './types'

export * from './types'

/** Per-restaurant client: real MCP when the restaurant has its own key, else mock. */
export function zoodataFor(restaurant: { id: string; zoodataKeyCiphertext: string | null }): { client: ZoodataClient; source: 'zoodata' | 'mock' } {
  if (process.env.ZOODATA_MODE === 'mock') return { client: new MockZoodataClient(restaurant.id), source: 'mock' }
  const url = process.env.ZOODATA_MCP_URL ?? 'https://api.zoodata.ai/mcp-restaurant'
  let token: string | null = null
  if (restaurant.zoodataKeyCiphertext) { try { token = decrypt(restaurant.zoodataKeyCiphertext) } catch { token = null } }
  // No per-restaurant key → sample data. The global ZOODATA_MCP_TOKEN is a test key for another
  // restaurant and must never be attributed to a customer's store.
  if (!token) return { client: new MockZoodataClient(restaurant.id), source: 'mock' }
  return { client: new McpZoodataClient(url, token), source: 'zoodata' }
}

const isoDaysAgo = (n: number, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - n * 86_400_000))

/** Pull [today-daysBack, yesterday] per restaurant into daily_metrics (late corrections overwrite). */
export async function zoodataSync(restaurantId?: string, daysBack = 3) {
  const rs = restaurantId
    ? await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId))
    : await db.select().from(schema.restaurants).where(eq(schema.restaurants.onboardingStep, 'done'))
  for (const r of rs) {
    try {
      const { client, source } = zoodataFor(r)
      const range = { start: isoDaysAgo(daysBack, r.timezone), end: isoDaysAgo(1, r.timezone) }
      // Order feed (platform_health) is the source of truth for orders and sales — the merchant portal's
      // own daily report lags by days on DoorDash. The portal still supplies ad spend, ROAS, rating, downtime.
      const [health, daily] = await Promise.all([client.getPlatformHealth(range), client.getPlatformDaily(range)])
      const dailyBy = new Map(daily.map((d) => [`${d.platform}:${d.date}`, d]))
      const seen = new Set<string>()
      const upserts: Array<typeof schema.dailyMetrics.$inferInsert> = []
      for (const h of health) {
        const platform = fromZoodataPlatform(h.platform)
        if (!platform || !h.date) continue
        seen.add(`${h.platform}:${h.date}`)
        const d = dailyBy.get(`${h.platform}:${h.date}`)
        const orders = h.ordersCnt ?? h.platformOrderVolume ?? d?.orderCnt ?? null
        const gmv = h.ordersGmvAmount ?? h.platformSalesAmount ?? d?.platformReportedSalesAmount ?? null
        const adSpend = h.platformAdSpendAmount ?? d?.adSpendAmount ?? null
        const adSales = h.adAttributedGmvAmount ?? (adSpend != null && h.platformAdRoas != null && adSpend > 0 ? Math.round(adSpend * h.platformAdRoas) : d?.adAttributedSalesAmount ?? null)
        upserts.push({
          restaurantId: r.id, platform, date: h.date, orders, gmvCents: gmv, aovCents: orders && gmv ? Math.round(gmv / orders) : null,
          adSpendCents: adSpend, adAttributedOrders: h.adAttributedOrdersCnt ?? d?.adAttributedOrderCnt ?? null, adAttributedSalesCents: adSales,
          avgRating: d?.rating != null ? String(d.rating) : null, downtimeMinutes: d?.downtimeMinutes ?? null,
          isMature: h.isMature !== false, source, raw: { health: h.raw, daily: d?.raw ?? null }, fetchedAt: new Date(), updatedAt: new Date(),
        })
      }
      // Days the order feed did not cover but the portal did (older history): fall back to the portal report.
      for (const row of daily) {
        const platform = fromZoodataPlatform(row.platform)
        if (!platform || !row.date || seen.has(`${row.platform}:${row.date}`)) continue
        if (row.isMature === false && source === 'zoodata') continue
        const aov = row.orderCnt && row.platformReportedSalesAmount ? Math.round(row.platformReportedSalesAmount / row.orderCnt) : null
        upserts.push({
          restaurantId: r.id, platform, date: row.date, orders: row.orderCnt ?? null, gmvCents: row.platformReportedSalesAmount ?? null,
          aovCents: aov, adSpendCents: row.adSpendAmount ?? null, adAttributedOrders: row.adAttributedOrderCnt ?? null, adAttributedSalesCents: row.adAttributedSalesAmount ?? null,
          avgRating: row.rating != null ? String(row.rating) : null, downtimeMinutes: row.downtimeMinutes ?? null,
          isMature: row.isMature !== false, source, raw: row.raw, fetchedAt: new Date(), updatedAt: new Date(),
        })
      }
      for (const values of upserts as Array<typeof schema.dailyMetrics.$inferInsert>) {
        await db.insert(schema.dailyMetrics).values(values)
          .onConflictDoUpdate({ target: [schema.dailyMetrics.restaurantId, schema.dailyMetrics.platform, schema.dailyMetrics.date], set: values })
      }
    } catch (e) {
      console.error('[zoodataSync]', r.id, (e as Error).message)
    }
  }
}

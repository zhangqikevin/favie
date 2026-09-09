import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import type { Platform } from '@/lib/db/schema'

export type MetricRow = typeof schema.dailyMetrics.$inferSelect

export function isoDaysAgo(n: number, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - n * 86_400_000))
}

/** Rows from Zoodata/mock only (platform_ui rows are MTD spend snapshots, not daily figures). */
export async function getDailyMetricsRange(restaurantId: string, start: string, end: string) {
  const rows = await db.select().from(schema.dailyMetrics)
    .where(and(eq(schema.dailyMetrics.restaurantId, restaurantId), gte(schema.dailyMetrics.date, start), lte(schema.dailyMetrics.date, end)))
    .orderBy(asc(schema.dailyMetrics.date))
  return rows.filter((r) => r.source !== 'platform_ui')
}

export interface DaySeries { date: string; orders: number | null; gmvCents: number | null; adSpendCents: number | null }

export function seriesByPlatform(rows: MetricRow[], start: string, end: string) {
  const days: string[] = []
  for (const d = new Date(start + 'T00:00:00Z'); d <= new Date(end + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10))
  const out: Record<Platform | 'all', DaySeries[]> = { uber_eats: [], doordash: [], all: [] }
  for (const date of days) {
    const per = (['uber_eats', 'doordash'] as Platform[]).map((p) => {
      const r = rows.find((x) => x.date === date && x.platform === p)
      const s: DaySeries = { date, orders: r?.orders ?? null, gmvCents: r?.gmvCents ?? null, adSpendCents: r?.adSpendCents ?? null }
      out[p].push(s)
      return s
    })
    const sum = (k: 'orders' | 'gmvCents' | 'adSpendCents') => per.every((x) => x[k] == null) ? null : per.reduce((a, x) => a + (x[k] ?? 0), 0)
    out.all.push({ date, orders: sum('orders'), gmvCents: sum('gmvCents'), adSpendCents: sum('adSpendCents') })
  }
  return out
}

export function totals(series: DaySeries[]) {
  const orders = series.reduce((a, x) => a + (x.orders ?? 0), 0)
  const gmv = series.reduce((a, x) => a + (x.gmvCents ?? 0), 0)
  const ad = series.reduce((a, x) => a + (x.adSpendCents ?? 0), 0)
  return { orders, gmvCents: gmv, adSpendCents: ad, aovCents: orders ? Math.round(gmv / orders) : null }
}

export interface MtdPlatform { orders: number; gmvCents: number; adSpendCents: number; adAttributedOrders: number; adAttributedSalesCents: number | null; days: number }
export interface MonthToDate {
  monthStart: string; today: string; daysElapsed: number; daysInMonth: number; daysRemaining: number
  source: 'zoodata' | 'mock' | null
  byPlatform: Record<Platform, MtdPlatform>
}

/** Month-to-date roll-up per platform from daily_metrics (Zoodata/mock rows only). */
export async function monthToDate(restaurantId: string, timezone: string): Promise<MonthToDate> {
  const today = isoDaysAgo(0, timezone)
  const monthStart = today.slice(0, 8) + '01'
  const [y, m] = today.split('-').map(Number) as [number, number, number]
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const dayOfMonth = Number(today.slice(8, 10))
  const rows = await getDailyMetricsRange(restaurantId, monthStart, today)
  const empty = (): MtdPlatform => ({ orders: 0, gmvCents: 0, adSpendCents: 0, adAttributedOrders: 0, adAttributedSalesCents: null, days: 0 })
  const byPlatform: Record<Platform, MtdPlatform> = { uber_eats: empty(), doordash: empty() }
  for (const r of rows) {
    const b = byPlatform[r.platform]
    b.orders += r.orders ?? 0; b.gmvCents += r.gmvCents ?? 0; b.adSpendCents += r.adSpendCents ?? 0; b.adAttributedOrders += r.adAttributedOrders ?? 0; b.days += 1
    if (r.adAttributedSalesCents != null) b.adAttributedSalesCents = (b.adAttributedSalesCents ?? 0) + r.adAttributedSalesCents
  }
  const source = rows.some((r) => r.source === 'zoodata') ? 'zoodata' : rows.length ? 'mock' : null
  return { monthStart, today, daysElapsed: dayOfMonth, daysInMonth, daysRemaining: Math.max(1, daysInMonth - dayOfMonth + 1), source, byPlatform }
}

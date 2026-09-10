import { NextResponse } from 'next/server'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { sha256 } from '@/lib/crypto'
import { PORTAL_URL } from '@/lib/zoowork/handoff'
import { billingOk } from '@/server/billing/gate'
import type { Platform } from '@/lib/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function resolveAgentByToken(token: string) {
  if (!token || token.length < 20) return null
  const hash = sha256(token)
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.ctxTokenHash, hash)).limit(1)
  return agent ?? null
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function localCalendar(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long' }).formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === 'year')!.value), m = Number(parts.find((p) => p.type === 'month')!.value), d = Number(parts.find((p) => p.type === 'day')!.value)
  const weekday = parts.find((p) => p.type === 'weekday')!.value
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  const iso = (dd: number) => `${y}-${mm}-${String(dd).padStart(2, '0')}`
  const shift = (days: number) => new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10)
  return { runDate: iso(d), weekday, isReviewDay: weekday === 'Monday', daysRemaining: last - d + 1, monthStart: iso(1), shift }
}

type Window = { orders: number; sales_cents: number; aov_cents: number | null; ad_spend_cents: number; ad_attributed_sales_cents: number | null; roas: number | null; days_with_data: number }

/** Roll the order-feed rows of one platform up into a window the agent can reason about. */
function rollup(rows: (typeof schema.dailyMetrics.$inferSelect)[], platform: Platform, start: string, end: string): Window {
  const mine = rows.filter((r) => r.platform === platform && r.date >= start && r.date <= end && r.source !== 'platform_ui')
  const orders = mine.reduce((a, r) => a + (r.orders ?? 0), 0)
  const sales = mine.reduce((a, r) => a + (r.gmvCents ?? 0), 0)
  const ad = mine.reduce((a, r) => a + (r.adSpendCents ?? 0), 0)
  const attributed = mine.some((r) => r.adAttributedSalesCents != null) ? mine.reduce((a, r) => a + (r.adAttributedSalesCents ?? 0), 0) : null
  return {
    orders, sales_cents: sales, aov_cents: orders ? Math.round(sales / orders) : null, ad_spend_cents: ad,
    ad_attributed_sales_cents: attributed, roas: attributed != null && ad > 0 ? Math.round((attributed / ad) * 10) / 10 : null, days_with_data: mine.length,
  }
}

/** The agent fetches this once per run: caps, spend so far, recent performance, login labels, and the kill switch. No secrets. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const agent = await resolveAgentByToken(token)
  if (!agent) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, agent.restaurantId)).limit(1)
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.restaurantId, r.id)).limit(1)
  const [owner] = await db.select({ locale: schema.users.locale }).from(schema.users).where(eq(schema.users.id, r.ownerUserId)).limit(1)
  const LANG: Record<string, string> = { en: 'English', 'zh-CN': 'Simplified Chinese (简体中文)', 'zh-TW': 'Traditional Chinese (繁體中文)', es: 'Spanish (Español)', ja: 'Japanese (日本語)' }
  const conns = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.restaurantId, r.id))
  const caps = await db.select().from(schema.adCaps).where(eq(schema.adCaps.restaurantId, r.id))
  const cal = localCalendar(r.timezone)

  // Order-feed rows for the last 28 days (plus the 7 before, for week-over-week) and this month's spend.
  const histStart = cal.shift(35), yesterday = cal.shift(1)
  const rows = await db.select().from(schema.dailyMetrics)
    .where(and(eq(schema.dailyMetrics.restaurantId, r.id), gte(schema.dailyMetrics.date, histStart < cal.monthStart ? histStart : cal.monthStart), lte(schema.dailyMetrics.date, cal.runDate)))
    .orderBy(desc(schema.dailyMetrics.date))
  const mtdAds = await db.select({ platform: schema.dailyMetrics.platform, spend: sql<number>`coalesce(sum(${schema.dailyMetrics.adSpendCents}), 0)` })
    .from(schema.dailyMetrics)
    .where(and(eq(schema.dailyMetrics.restaurantId, r.id), gte(schema.dailyMetrics.date, cal.monthStart), eq(schema.dailyMetrics.source, 'zoodata')))
    .groupBy(schema.dailyMetrics.platform)
  // Promotion cost is only known from the portal: take the latest month-to-date snapshot the agent reported this month.
  const latestPortal = (platform: Platform) => rows.find((x) => x.platform === platform && x.source === 'platform_ui' && x.date >= cal.monthStart)

  await db.insert(schema.zooworkOpsLog).values({ restaurantAgentId: agent.id, op: 'ctx_fetch', request: { ua: req.headers.get('user-agent') } }).catch(() => {})

  return NextResponse.json({
    restaurant: { name: r.name, timezone: r.timezone },
    language: LANG[owner?.locale ?? 'en'] ?? 'English',
    run_date: cal.runDate,
    actions_enabled: r.agentActionsEnabled,
    weekday: cal.weekday,
    is_review_day: cal.isReviewDay,
    days_remaining_in_month: cal.daysRemaining,
    service_disabled: r.serviceDisabled || !billingOk(sub?.status),
    platforms: conns.map((c) => {
      const cap = caps.find((x) => x.platform === c.platform)?.monthlyCapCents ?? null
      const adsFromFeed = mtdAds.find((x) => x.platform === c.platform)?.spend
      const portal = latestPortal(c.platform)
      // Portal snapshot (what the merchant is actually billed) beats the feed when it is newer.
      const mtdAdsCents = portal?.adSpendCents ?? (adsFromFeed == null ? null : Number(adsFromFeed))
      const mtdPromoCents = portal?.promoSpendCents ?? null
      const newShare = (portal?.raw as { new_customer_share?: number | null } | null)?.new_customer_share ?? null
      return {
        platform: c.platform,
        // Only platforms whose login the user completed are worked; awaiting/not_started are skipped.
        enabled: c.status === 'connected' || c.status === 'broken' || c.status === 'verifying',
        actions_enabled: r.agentActionsEnabled,
        portal_url: PORTAL_URL[c.platform],
        store_name: c.storeName,
        store_address: c.storeAddress,
        store_external_id: c.storeExternalId,
        marketing: {
          cap_cents: cap,
          mtd_ads_cents: mtdAdsCents,
          mtd_promo_cents: mtdPromoCents,
          mtd_total_cents: mtdAdsCents == null && mtdPromoCents == null ? null : (mtdAdsCents ?? 0) + (mtdPromoCents ?? 0),
        },
        performance: {
          last7: rollup(rows, c.platform, cal.shift(7), yesterday),
          last28: rollup(rows, c.platform, cal.shift(28), yesterday),
          prev7: rollup(rows, c.platform, cal.shift(14), cal.shift(8)),
          new_customer_share: newShare,
        },
        monthly_cap_cents: cap,
        mtd_spend_cents: mtdAdsCents,
        days_remaining_in_month: cal.daysRemaining,
        login_label: r.browserLoginLabel ?? c.loginLabel ?? `favie-${r.id.slice(0, 8)}`,
      }
    }),
  }, { headers: { 'cache-control': 'no-store' } })
}

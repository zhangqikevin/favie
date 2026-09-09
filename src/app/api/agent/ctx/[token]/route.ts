import { NextResponse } from 'next/server'
import { and, eq, gte, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { sha256 } from '@/lib/crypto'
import { PORTAL_URL } from '@/lib/zoowork/handoff'
import { billingOk } from '@/server/billing/gate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function resolveAgentByToken(token: string) {
  if (!token || token.length < 20) return null
  const hash = sha256(token)
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.ctxTokenHash, hash)).limit(1)
  return agent ?? null
}

function monthInfo(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === 'year')!.value), m = Number(parts.find((p) => p.type === 'month')!.value), d = Number(parts.find((p) => p.type === 'day')!.value)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { runDate: `${y}-${mm}-${String(d).padStart(2, '0')}`, daysRemaining: last - d + 1, monthStart: `${y}-${mm}-01` }
}

/** The agent fetches this once per run: caps, spend so far, login labels, and the kill switch. No secrets. */
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
  const { runDate, daysRemaining, monthStart } = monthInfo(r.timezone)
  const mtd = await db.select({ platform: schema.dailyMetrics.platform, spend: sql<number>`coalesce(sum(${schema.dailyMetrics.adSpendCents}), 0)` })
    .from(schema.dailyMetrics)
    .where(and(eq(schema.dailyMetrics.restaurantId, r.id), gte(schema.dailyMetrics.date, monthStart), eq(schema.dailyMetrics.source, 'zoodata')))
    .groupBy(schema.dailyMetrics.platform)

  await db.insert(schema.zooworkOpsLog).values({ restaurantAgentId: agent.id, op: 'ctx_fetch', request: { ua: req.headers.get('user-agent') } }).catch(() => {})

  return NextResponse.json({
    restaurant: { name: r.name, timezone: r.timezone },
    language: LANG[owner?.locale ?? 'en'] ?? 'English',
    run_date: runDate,
    service_disabled: r.serviceDisabled || !billingOk(sub?.status),
    platforms: conns.map((c) => ({
      platform: c.platform,
      // Only platforms whose login the user completed are worked; awaiting/not_started are skipped.
      enabled: c.status === 'connected' || c.status === 'broken' || c.status === 'verifying',
      portal_url: PORTAL_URL[c.platform],
      store_name: c.storeName,
      store_address: c.storeAddress,
      store_external_id: c.storeExternalId,
      monthly_cap_cents: caps.find((x) => x.platform === c.platform)?.monthlyCapCents ?? null,
      mtd_spend_cents: (() => { const s = mtd.find((x) => x.platform === c.platform)?.spend; return s == null ? null : Number(s) })(),
      days_remaining_in_month: daysRemaining,
      login_label: r.browserLoginLabel ?? c.loginLabel ?? `favie-${r.id.slice(0, 8)}`,
    })),
  }, { headers: { 'cache-control': 'no-store' } })
}

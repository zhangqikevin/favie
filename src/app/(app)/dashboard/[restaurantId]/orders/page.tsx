import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getConnections } from '@/server/restaurants'
import { getDailyMetricsRange, isoDaysAgo, seriesByPlatform, totals } from '@/server/metrics'
import { OrdersChart } from './OrdersChart'
import { getT } from '@/i18n/server'

const money = (c: number | null) => (c == null ? '—' : `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)

export default async function OrdersPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const start = isoDaysAgo(29, r.timezone), end = isoDaysAgo(1, r.timezone)
  const prevStart = isoDaysAgo(59, r.timezone), prevEnd = isoDaysAgo(30, r.timezone)
  const [rows, prevRows, conns] = await Promise.all([getDailyMetricsRange(r.id, start, end), getDailyMetricsRange(r.id, prevStart, prevEnd), getConnections(r.id)])
  const series = seriesByPlatform(rows, start, end)
  const tot = totals(series.all)
  const prev = totals(seriesByPlatform(prevRows, prevStart, prevEnd).all)
  const delta = (cur: number | null, before: number | null) => (cur == null || !before ? null : Math.round(((cur - before) / before) * 100))
  const source = rows.find((x) => x.source === 'zoodata') ? 'zoodata' : rows.length ? 'mock' : null
  const earliestConnected = conns.filter((c) => c.status === 'connected').map((c) => c.verifiedAt).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] ?? null
  const hoursSinceConnect = earliestConnected ? (Date.now() - earliestConnected.getTime()) / 3600_000 : null
  const { t } = await getT()

  if (rows.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="font-display text-xl font-bold">{t('orders.empty.t')}</p>
        <p className="mx-auto mt-2 max-w-md text-ink-500">
          {earliestConnected
            ? hoursSinceConnect! < 48
              ? t('orders.empty.waiting', { h: Math.max(1, Math.round(48 - hoursSinceConnect!)) })
              : t('orders.empty.late')
            : t('orders.empty.connect')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('orders.stat.orders')} value={tot.orders.toLocaleString('en-US')} delta={delta(tot.orders, prev.orders)} sub={t('orders.vsPrev', { n: 30 })} />
        <Stat label={t('orders.stat.sales')} value={money(tot.gmvCents)} delta={delta(tot.gmvCents, prev.gmvCents)} sub={t('orders.vsPrev', { n: 30 })} />
        <Stat label={t('orders.stat.aov')} value={money(tot.aovCents)} delta={delta(tot.aovCents, prev.aovCents)} sub={t('orders.vsPrev', { n: 30 })} />
        <Stat label={t('orders.stat.ad')} value={money(tot.adSpendCents)} delta={delta(tot.adSpendCents, prev.adSpendCents)} invert sub={t('orders.vsPrev', { n: 30 })} />
      </div>
      <OrdersChart series={series} />
      <p className="text-xs text-ink-500">
        {source === 'zoodata' ? t('orders.source.zoodata') : t('orders.source.mock')} · {t('orders.range', { start, end, tz: r.timezone })}
      </p>
    </div>
  )
}

/** KPI card: gray caption, big value, green/red delta pill (`invert` = lower is better, e.g. spend). */
function Stat({ label, value, delta, sub, invert = false }: { label: string; value: string; delta: number | null; sub: string; invert?: boolean }) {
  const good = delta == null ? null : invert ? delta <= 0 : delta >= 0
  return (
    <div className="card p-6">
      <p className="text-xs text-ink-500">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
        {delta != null && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{delta > 0 ? '+' : ''}{delta}%</span>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-500">{sub}</p>
    </div>
  )
}

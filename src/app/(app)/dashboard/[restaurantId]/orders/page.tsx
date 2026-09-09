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
  const [rows, conns] = await Promise.all([getDailyMetricsRange(r.id, start, end), getConnections(r.id)])
  const series = seriesByPlatform(rows, start, end)
  const tot = totals(series.all)
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
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={t('orders.stat.orders')} value={tot.orders.toLocaleString('en-US')} />
        <Stat label={t('orders.stat.sales')} value={money(tot.gmvCents)} />
        <Stat label={t('orders.stat.aov')} value={money(tot.aovCents)} />
        <Stat label={t('orders.stat.ad')} value={money(tot.adSpendCents)} />
      </div>
      <OrdersChart series={series} />
      <p className="text-xs text-ink-500">
        {source === 'zoodata' ? t('orders.source.zoodata') : t('orders.source.mock')} · {t('orders.range', { start, end, tz: r.timezone })}
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</p>
      <p className="font-display mt-1 text-3xl font-bold">{value}</p>
    </div>
  )
}

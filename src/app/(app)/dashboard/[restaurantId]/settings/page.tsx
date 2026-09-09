import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getSubscription, getConnections } from '@/server/restaurants'
import { getDailyMetricsRange, isoDaysAgo, seriesByPlatform } from '@/server/metrics'
import { refundDaysLeft } from '@/server/billing/gate'
import { openBillingPortal } from '../actions'
import { getT } from '@/i18n/server'
import { INTL_TAG } from '@/i18n/config'
import { PlatformLinkage } from '@/components/PlatformLinkage'
import { OrderDataCard } from './OrderDataCard'

export default async function SettingsPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const start = isoDaysAgo(14, r.timezone), end = isoDaysAgo(1, r.timezone)
  const [sub, conns, rows] = await Promise.all([getSubscription(r.id), getConnections(r.id), getDailyMetricsRange(r.id, start, end)])
  const spark = seriesByPlatform(rows, start, end).all.map((d) => ({ date: d.date, orders: d.orders }))
  const updatedAt = rows.reduce<Date | null>((a, x) => (!a || x.fetchedAt > a ? x.fetchedAt : a), null)
  const source = rows.some((x) => x.source === 'zoodata') ? 'zoodata' : rows.length ? 'mock' : null
  const daysLeft = refundDaysLeft(sub?.firstPaidAt)
  const { t, locale } = await getT()
  const intl = INTL_TAG[locale]

  return (
    <div className="space-y-6">
      <section className="card p-7 sm:p-9">
        <div className="mb-6 text-center">
          <h2 className="font-display text-lg font-bold">{t('settings.platforms')}</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-ink-500">{t('settings.platformsBody')}</p>
        </div>
        <PlatformLinkage conns={conns.map((c) => ({ platform: c.platform, status: c.status, storeName: c.storeName }))} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-7">
          <h2 className="font-display text-lg font-bold">{t('settings.restaurant')}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-ink-500">{t('settings.name')}</dt><dd className="font-medium">{r.name}</dd></div>
            <div><dt className="text-ink-500">{t('settings.address')}</dt><dd className="font-medium">{[r.addressLine, r.city, r.state, r.zip].filter(Boolean).join(', ') || conns.find((c) => c.storeAddress)?.storeAddress || '—'}</dd></div>
            <div><dt className="text-ink-500">{t('prefs.tz.title')}</dt><dd className="font-medium">{r.timezone}</dd></div>
          </dl>
        </section>

        <section className="card p-7">
          <h2 className="font-display text-lg font-bold">{t('settings.data')}</h2>
          <OrderDataCard restaurantId={r.id} timezone={r.timezone} hasKey={!!r.zoodataKeyCiphertext} days={spark} updatedAt={updatedAt?.toISOString() ?? null} source={source} />
        </section>
      </div>

      <section className="rounded-2xl border border-dashed border-ink-300/60 px-6 py-5 text-sm text-ink-500">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="font-semibold text-ink-700">{t('settings.billing')}</h2>
          <dl className="flex flex-wrap gap-x-6 gap-y-1">
            <div className="flex gap-1.5"><dt>{t('settings.plan')}:</dt><dd className="text-ink-700">{t('settings.planValue')}</dd></div>
            <div className="flex gap-1.5"><dt>{t('settings.status')}:</dt><dd className="capitalize text-ink-700">{sub?.status.replace('_', ' ') ?? t('settings.notStarted')}</dd></div>
            {sub?.currentPeriodEnd && <div className="flex gap-1.5"><dt>{sub.cancelAtPeriodEnd ? t('settings.ends') : t('settings.nextCharge')}:</dt><dd className="text-ink-700">{sub.currentPeriodEnd.toLocaleDateString(intl, { timeZone: r.timezone })}</dd></div>}
            {sub?.firstPaidAt && (
              <div className="flex gap-1.5"><dt>{t('settings.refundWindow')}:</dt>
                <dd className="text-ink-700">{sub.refundedAt ? t('settings.refunded') : daysLeft && daysLeft > 0 ? t('settings.daysLeft', { n: daysLeft }) : t('settings.closed')}</dd></div>
            )}
          </dl>
          <form action={openBillingPortal}>
            <input type="hidden" name="restaurantId" value={r.id} />
            <button type="submit" className="text-xs underline-offset-2 hover:text-ink-900 hover:underline disabled:opacity-50" disabled={!sub}>{t('settings.manage')}</button>
          </form>
        </div>
        {sub?.firstPaidAt && daysLeft && daysLeft > 0 && !sub.refundedAt && (
          <p className="mt-3 text-xs">
            {t('settings.refundNote.pre')}<a className="underline" href="mailto:hello@favie.us?subject=Refund%20request">hello@favie.us</a>{t('settings.refundNote.post')}
          </p>
        )}
      </section>
    </div>
  )
}

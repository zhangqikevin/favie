import { SampleDataNotice } from '@/components/SampleDataNotice'
import { notFound } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getAdCaps, PLATFORM_LABEL, PLATFORMS } from '@/server/restaurants'
import { monthToDate } from '@/server/metrics'
import { PlatformIcon } from '@/components/PlatformIcon'
import { AdCapForm } from './AdCapForm'
import { Donut } from './Donut'
import { getT } from '@/i18n/server'
import { INTL_TAG } from '@/i18n/config'

const money = (c: number | null | undefined, frac = 0) => (c == null ? '—' : `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: frac, minimumFractionDigits: frac })}`)

export default async function MarketingPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const [caps, mtd, history] = await Promise.all([
    getAdCaps(r.id),
    monthToDate(r.id, r.timezone),
    db.select().from(schema.adCapHistory).where(eq(schema.adCapHistory.restaurantId, r.id)).orderBy(desc(schema.adCapHistory.changedAt)).limit(20),
  ])
  const { t, locale } = await getT()
  const intl = INTL_TAG[locale]
  const monthName = new Date(mtd.today + 'T00:00:00Z').toLocaleDateString(intl, { month: 'long', timeZone: 'UTC' })

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {mtd.source === 'mock' && <div className="lg:col-span-3"><SampleDataNotice restaurantId={r.id} /></div>}
      <div className="space-y-6 lg:col-span-2">
        {PLATFORMS.map((p) => {
          const cap = caps[p]
          const m = mtd.byPlatform[p]
          const adSpend = m.adSpendCents
          const promoSpend = m.promoSpendCents
          const spend = adSpend + (promoSpend ?? 0) // the cap covers ads + promotions together
          const pct = cap ? Math.min(100, Math.round((spend / cap) * 100)) : 0
          const remaining = cap ? cap - spend : null
          const pace = remaining != null ? Math.max(0, remaining) / mtd.daysRemaining : null
          const aov = m.orders ? m.gmvCents / m.orders : null
          // Platform-reported ROAS × spend when available; otherwise estimate from attributed orders × AOV.
          const adSales = m.adAttributedSalesCents ?? (aov != null && m.adAttributedOrders ? Math.round(m.adAttributedOrders * aov) : null)
          const roas = adSales != null && adSpend > 0 ? adSales / adSpend : null
          const share = m.gmvCents > 0 ? (adSpend / m.gmvCents) * 100 : null
          const hasData = m.days > 0
          return (
            <section key={p} className="card p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={p} className="h-11 w-11 rounded-2xl" />
                  <div>
                    <h2 className="font-display text-lg font-semibold">{PLATFORM_LABEL[p]}</h2>
                    <p className="text-xs text-ink-500">{t('mkt.daysLeft', { n: mtd.daysRemaining, month: monthName })}</p>
                  </div>
                </div>
                <p className="text-right text-sm text-ink-500">
                  {t('caps.thisMonth')} <span className="font-display text-xl font-bold text-ink-900">{money(spend)}</span>{cap ? <span> {t('caps.of')} {money(cap)}</span> : null}
                </p>
              </div>

              {cap ? (
                <div className="mt-4">
                  <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 85 ? 'bg-amber-500' : p === 'uber_eats' ? 'bg-uber' : 'bg-doordash'}`} style={{ width: `${pct}%` }} />
                  </div>
                  {pct >= 100 && <p className="mt-2 text-xs font-medium text-red-700">{t('mkt.over')}</p>}
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-700">{t('caps.none')}</p>
              )}

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Cell label={t('mkt.spent')} value={money(spend)} sub={`${t('mkt.adsSpent')} ${money(adSpend)} · ${t('mkt.promoSpent')} ${promoSpend == null ? '—' : money(promoSpend)}`} />
                <Cell label={t('mkt.cap')} value={cap ? money(cap) : '—'} />
                <Cell label={t('mkt.remaining')} value={remaining == null ? '—' : money(Math.max(0, remaining))} tone={remaining != null && remaining <= 0 ? 'warn' : undefined} />
                <Cell label={t('mkt.pace')} value={pace == null ? '—' : `${money(Math.round(pace))}/d`} />
                <Cell label={t('mkt.orders')} value={hasData ? m.orders.toLocaleString(intl) : '—'} />
                <Cell label={t('mkt.sales')} value={hasData ? money(m.gmvCents) : '—'} />
                {/* Attribution only means something when ads actually ran: with $0 spend the feed's "ad-attributed" flags are noise (promotions, stale tags). */}
                <Cell label={t('mkt.attributed')} value={hasData && adSpend > 0 && m.adAttributedOrders ? m.adAttributedOrders.toLocaleString(intl) : '—'} sub={hasData && adSpend > 0 && m.orders && m.adAttributedOrders ? `${Math.round((m.adAttributedOrders / m.orders) * 100)}%` : undefined} />
                <Cell label={t('mkt.roas')} value={roas == null ? '—' : `${roas.toFixed(1)}×`} sub={adSales == null || adSpend <= 0 ? undefined : `${t('mkt.adSales')} ${money(adSales)}`} tone={roas == null ? undefined : roas >= 2.5 ? 'ok' : 'warn'} />
              </dl>
              {hasData && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink-100/60 p-4">
                  <div>
                    <p className="text-xs text-ink-500">{t('mkt.donut.title')}</p>
                    {share != null && <p className="mt-1 text-xs text-ink-500">{t('mkt.share')}: <span className="font-semibold text-ink-900">{share.toFixed(1)}%</span></p>}
                  </div>
                  {/* Platform attribution uses a multi-day window, so it can exceed a short month-to-date total: never draw more than 100%. */}
                  <Donut adCents={adSpend > 0 && adSales != null ? Math.min(adSales, m.gmvCents) : null} totalCents={m.gmvCents} labelAd={t('mkt.donut.ad')} labelOrganic={t('mkt.donut.organic')} none={t('mkt.donut.none')} />
                </div>
              )}
              {!hasData && <p className="mt-3 text-xs text-ink-500">{t('mkt.noData')}</p>}
              {hasData && promoSpend == null && cap != null && <p className="mt-3 text-xs text-ink-500">{t('mkt.promoUnknown')}</p>}

              <AdCapForm restaurantId={r.id} platform={p} currentCents={cap} />
            </section>
          )
        })}
        <p className="text-xs text-ink-500">{t('mkt.roasNote')}{mtd.source === 'mock' ? ` ${t('mkt.sample')}` : ''}</p>
      </div>
      <aside className="card p-6">
        <h3 className="font-display text-base font-semibold">{t('caps.history')}</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">{t('caps.noHistory')}</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {history.map((h) => (
              <li key={h.id} className="border-b border-ink-100 pb-3 last:border-0">
                <p className="font-medium">{PLATFORM_LABEL[h.platform]}: {money(h.oldCapCents)} → {money(h.newCapCents)}</p>
                <p className="text-xs text-ink-500">{h.changedAt.toLocaleString(intl, { timeZone: r.timezone })}</p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

function Cell({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className={`font-display mt-0.5 text-xl font-bold ${tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-emerald-700' : ''}`}>{value}</dd>
      {sub && <dd className="text-xs text-ink-500">{sub}</dd>}
    </div>
  )
}

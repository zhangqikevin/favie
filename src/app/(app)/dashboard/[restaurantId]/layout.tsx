import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getSubscription } from '@/server/restaurants'
import { logOut } from '@/app/(auth)/actions'
import { getT } from '@/i18n/server'
import { AppHeader, type NavItem } from './AppHeader'
import { PageTitle } from './PageTitle'
import Link from 'next/link'

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ restaurantId: string }> }) {
  const t0 = Date.now()
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const base = `/dashboard/${r.id}`
  const sub = await getSubscription(r.id)
  const restaurant = { name: r.name, place: [r.city, r.state].filter(Boolean).join(', ') || null }
  const { t } = await getT()
  const items: NavItem[] = [
    { href: base, key: 'dash.nav.activity', exact: true },
    { href: `${base}/menu`, key: 'dash.nav.menu' },
    { href: `${base}/disputes`, key: 'dash.nav.disputes' },
    { href: `${base}/marketing`, key: 'dash.nav.adCaps' },
    { href: `${base}/orders`, key: 'dash.nav.orders' },
    { href: `${base}/settings`, key: 'dash.nav.settings' },
  ]

  const layoutMs = Date.now() - t0
  if (layoutMs > 1500) console.warn(`[dashboard] slow layout data ${layoutMs}ms`)
  return (
    <div id="app-shell" className="app-shell min-h-screen">
      <AppHeader base={base} items={items} user={{ name: user.name, email: user.email }} restaurant={restaurant} logOut={logOut} />
      <div className="container-x pb-16 pt-6">
        <PageTitle base={base} />
        {sub && sub.status !== 'active' && (
          <Link href={`${base}/settings`} className="mb-6 inline-flex rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-medium text-amber-800">{t('dash.billing', { status: sub.status.replace('_', ' ') })}</Link>
        )}
        {children}
      </div>
    </div>
  )
}

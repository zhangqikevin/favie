import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getSubscription } from '@/server/restaurants'
import { getActionsForMonth, currentMonth, todayLocal } from '@/server/activity'
import { logOut } from '@/app/(auth)/actions'
import { getT } from '@/i18n/server'
import { AppHeader, ThemeScript, type NavItem } from './AppHeader'
import { PageTitle } from './PageTitle'
import Link from 'next/link'

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const base = `/dashboard/${r.id}`
  const today = todayLocal(r.timezone)
  const [sub, monthActions] = await Promise.all([getSubscription(r.id), getActionsForMonth(r.id, currentMonth(r.timezone))])
  const attention = monthActions.filter((a) => a.needsAttention && a.actionDate >= today.slice(0, 8) + '01').length
  const { t } = await getT()
  const items: NavItem[] = [
    { href: base, key: 'dash.nav.activity', exact: true },
    { href: `${base}/orders`, key: 'dash.nav.orders' },
    { href: `${base}/marketing`, key: 'dash.nav.adCaps' },
    { href: `${base}/settings`, key: 'dash.nav.settings' },
  ]

  return (
    <div id="app-shell" className="app-shell min-h-screen" suppressHydrationWarning>
      <ThemeScript />
      <AppHeader base={base} items={items} attention={attention} user={{ name: user.name, email: user.email }} todayHref={`${base}?day=${today}`} logOut={logOut} />
      <div className="container-x pb-16 pt-6">
        <PageTitle base={base} restaurant={{ name: r.name, place: [r.city, r.state].filter(Boolean).join(', ') || null }} />
        {sub && sub.status !== 'active' && (
          <Link href={`${base}/settings`} className="mb-6 inline-flex rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-medium text-amber-800">{t('dash.billing', { status: sub.status.replace('_', ' ') })}</Link>
        )}
        {children}
      </div>
    </div>
  )
}

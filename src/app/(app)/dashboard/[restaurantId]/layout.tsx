import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getConnections, getSubscription } from '@/server/restaurants'
import { Logo } from '@/components/marketing/Logo'
import { logOut } from '@/app/(auth)/actions'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getT } from '@/i18n/server'

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const [conns, sub] = await Promise.all([getConnections(r.id), getSubscription(r.id)])
  const base = `/dashboard/${r.id}`
  const { t } = await getT()

  return (
    <div className="min-h-screen bg-ink-100/60">
      <header className="border-b border-ink-100 bg-white">
        <div className="container-x flex h-16 items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link href={base} className="flex items-center gap-2.5">
              <Logo className="h-7 w-7" />
              <span className="font-display text-lg font-bold">{t('common.brand')}</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm font-medium text-ink-500 md:flex">
              <Link href={base} className="hover:text-ink-900">{t('dash.nav.activity')}</Link>
              <Link href={`${base}/orders`} className="hover:text-ink-900">{t('dash.nav.orders')}</Link>
              <Link href={`${base}/marketing`} className="hover:text-ink-900">{t('dash.nav.adCaps')}</Link>
              <Link href={`${base}/settings`} className="hover:text-ink-900">{t('dash.nav.settings')}</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {conns.map((c) => (
              <span
                key={c.platform}
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 font-medium sm:inline-flex ${
                  c.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : c.status === 'broken' ? 'bg-red-50 text-red-700' : 'bg-ink-100 text-ink-500'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${c.platform === 'uber_eats' ? 'bg-uber' : 'bg-doordash'}`} />
                {c.platform === 'uber_eats' ? 'Uber Eats' : 'DoorDash'} · {c.status === 'connected' ? t('dash.conn.connected') : c.status === 'broken' ? t('dash.conn.attention') : c.status === 'awaiting_login' || c.status === 'verifying' || c.status === 'select_store' ? t('dash.conn.connecting') : t('dash.conn.notConnected')}
              </span>
            ))}
            {sub && sub.status !== 'active' && (
              <Link href={`${base}/settings`} className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">{t('dash.billing', { status: sub.status.replace('_', ' ') })}</Link>
            )}
            <LanguageSwitcher />
            <form action={logOut}><button className="text-ink-500 hover:text-ink-900">{t('common.logOut')}</button></form>
          </div>
        </div>
      </header>
      <div className="container-x py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tight">{r.name}</h1>
          <p className="text-sm text-ink-500">{[r.city, r.state].filter(Boolean).join(', ')}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

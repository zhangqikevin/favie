'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/marketing/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'
import { RestaurantPill } from './PageTitle'

export type NavItem = { href: string; key: DictKey; exact?: boolean }

/** Top bar: small logo, text tabs with an underlined active tab, restaurant pill (global), avatar menu. */
export function AppHeader({ base, items, user, restaurant, logOut }: {
  base: string; items: NavItem[]
  user: { name: string | null; email: string }
  restaurant: { name: string; place: string | null }
  logOut: () => Promise<void>
}) {
  const t = useT()
  const pathname = usePathname()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menu])

  const initials = (user.name?.trim() || user.email).split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('')
  const isActive = (it: NavItem) => (it.exact ? pathname === it.href : pathname.startsWith(it.href))

  return (
    <header className="sticky top-0 z-30 bg-[color:var(--app-bg)]/85 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href={base} className="flex items-center gap-2" aria-label="Favie">
            <Logo className="h-9 w-9" />
            <span className="font-display text-[15px] font-semibold tracking-tight">{t('common.brand')}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            {items.map((it) => {
              const active = isActive(it)
              return (
                <Link key={it.href} href={it.href} className={`relative py-5 transition-colors ${active ? 'font-semibold text-ink-900' : 'text-ink-500 hover:text-ink-900'}`}>
                  {t(it.key)}
                  {active && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-ink-900" />}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block"><RestaurantPill restaurant={restaurant} /></div>
          {/* avatar + menu */}
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenu((m) => !m)} aria-label={t('header.account')} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#7C5CFF] via-[#3B6CFF] to-[#38C6F4] text-xs font-bold text-white shadow-sm">
              {initials || 'F'}
            </button>
            {menu && (
              <div className="card absolute right-0 mt-2 w-64 p-4 text-sm">
                <p className="truncate font-semibold">{user.name ?? user.email}</p>
                {user.name && <p className="truncate text-xs text-ink-500">{user.email}</p>}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
                  <span className="text-xs text-ink-500">{t('common.language')}</span>
                  <LanguageSwitcher />
                </div>
                <form action={logOut} className="mt-3 border-t border-ink-100 pt-3">
                  <button className="w-full text-left text-sm text-ink-700 hover:text-ink-900">{t('common.logOut')}</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Mobile tabs */}
      <div className="container-x pb-2 sm:hidden"><RestaurantPill restaurant={restaurant} /></div>
      <nav className="container-x flex gap-2 overflow-x-auto pb-3 md:hidden">
        {items.map((it) => <Link key={it.href} href={it.href} className={`pill whitespace-nowrap ${isActive(it) ? 'pill-active' : ''}`}>{t(it.key)}</Link>)}
      </nav>
    </header>
  )
}

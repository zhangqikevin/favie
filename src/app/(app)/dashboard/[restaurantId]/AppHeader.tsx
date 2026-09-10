'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/marketing/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'

const THEME_KEY = 'favie_theme'

export type NavItem = { href: string; key: DictKey; exact?: boolean }

/** Top bar: small logo, text tabs with an underlined active tab, light/dark pill, bell, avatar menu. */
export function AppHeader({ base, items, attention, user, todayHref, logOut }: {
  base: string; items: NavItem[]; attention: number
  user: { name: string | null; email: string }
  todayHref: string
  logOut: () => Promise<void>
}) {
  const t = useT()
  const pathname = usePathname()
  const [dark, setDark] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // The inline ThemeScript applied the saved theme before paint; mirror the DOM, never the other way round on mount.
  useEffect(() => { setDark(document.getElementById('app-shell')?.classList.contains('dark') ?? false) }, [])
  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.getElementById('app-shell')?.classList.toggle('dark', next)
    try { localStorage.setItem(THEME_KEY, next ? 'dark' : 'light') } catch {}
  }
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
            <Logo className="h-6 w-6" />
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
          {/* light / dark toggle pill */}
          <button type="button" onClick={toggleTheme} aria-label={dark ? t('theme.light') : t('theme.dark')} className="pill !gap-0 !px-1 !py-1">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${dark ? '' : 'bg-ink-900 text-white'}`}>
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="3.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" /></svg>
            </span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${dark ? 'bg-ink-900 text-[color:var(--app-bg)]' : ''}`}>
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" /></svg>
            </span>
          </button>
          {/* notification bell → today's attention items */}
          <Link href={todayHref} aria-label={t('header.notifications')} className="pill relative !h-9 !w-9 !p-0">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 8a5 5 0 0 1 10 0v3.2l1.3 2.3H3.7L5 11.2z" /><path d="M8 16a2 2 0 0 0 4 0" /></svg>
            {attention > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[color:var(--accent-orange)] ring-2 ring-[color:var(--card-bg)]" />}
          </Link>
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
      <nav className="container-x flex gap-2 overflow-x-auto pb-3 md:hidden">
        {items.map((it) => <Link key={it.href} href={it.href} className={`pill whitespace-nowrap ${isActive(it) ? 'pill-active' : ''}`}>{t(it.key)}</Link>)}
      </nav>
    </header>
  )
}

/** Restores the saved theme before paint to avoid a light flash. */
export function ThemeScript() {
  const js = `try{if(localStorage.getItem('${THEME_KEY}')==='dark')document.getElementById('app-shell').classList.add('dark')}catch(e){}`
  return <script dangerouslySetInnerHTML={{ __html: js }} />
}

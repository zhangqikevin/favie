'use client'
import { usePathname } from 'next/navigation'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'

/** Large light display title for the current section, plus the restaurant pill (a selector once accounts have several). */
export function PageTitle({ base, restaurant }: { base: string; restaurant: { name: string; place: string | null } }) {
  const t = useT()
  const pathname = usePathname()
  const seg = pathname.slice(base.length).split('/').filter(Boolean)[0] ?? ''
  const key: DictKey = seg === 'orders' ? 'dash.nav.orders' : seg === 'marketing' ? 'dash.nav.adCaps' : seg === 'settings' ? 'dash.nav.settings' : seg === 'runs' ? 'cal.viewRun' : 'dash.nav.activity'
  const title = key === 'cal.viewRun' ? t('runs.title') : t(key)
  return (
    <div className="mb-7 flex flex-wrap items-center gap-4">
      <h1 className="page-title">{title}</h1>
      <details className="relative">
        <summary className="pill cursor-pointer list-none select-none">
          <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#38C6F4]" />
          <span className="max-w-[16rem] truncate">{restaurant.name}</span>
          {restaurant.place && <span className="hidden text-ink-500 sm:inline">· {restaurant.place}</span>}
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 8l4 4 4-4" /></svg>
        </summary>
        <div className="card absolute left-0 z-20 mt-2 min-w-[16rem] p-2 text-sm">
          <div className="rounded-2xl bg-ink-100 px-3 py-2 font-medium">{restaurant.name}</div>
          <p className="px-3 pb-1 pt-2 text-xs text-ink-500">{t('title.moreRestaurants')}</p>
        </div>
      </details>
    </div>
  )
}

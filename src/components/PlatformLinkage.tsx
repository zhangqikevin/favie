import Link from 'next/link'
import { Logo } from '@/components/marketing/Logo'
import { PlatformIcon } from '@/components/PlatformIcon'
import { PLATFORM_LABEL } from '@/server/restaurants'
import type { Platform } from '@/lib/db/schema'
import { getT } from '@/i18n/server'
import type { DictKey } from '@/i18n'

export interface LinkageConn { platform: Platform; status: string; storeName: string | null }

/**
 * Compact "platform rail": Favie on the left, one chip per delivery platform sitting on a single gradient
 * rail. Chips wrap, so the same card works for 0–4+ platforms (Uber Eats, DoorDash, HungryPanda, Fantuan…)
 * without growing taller than one row on desktop.
 */
export async function PlatformLinkage({ conns }: { conns: LinkageConn[] }) {
  const { t } = await getT()
  const connected = conns.filter((c) => c.status === 'connected')
  const headline = connected.length === 0
    ? t('settings.platforms.none')
    : connected.length === conns.length
      ? t('settings.platforms.both')
      : t('settings.platforms.one', { platform: connected.map((c) => PLATFORM_LABEL[c.platform]).join(' · ') })

  return (
    <section className="card px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Favie node + status line */}
        <div className="flex items-center gap-3 lg:w-72 lg:shrink-0">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--card-bg,white)] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <Logo className="h-6 w-6" />
            {connected.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--card-bg,white)] bg-emerald-500" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('settings.platforms')}</p>
            <p className="truncate text-xs text-ink-500" title={headline}>{headline}</p>
          </div>
        </div>

        {/* Rail with chips */}
        <div className="relative flex flex-1 flex-wrap items-center gap-3 lg:pl-2">
          <div
            aria-hidden="true"
            className={`absolute inset-x-0 top-1/2 hidden h-2 -translate-y-1/2 rounded-full lg:block ${connected.length ? 'opacity-60' : 'opacity-25'}`}
            style={{ background: 'linear-gradient(90deg, #7C5CFF, #3B6CFF 55%, #38C6F4)' }}
          />
          {conns.map((c) => <Chip key={c.platform} c={c} t={t} />)}
        </div>
      </div>
    </section>
  )
}

function Chip({ c, t }: { c: LinkageConn; t: (k: DictKey, v?: Record<string, string | number>) => string }) {
  const on = c.status === 'connected'
  const broken = c.status === 'broken'
  const inProgress = c.status === 'awaiting_login' || c.status === 'verifying' || c.status === 'select_store'
  return (
    <div className={`relative flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-2 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ${on ? 'bg-[color:var(--card-bg,white)]' : broken ? 'bg-amber-50' : 'bg-[color:var(--card-bg,white)] outline-dashed outline-1 outline-ink-300/60'}`}>
      <PlatformIcon platform={c.platform} muted={!on} className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 pr-1">
        <p className="text-xs font-semibold leading-tight">{PLATFORM_LABEL[c.platform]}</p>
        <p className="max-w-[11rem] truncate text-[11px] leading-tight text-ink-500">{c.storeName ?? t(`status.${c.status}` as DictKey)}</p>
      </div>
      {on ? (
        <span className="flex h-6 items-center rounded-full bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700">{t('status.connected')}</span>
      ) : inProgress ? (
        <Link href="/onboarding/connect" className="flex h-6 items-center rounded-full bg-ink-100 px-2 text-[11px] font-semibold text-ink-700">{t(`status.${c.status}` as DictKey)}</Link>
      ) : (
        <Link href="/onboarding/connect" className={`flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold ${broken ? 'bg-amber-500 text-white' : 'bg-ink-900 text-[color:var(--app-bg,white)]'}`}>
          {broken ? t('settings.platforms.reconnect') : t('settings.platforms.connect')}
        </Link>
      )}
    </div>
  )
}

import Link from 'next/link'
import { Logo } from '@/components/marketing/Logo'
import { PlatformIcon } from '@/components/PlatformIcon'
import { PLATFORM_LABEL } from '@/server/restaurants'
import type { Platform } from '@/lib/db/schema'
import { getT } from '@/i18n/server'
import type { T, DictKey } from '@/i18n'

export interface LinkageConn { platform: Platform; status: string; storeName: string | null }

const COLOR: Record<Platform, string> = { uber_eats: '#06c167', doordash: '#ff3008' }

function Wire({ platform, status, flip = false }: { platform: Platform; status: string; flip?: boolean }) {
  const on = status === 'connected'
  const broken = status === 'broken'
  const id = `rib-${platform}`
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={`h-10 w-full ${flip ? '-scale-x-100' : ''}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={on ? COLOR[platform] : broken ? '#f59e0b' : '#c7ccd6'} stopOpacity={on ? 0.55 : 0.5} />
          <stop offset="55%" stopColor={on ? '#3B6CFF' : broken ? '#f59e0b' : '#c7ccd6'} stopOpacity={on ? 0.45 : 0.35} />
          <stop offset="100%" stopColor={on ? '#38C6F4' : broken ? '#f59e0b' : '#c7ccd6'} stopOpacity={on ? 0.55 : 0.5} />
        </linearGradient>
      </defs>
      {/* translucent ribbon, no outline */}
      <path d="M0 12 C 35 12, 65 14, 100 14 L100 26 C 65 26, 35 28, 0 28 Z" fill={`url(#${id})`} />
      {/* soft glass highlight */}
      <path d="M0 14 C 35 14, 65 16, 100 16" fill="none" stroke="white" strokeOpacity={on ? 0.55 : 0.35} strokeWidth="1.2" />
      {on && <path d="M0 20 C 35 20, 65 20, 100 20" fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 18" className="flow-line" />}
      {!on && <path d="M0 20 C 35 20, 65 20, 100 20" fill="none" stroke={broken ? '#f59e0b' : '#a3adbf'} strokeWidth="1.5" strokeDasharray="3 7" />}
    </svg>
  )
}

/** Favie in the middle, Uber Eats on the left and DoorDash on the right, wired according to connection state. */
export async function PlatformLinkage({ conns }: { conns: LinkageConn[] }) {
  const { t } = await getT()
  const ue = conns.find((c) => c.platform === 'uber_eats') ?? { platform: 'uber_eats' as Platform, status: 'not_started', storeName: null }
  const dd = conns.find((c) => c.platform === 'doordash') ?? { platform: 'doordash' as Platform, status: 'not_started', storeName: null }
  const connected = [ue, dd].filter((c) => c.status === 'connected')
  const headline = connected.length === 2 ? t('settings.platforms.both') : connected.length === 1 ? t('settings.platforms.one', { platform: PLATFORM_LABEL[connected[0]!.platform] }) : t('settings.platforms.none')

  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-start gap-2 sm:gap-4 [&>svg]:mt-5 sm:[&>svg]:mt-6">
        <Node c={ue} t={t} />
        <Wire platform="uber_eats" status={ue.status} flip />
        <div className={`relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[color:var(--card-bg,white)] shadow-[0_8px_24px_rgba(0,0,0,0.06)] sm:h-24 sm:w-24 ${connected.length ? '' : 'opacity-70'}`}>
          <Logo className="h-11 w-11 sm:h-12 sm:w-12" />
          {connected.length === 2 && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />}
        </div>
        <Wire platform="doordash" status={dd.status} />
        <Node c={dd} t={t} />
      </div>
      <p className="mt-5 text-center text-sm font-medium text-ink-700">{headline}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[ue, dd].map((c) => <Tile key={c.platform} c={c} t={t} />)}
      </div>
    </div>
  )
}

/** Platform node with a floating label card (gray caption + bold value). */
function Node({ c, t }: { c: LinkageConn; t: T }) {
  const on = c.status === 'connected'
  return (
    <div className="flex flex-col items-center gap-2">
      <PlatformIcon platform={c.platform} muted={!on} className="h-14 w-14 rounded-2xl sm:h-16 sm:w-16" />
      <div className="hidden min-w-[7rem] max-w-[11rem] rounded-2xl bg-[color:var(--card-bg,white)] px-3 py-2 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)] sm:block">
        <p className="text-[11px] text-ink-500">{PLATFORM_LABEL[c.platform]}</p>
        <p className="truncate text-xs font-semibold">{c.storeName ?? t(`status.${c.status}` as DictKey)}</p>
      </div>
    </div>
  )
}

function Tile({ c, t }: { c: LinkageConn; t: T }) {
  const tt = (k: string, v?: Record<string, string | number>) => t(k as DictKey, v)
  const on = c.status === 'connected'
  const broken = c.status === 'broken'
  const inProgress = c.status === 'awaiting_login' || c.status === 'verifying' || c.status === 'select_store'
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${on ? 'bg-ink-100/70' : broken ? 'bg-amber-50' : 'bg-ink-100/40 outline-dashed outline-1 outline-ink-300/60'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <PlatformIcon platform={c.platform} muted={!on} className="h-8 w-8 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{PLATFORM_LABEL[c.platform]}</p>
          <p className="truncate text-xs text-ink-500">{c.storeName ? c.storeName : tt(`status.${c.status}`)}</p>
        </div>
      </div>
      {on ? (
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{tt('status.connected')}</span>
      ) : inProgress ? (
        <Link href="/onboarding/connect" className="shrink-0 rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">{tt(`status.${c.status}`)}</Link>
      ) : (
        <Link href="/onboarding/connect" className={`btn shrink-0 !px-3.5 !py-1.5 text-xs ${broken ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-brand-500 text-white hover:bg-brand-600'}`}>
          {broken ? tt('settings.platforms.reconnect') : tt('settings.platforms.connect')}
        </Link>
      )}
    </div>
  )
}

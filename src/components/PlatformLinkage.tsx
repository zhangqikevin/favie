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
  const color = on ? COLOR[platform] : broken ? '#f59e0b' : '#a3adbf'
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={`h-6 w-full ${flip ? '-scale-x-100' : ''}`} aria-hidden="true">
      <path d="M0 12 C 30 12, 40 12, 100 12" fill="none" stroke={color} strokeWidth={on ? 3 : 2} strokeLinecap="round" strokeDasharray={on ? undefined : '4 6'} opacity={on ? 0.35 : 0.9} />
      {on && <path d="M0 12 C 30 12, 40 12, 100 12" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="8 14" className="flow-line" />}
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
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 sm:gap-4">
        <PlatformIcon platform="uber_eats" muted={ue.status !== 'connected'} className="h-14 w-14 sm:h-16 sm:w-16" />
        <Wire platform="uber_eats" status={ue.status} flip />
        <div className={`relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-card ring-1 ring-ink-100 sm:h-24 sm:w-24 ${connected.length ? '' : 'opacity-70'}`}>
          <Logo className="h-11 w-11 sm:h-12 sm:w-12" />
          {connected.length === 2 && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />}
        </div>
        <Wire platform="doordash" status={dd.status} />
        <PlatformIcon platform="doordash" muted={dd.status !== 'connected'} className="h-14 w-14 sm:h-16 sm:w-16" />
      </div>
      <p className="mt-5 text-center text-sm font-medium text-ink-700">{headline}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[ue, dd].map((c) => <Tile key={c.platform} c={c} t={t} />)}
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
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${on ? 'border-ink-100 bg-white' : broken ? 'border-amber-200 bg-amber-50/50' : 'border-dashed border-ink-300/60 bg-ink-100/40'}`}>
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

import Link from 'next/link'
import { PlatformIcon } from '@/components/PlatformIcon'
import { PLATFORM_CATALOG } from '@/lib/platforms'
import type { Platform } from '@/lib/db/schema'
import { getT } from '@/i18n/server'
import type { DictKey } from '@/i18n'

export interface ConnRow { platform: Platform; status: string; storeName: string | null }

/** Settings: one row per platform with its store and a connect / reconnect action. Unsupported platforms are listed as coming soon. */
export async function PlatformConnections({ conns }: { conns: ConnRow[] }) {
  const { t } = await getT()
  const byId = new Map(conns.map((c) => [c.platform as string, c]))
  return (
    <ul className="mt-4 divide-y divide-ink-100">
      {PLATFORM_CATALOG.map((p) => {
        const c = byId.get(p.id)
        const on = c?.status === 'connected'
        const broken = c?.status === 'broken'
        const inProgress = !!c && ['awaiting_login', 'verifying', 'select_store'].includes(c.status)
        return (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <PlatformIcon platform={p.id} muted={!on} className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="truncate text-xs text-ink-500">
                {!p.supported ? t('settings.platforms.soon') : c?.storeName ?? t(`status.${c?.status ?? 'not_started'}` as DictKey)}
              </p>
            </div>
            {!p.supported ? (
              <span className="pill cursor-default !py-1 text-xs opacity-60">{t('settings.platforms.soon')}</span>
            ) : on ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t('status.connected')}</span>
                <Link href="/onboarding/connect" className="pill !py-1 text-xs">{t('settings.platforms.reconnect')}</Link>
              </div>
            ) : inProgress ? (
              <Link href="/onboarding/connect" className="pill !py-1 text-xs">{t(`status.${c!.status}` as DictKey)}</Link>
            ) : (
              <Link href="/onboarding/connect" className={`pill pill-active !py-1 text-xs ${broken ? '!border-amber-500 !bg-amber-500 !text-white' : ''}`}>
                {broken ? t('settings.platforms.reconnect') : t('settings.platforms.connect')}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

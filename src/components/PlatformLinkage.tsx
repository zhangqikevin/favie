import { Logo } from '@/components/marketing/Logo'
import { PlatformIcon } from '@/components/PlatformIcon'
import { PLATFORM_CATALOG } from '@/lib/platforms'
import type { Platform } from '@/lib/db/schema'
import { getT } from '@/i18n/server'

export interface LinkageConn { platform: Platform; status: string; storeName: string | null }

/**
 * Compact "platform rail": Favie on the left, every platform Favie knows as an icon on one gradient rail.
 * Connected platforms are in color; everything else (not connected, or not yet supported) is grayscale.
 * Managing connections lives in Settings — this strip is status only.
 */
export async function PlatformLinkage({ conns }: { conns: LinkageConn[] }) {
  const { t } = await getT()
  const byId = new Map(conns.map((c) => [c.platform as string, c]))
  const connected = PLATFORM_CATALOG.filter((p) => byId.get(p.id)?.status === 'connected')
  const headline = connected.length === 0
    ? t('settings.platforms.none')
    : t('settings.platforms.count', { n: connected.length, names: connected.map((p) => p.label.split(' ')[0]).join(' · ') })

  return (
    <section className="card px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 sm:w-80 sm:shrink-0">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--card-bg,white)] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <Logo className="h-6 w-6" />
            {connected.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--card-bg,white)] bg-emerald-500" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('settings.platforms')}</p>
            <p className="truncate text-xs text-ink-500" title={headline}>{headline}</p>
          </div>
        </div>

        <div className="relative flex flex-1 items-center gap-5 sm:pl-2">
          <div
            aria-hidden="true"
            className={`absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full ${connected.length ? 'opacity-60' : 'opacity-25'}`}
            style={{ background: 'linear-gradient(90deg, #7C5CFF, #3B6CFF 55%, #38C6F4)' }}
          />
          {PLATFORM_CATALOG.map((p) => {
            const c = byId.get(p.id)
            const on = c?.status === 'connected'
            const broken = c?.status === 'broken'
            const state = !p.supported ? t('settings.platforms.soon') : on ? t('status.connected') : broken ? t('status.broken') : t('status.not_started')
            return (
              <div key={p.id} className="relative" title={`${p.label} · ${state}${c?.storeName ? ` · ${c.storeName}` : ''}`}>
                <PlatformIcon platform={p.id} muted={!on} className="h-11 w-11 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-4 ring-[color:var(--card-bg,white)]" />
                {on && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--card-bg,white)] bg-emerald-500" />}
                {broken && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--card-bg,white)] bg-amber-500" />}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

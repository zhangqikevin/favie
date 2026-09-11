'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useT, useLocale } from '@/i18n/client'
import { INTL_TAG } from '@/i18n/config'
import type { DictKey } from '@/i18n'
import { PlatformIcon } from '@/components/PlatformIcon'
import { pullMenu, pickStorefront, publishDrafts, aiOptimize, updateDraft, uploadPhoto, queueItem, unqueueItem, discardDraft } from '@/app/(app)/dashboard/[restaurantId]/menu/actions'
import type { MenuState } from '@/lib/zoowork/menu'

type Platform = 'uber_eats' | 'doordash'
type Item = MenuState['items'][number]
type Filter = 'all' | 'photoMissing' | 'photoPoor' | 'descMissing' | 'descThin' | 'queued'
const LABEL: Record<Platform, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash' }
const money = (c: number | null) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`)

/** Two platform tabs → diagnosis card → menu grouped by category, with per-item AI optimize / upload / edit / save. */
export function MenuClinic({ restaurantId, connected, initial }: {
  restaurantId: string
  connected: Record<Platform, boolean>
  initial: Record<Platform, MenuState>
}) {
  const t = useT()
  const intl = INTL_TAG[useLocale()]
  const [platform, setPlatform] = useState<Platform>(connected.uber_eats || !connected.doordash ? 'uber_eats' : 'doordash')
  const [state, setState] = useState(initial)
  const [filter, setFilter] = useState<Filter>('all')
  const [pending, start] = useTransition()
  const s = state[platform]
  const busy = s.active.length > 0 || s.items.some((i) => i.status === 'saving')

  // Poll while the agent works.
  useEffect(() => {
    if (!busy) return
    const tick = async () => {
      try {
        const res = await fetch(`/api/restaurants/${restaurantId}/menu?platform=${platform}`, { cache: 'no-store' })
        if (res.ok) { const j = (await res.json()) as MenuState; setState((st) => ({ ...st, [platform]: j })) }
      } catch {}
    }
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [busy, platform, restaurantId])
  const refresh = async () => {
    const res = await fetch(`/api/restaurants/${restaurantId}/menu?platform=${platform}`, { cache: 'no-store' })
    if (res.ok) { const j = (await res.json()) as MenuState; setState((st) => ({ ...st, [platform]: j })) }
  }

  const visible = s.items.filter((i) => {
    if (filter === 'all') return true
    if (filter === 'queued') return i.status === 'queued' || i.status === 'saving'
    if (filter === 'photoMissing') return i.photoMissing && !i.draftImageUrl
    if (filter === 'photoPoor') return i.photoPoor && !i.draftImageUrl
    if (filter === 'descMissing') return i.descMissing && !i.draftDescription
    return i.descThin && !i.draftDescription
  })
  const groups = new Map<string, Item[]>()
  for (const i of visible) { const k = i.category ?? '—'; groups.set(k, [...(groups.get(k) ?? []), i]) }
  const activePull = s.active.find((j) => j.kind === 'pull')

  return (
    <div className="space-y-6">
      {/* platform tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['uber_eats', 'doordash'] as Platform[]).map((p) => (
            <button key={p} type="button" onClick={() => { setPlatform(p); setFilter('all') }} className={`pill !py-2 ${platform === p ? 'pill-active' : ''}`}>
              <PlatformIcon platform={p} muted={!connected[p]} className="h-5 w-5 rounded-md" />{LABEL[p]}
              {state[p].counts.total > 0 && <span className="opacity-70">· {state[p].counts.total}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-500">
          {s.pull?.status === 'done' && s.pull.updatedAt && <span>{t('menu.pulledAt', { when: new Date(s.pull.updatedAt).toLocaleString(intl, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), n: s.counts.total })}</span>}
          {connected[platform] && !activePull && (
            <button type="button" disabled={pending} onClick={() => start(async () => { await pullMenu(restaurantId, platform); await refresh() })} className="pill">
              {s.counts.total ? t('menu.repull') : t('menu.pull', { platform: LABEL[platform] })}
            </button>
          )}
        </div>
      </div>

      {!connected[platform] && <div className="card p-6 text-sm text-ink-500">{t('menu.notConnected', { platform: LABEL[platform] })}</div>}

      {activePull && (
        <div className="card flex items-center gap-4 p-5">
          <Spinner />
          <div>
            <p className="text-sm font-semibold">{t(s.fastRead ? 'menu.pulling.fast' : 'menu.pulling')}</p>
            <p className="mt-0.5 text-xs text-ink-500">{activePull.note}</p>
          </div>
        </div>
      )}
      {/* The web search found several stores with this name: the owner picks, then the read runs. */}
      {!activePull && connected[platform] && s.storefront.candidates && s.storefront.candidates.length > 0 && (
        <section className="card p-6">
          <h2 className="font-display text-base font-semibold">{t('menu.pickStore.title', { platform: LABEL[platform] })}</h2>
          <p className="mt-1 text-xs text-ink-500">{t('menu.pickStore.hint')}</p>
          <ul className="mt-4 divide-y divide-ink-100">
            {s.storefront.candidates.map((c) => (
              <li key={c.url} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.title || c.storeId}</p>
                  <a href={c.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-ink-500 hover:underline">{c.url}</a>
                </div>
                <button type="button" disabled={pending} onClick={() => start(async () => { await pickStorefront(restaurantId, platform, c.url); await refresh() })} className="pill pill-active !py-1.5 text-xs">{t('menu.pickStore.use')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {s.pull?.status === 'failed' && !activePull && !(s.storefront.candidates?.length) && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{t('menu.jobError', { error: s.pull.error ?? '' })}</div>}

      {s.active.some((j) => j.kind === 'apply') && (
        <div className="card flex items-center gap-4 p-5">
          <Spinner />
          <div>
            <p className="text-sm font-semibold">{t('menu.publishing', { platform: LABEL[platform] })}</p>
            <p className="mt-0.5 text-xs text-ink-500">{s.active.find((j) => j.kind === 'apply')?.note}</p>
          </div>
        </div>
      )}
      {s.counts.total > 0 && (
        <section className="card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{t('menu.diag.title')}</h2>
            <div className="flex items-center gap-3">
              {s.counts.queued > 0 && !busy && (
                <button type="button" disabled={pending} onClick={() => start(async () => { await publishDrafts(restaurantId, platform); await refresh() })} className="pill pill-active !py-1.5 text-xs">
                  {t('menu.sync', { n: s.counts.queued, platform: LABEL[platform] })}
                </button>
              )}
              <p className="text-xs text-ink-500">{t('menu.diag.hint')}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ['all', s.counts.total, 'menu.diag.all', ''],
              ['photoMissing', s.counts.photoMissing, 'menu.diag.photoMissing', 'text-[color:var(--accent-orange)]'],
              ['photoPoor', s.counts.photoPoor, 'menu.diag.photoPoor', 'text-amber-600'],
              ['descMissing', s.counts.descMissing, 'menu.diag.descMissing', 'text-[color:var(--accent-orange)]'],
              ['descThin', s.counts.descThin, 'menu.diag.descThin', 'text-amber-600'],
              ['queued', s.counts.queued, 'menu.diag.queued', 'text-[color:var(--accent-blue,#2f66ff)]'],
            ] as [Filter, number, DictKey, string][]).map(([f, n, key, tone]) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-2xl p-4 text-left transition-colors ${filter === f ? 'bg-ink-900 text-[color:var(--app-bg)]' : 'bg-ink-100/70 hover:bg-ink-100'}`}>
                <p className={`font-display text-3xl font-semibold tracking-tight ${filter === f ? '' : n > 0 ? tone : 'text-ink-500'}`}>{n}</p>
                <p className={`mt-1 text-xs ${filter === f ? 'opacity-80' : 'text-ink-500'}`}>{t(key)}</p>
              </button>
            ))}
          </div>
          {!s.imageGeneration && <p className="mt-3 text-xs text-ink-500">{t('menu.imgGenOff')}</p>}
        </section>
      )}

      {s.counts.total === 0 && connected[platform] && !activePull && <div className="card p-8 text-center text-sm text-ink-500">{t('menu.empty')}</div>}

      {[...groups.entries()].map(([cat, items]) => (
        <section key={cat} className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3">
            <h3 className="font-display text-base font-semibold">{cat}</h3>
            <span className="text-xs text-ink-500">{items.length}</span>
          </div>
          <div className="hidden grid-cols-[72px_1.3fr_90px_80px_80px_2fr_auto] gap-4 border-t border-ink-100 px-6 py-2 text-[11px] uppercase tracking-wider text-ink-500 lg:grid">
            <span /><span>{t('menu.col.item')}</span><span>{t('menu.col.availability')}</span><span>{t('menu.col.unit')}</span><span>{t('menu.col.price')}</span><span>{t('menu.col.description')}</span><span />
          </div>
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {items.map((i) => <Row key={i.id} item={i} platform={platform} jobs={s.active.filter((j) => j.menuItemId === i.id)} onChange={refresh} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Row({ item, platform, jobs, onChange }: { item: Item; platform: Platform; jobs: MenuState['active']; onChange: () => Promise<void> }) {
  const t = useT()
  const intl = INTL_TAG[useLocale()]
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(item.draftDescription ?? '')
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setText(item.draftDescription ?? '') }, [item.draftDescription])
  const generating = jobs.some((j) => j.kind === 'generate')
  const saving = item.status === 'saving' || jobs.some((j) => j.kind === 'apply')
  const queued = item.status === 'queued'
  const frozen = queued || saving // no edits while waiting for / during the sync
  const photo = item.draftImageUrl ?? item.imageUrl
  const shown = item.draftDescription ?? item.description
  const flags = [
    item.photoMissing && !item.draftImageUrl && ['menu.diag.photoMissing', 'bg-orange-50 text-orange-700'],
    item.photoPoor && !item.draftImageUrl && ['menu.diag.photoPoor', 'bg-amber-50 text-amber-700'],
    item.descMissing && !item.draftDescription && ['menu.diag.descMissing', 'bg-orange-50 text-orange-700'],
    item.descThin && !item.draftDescription && ['menu.diag.descThin', 'bg-amber-50 text-amber-700'],
  ].filter(Boolean) as [DictKey, string][]

  return (
    <li className="px-6 py-4">
      <div className="grid gap-4 lg:grid-cols-[72px_1.3fr_90px_80px_80px_2fr_auto] lg:items-center">
        <div className="relative h-[72px] w-[72px] overflow-hidden rounded-xl bg-ink-100">
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : !item.photoMissing ? <span title={t('menu.photoOnPlatform')} className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-500"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><path d="m14 8 1.5 1.5L18 7" /></svg><span className="px-1 text-center text-[9px] leading-tight">{t('menu.photoOnPlatform')}</span></span> : <span className="flex h-full w-full items-center justify-center text-ink-300"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" /></svg></span>}
          {item.draftImageUrl && <span className="absolute left-1 top-1 rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">{t('menu.status.draft')}</span>}
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{item.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {flags.map(([k, cls]) => <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{t(k)}</span>)}
            {queued && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{t('menu.status.queued')}</span>}
            {item.status === 'saved' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{t('menu.saved')}</span>}
            {item.status === 'failed' && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700" title={item.lastError ?? ''}>{t('menu.failed')}</span>}
            {item.orderCnt != null && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">{t('menu.sold', { n: item.orderCnt.toLocaleString(intl) })}</span>}
          </div>
        </div>
        <span className="text-xs text-ink-700">{t(`menu.avail.${item.availability ?? 'unknown'}` as DictKey)}</span>
        <span className="text-xs text-ink-700">{item.unit ?? '—'}</span>
        <span className="text-sm font-semibold">{money(item.priceCents)}</span>
        <p className={`line-clamp-3 text-sm ${shown ? 'text-ink-700' : 'italic text-ink-300'}`}>{shown || t('menu.noDesc')}</p>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button type="button" disabled={pending || generating || frozen} onClick={() => start(async () => { await aiOptimize(item.id); await onChange() })} className="pill pill-active !py-1.5 text-xs">
            {generating ? <><Spinner small /> {t('menu.optimizing')}</> : t('menu.optimize')}
          </button>
          <button type="button" onClick={() => setOpen((o) => !o)} className="pill !py-1.5 text-xs">{t('menu.edit')}</button>
        </div>
      </div>
      {generating && jobs[0]?.note && <p className="mt-2 text-xs text-ink-500 lg:pl-[88px]">{t('menu.agentBusy', { note: jobs[0].note })}</p>}
      {(open || item.status === 'draft' || queued || saving || item.status === 'failed') && (
        <div className="mt-4 grid gap-4 rounded-2xl bg-ink-100/60 p-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[['keep', item.imageUrl, 'menu.keepPhoto'], ['ai', item.aiImageUrl, 'menu.useAi'], ['own', item.customImageUrl, 'menu.useOwn']].map(([k, url, label]) => url ? (
                <button key={k} type="button" disabled={frozen} onClick={() => start(async () => { await updateDraft(item.id, { imageUrl: k === 'keep' ? null : (url as string) }); await onChange() })}
                  className={`overflow-hidden rounded-xl ring-2 ${(k === 'keep' ? !item.draftImageUrl : item.draftImageUrl === url) ? 'ring-brand-500' : 'ring-transparent'}`} title={t(label as DictKey)}>
                  <img src={url as string} alt="" className="aspect-square w-full object-cover" />
                  <span className="block bg-white px-1 py-1 text-[10px] text-ink-700">{t(label as DictKey)}</span>
                </button>
              ) : null)}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return
              const fd = new FormData(); fd.set('menuItemId', item.id); fd.set('file', f)
              start(async () => { await uploadPhoto(fd); await onChange() })
              e.target.value = ''
            }} />
            <button type="button" disabled={pending || frozen} onClick={() => fileRef.current?.click()} className="pill w-full !py-1.5 text-xs">{t('menu.upload')}</button>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-ink-700">{t('menu.draftDesc')}</label>
            <textarea value={text} disabled={frozen} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== (item.draftDescription ?? '')) start(async () => { await updateDraft(item.id, { description: text }); await onChange() }) }}
              rows={5} className="input !rounded-2xl text-sm leading-relaxed" placeholder={item.description ?? ''} />
            {item.lastError && item.status === 'failed' && <p className="text-xs text-red-700">{item.lastError}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {saving ? (
                <span className="pill !py-1.5 text-xs"><Spinner small /> {t('menu.saving', { platform: LABEL[platform] })}</span>
              ) : queued ? (
                <>
                  <span className="pill pill-active !py-1.5 text-xs opacity-70">{t('menu.queued')}</span>
                  <button type="button" disabled={pending} onClick={() => start(async () => { await unqueueItem(item.id); await onChange() })} className="pill !py-1.5 text-xs">{t('menu.unqueue')}</button>
                  <span className="text-xs text-ink-500">{t('menu.queuedHint')}</span>
                </>
              ) : (
                <>
                  <button type="button" disabled={pending || (!item.draftDescription && !item.draftImageUrl)} onClick={() => start(async () => { await queueItem(item.id); await onChange() })} className="pill pill-active !py-1.5 text-xs">{t('menu.queue')}</button>
                  {(item.draftDescription || item.draftImageUrl) && (
                    <button type="button" disabled={pending} onClick={() => start(async () => { await discardDraft(item.id); setText(''); await onChange() })} className="text-xs text-ink-500 hover:text-ink-900">{t('menu.discard')}</button>
                  )}
                </>
              )}
              {saving && jobs.find((j) => j.kind === 'apply')?.note && <span className="text-xs text-ink-500">{jobs.find((j) => j.kind === 'apply')!.note}</span>}
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

function Spinner({ small = false }: { small?: boolean }) {
  return <span className={`inline-block ${small ? 'h-3 w-3' : 'h-5 w-5'} animate-spin rounded-full border-2 border-current border-t-transparent opacity-70`} aria-hidden="true" />
}

'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useT, useLocale } from '@/i18n/client'
import { INTL_TAG } from '@/i18n/config'
import type { DictKey } from '@/i18n'
import { PlatformIcon } from '@/components/PlatformIcon'
import { Food, type FoodItem } from '@/components/marketing/Food'
import { pullMenu, pickStorefront, publishAllQueued, aiDescribe, cancelGenerate, aiPhoto, updateDraft, uploadPhoto, queueItem, unqueueItem, discardDraft, requestMenuOptimization, cancelMenuOptimization } from '@/app/(app)/dashboard/[restaurantId]/menu/actions'
import type { MenuState } from '@/lib/zoowork/menu'

type Platform = 'uber_eats' | 'doordash'
type Item = MenuState['items'][number]
type Filter = 'all' | 'photoMissing' | 'photoPoor' | 'descMissing' | 'descThin' | 'queued'
const LABEL: Record<Platform, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash' }

/** Two platform tabs → diagnosis card → menu grouped by category, with per-item AI optimize / upload / edit / save. */
export function MenuClinic({ restaurantId, connected, initial, ops = false, autoPull = false, sidebar = false, aside }: {
  restaurantId: string
  connected: Record<Platform, boolean>
  initial: Record<Platform, MenuState>
  /** Favie's team acting for the owner (admin): the owner's "Favie AI optimize" lock does not apply. */
  ops?: boolean
  /** Onboarding: start reading every connected platform's menu on arrival instead of waiting for a click. */
  autoPull?: boolean
  /** Onboarding: diagnosis + actions in a sticky right-hand panel next to the list (the list can be long). */
  sidebar?: boolean
  /** Rendered at the bottom of the sticky panel (the onboarding "Continue" form). */
  aside?: React.ReactNode
}) {
  const t = useT()
  const intl = INTL_TAG[useLocale()]
  const [platform, setPlatform] = useState<Platform>(connected.uber_eats || !connected.doordash ? 'uber_eats' : 'doordash')
  const [state, setState] = useState(initial)
  const [filter, setFilter] = useState<Filter>('all')
  // The item whose editor drawer is open. A filter like "missing photo" must not drop it the moment a photo
  // arrives — that unmounted the row and closed the drawer mid-edit.
  const [openId, setOpenId] = useState<string | null>(null)
  const onOpenChange = (id: string, open: boolean) => setOpenId((cur) => (open ? id : cur === id ? null : cur))
  const [pending, start] = useTransition()
  const s = state[platform]
  const busy = s.active.length > 0 || s.items.some((i) => i.status === 'saving')
  // "Favie AI optimize": the whole menu is in Favie's hands → owner side is read-only until ops marks it done.
  const optimization = state.uber_eats.optimization ?? state.doordash.optimization
  const locked = !!optimization && !ops

  // Poll while the agent works.
  const load = async (p: Platform) => {
    const res = await fetch(`/api/restaurants/${restaurantId}/menu?platform=${p}`, { cache: 'no-store' })
    if (res.ok) { const j = (await res.json()) as MenuState; setState((st) => ({ ...st, [p]: j })) }
  }
  const anyBusy = busy || (['uber_eats', 'doordash'] as Platform[]).some((p) => state[p].active.length > 0 || state[p].items.some((i) => i.status === 'saving'))
  useEffect(() => {
    if (!anyBusy && !locked) return
    const tick = () => { for (const p of ['uber_eats', 'doordash'] as Platform[]) void load(p).catch(() => {}) }
    const id = setInterval(tick, anyBusy ? 3000 : 30_000) // while locked: notice the unlock when ops finishes
    return () => clearInterval(id)
  }, [anyBusy, locked, restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = async () => { await Promise.all((['uber_eats', 'doordash'] as Platform[]).map((p) => load(p).catch(() => {}))) }
  // Onboarding arrival: kick off the first read for every connected platform that has never been read.
  const autoPulled = useRef(false)
  useEffect(() => {
    if (!autoPull || autoPulled.current) return
    autoPulled.current = true
    const todo = (['uber_eats', 'doordash'] as Platform[]).filter((p) => connected[p] && state[p].counts.total === 0 && !state[p].pull && state[p].active.length === 0)
    if (!todo.length) return
    start(async () => { await Promise.all(todo.map((p) => pullMenu(restaurantId, p).catch(() => {}))); await refresh() })
  }, [autoPull]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = s.items.filter((i) => {
    if (i.id === openId) return true
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
  const PLATFORMS: Platform[] = ['uber_eats', 'doordash']
  // The save queue spans both platforms: one click writes everything, Uber Eats first, then DoorDash.
  const queuedAll = PLATFORMS.flatMap((p) => state[p].items.filter((i) => i.status === 'queued' || i.status === 'saving').map((i) => ({ item: i, platform: p })))
  const savingAll = queuedAll.filter((q) => q.item.status === 'saving')
  // One sync at a time per restaurant (the agent has one browser); the next batch waits for this one.
  const anyApplyActive = PLATFORMS.some((p) => state[p].active.some((j) => j.kind === 'apply')) || savingAll.length > 0
  const estMinutes = (rows: { platform: Platform }[]) => Math.max(1, Math.ceil(rows.reduce((m, q) => m + (q.platform === 'doordash' ? 2 : 1), 0)))
  const STATS: [Filter, number, DictKey, string][] = [
    ['all', s.counts.total, 'menu.diag.all', ''],
    ['photoMissing', s.counts.photoMissing, 'menu.diag.photoMissing', 'text-[color:var(--accent-orange)]'],
    ['photoPoor', s.counts.photoPoor, 'menu.diag.photoPoor', 'text-amber-600'],
    ['descMissing', s.counts.descMissing, 'menu.diag.descMissing', 'text-[color:var(--accent-orange)]'],
    ['descThin', s.counts.descThin, 'menu.diag.descThin', 'text-amber-600'],
    ['queued', queuedAll.length, 'menu.diag.queued', 'text-[color:var(--accent-blue,#2f66ff)]'],
  ]
  const requestOptimize = () => { if (!window.confirm(t('menu.opt.confirm'))) return; start(async () => { await requestMenuOptimization(restaurantId); await refresh() }) }
  /** "Favie AI auto-optimize": a pill in the dashboard header, a full-width block in the onboarding side panel. */
  const optimizeButton = (variant: 'pill' | 'block') => (locked || ops) ? null : variant === 'pill' ? (
    <button type="button" disabled={pending} onClick={requestOptimize}
      className="pill !border-transparent !py-1.5 text-xs font-semibold !text-white disabled:opacity-60"
      style={{ background: 'linear-gradient(90deg, var(--accent-1), var(--accent-2), var(--accent-3))' }}>
      <Sparkle className="h-3.5 w-3.5" /> {t('menu.opt.button')}
    </button>
  ) : (
    <button type="button" disabled={pending} onClick={requestOptimize}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-4 text-left text-white shadow-[0_10px_30px_-12px_rgba(59,108,255,.7)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      style={{ background: 'linear-gradient(120deg, var(--accent-1), var(--accent-2) 55%, var(--accent-3))' }}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20"><Sparkle className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block font-display text-base font-semibold leading-tight">{t('menu.opt.button')}</span>
        <span className="mt-0.5 block text-xs leading-snug text-white/85">{t('menu.opt.hint')}</span>
      </span>
    </button>
  )
  const syncButton = (variant: 'pill' | 'block') => (queuedAll.length > 0 && !anyApplyActive && !locked) ? (
    <button type="button" disabled={pending}
      onClick={() => { if (!window.confirm(t('menu.sync.confirm', { n: queuedAll.length, min: estMinutes(queuedAll) }))) return; start(async () => { await publishAllQueued(restaurantId); await refresh() }) }}
      className={variant === 'pill' ? 'pill !border-transparent !bg-brand-500 !py-1.5 text-xs font-semibold !text-white hover:!bg-brand-600' : 'btn-primary w-full !py-3 text-sm'}>
      {t('menu.sync', { n: queuedAll.length })}
    </button>
  ) : null
  const sidePanel = sidebar && (
    <aside className="space-y-4 lg:sticky lg:top-24">
      {s.counts.total > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-base font-semibold">{t('menu.diag.title')}</h2>
          <ul className="mt-3 space-y-1.5">
            {STATS.filter(([f]) => f !== 'queued' || queuedAll.length > 0).map(([f, n, key, tone]) => (
              <li key={f}>
                <button type="button" onClick={() => setFilter(f)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${filter === f ? 'bg-ink-900 text-[color:var(--app-bg)]' : 'bg-ink-100/70 text-ink-700 hover:bg-ink-100'}`}>
                  <span className={`font-display min-w-[2.2rem] text-xl font-semibold tabular-nums ${filter === f ? '' : n > 0 ? tone : 'text-ink-500'}`}>{n}</span>
                  <span className={filter === f ? 'opacity-80' : ''}>{t(key)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-3">
            {optimizeButton('block')}
            {syncButton('block')}
          </div>
        </section>
      )}
      {aside && <section className="card p-5">{aside}</section>}
    </aside>
  )

  return (
    <div className={sidebar ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]' : ''}>
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
            <button type="button" disabled={pending || locked} onClick={() => start(async () => { await pullMenu(restaurantId, platform); await refresh() })} className="pill disabled:opacity-60">
              {s.counts.total ? t('menu.repull') : t('menu.pull', { platform: LABEL[platform] })}
            </button>
          )}
        </div>
      </div>

      {!connected[platform] && <div className="card p-6 text-sm text-ink-500">{t('menu.notConnected', { platform: LABEL[platform] })}</div>}

      {activePull && <MenuReading platform={platform} />}
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
      {s.pull?.status === 'failed' && !activePull && !(s.storefront.candidates?.length) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="min-w-0 flex-1">{t('menu.jobError', { error: s.pull.error ?? '' })}</p>
          {/* The message stays until the next read; give the way out right here. */}
          <button type="button" disabled={pending || locked} onClick={() => start(async () => { await pullMenu(restaurantId, platform); await refresh() })}
            className="shrink-0 rounded-full bg-amber-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-60">
            {pending ? t('menu.working') : t('menu.retryPull')}
          </button>
        </div>
      )}

      {optimization && ops && (
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{t('menu.opt.opsNote', { when: new Date(optimization.requestedAt).toLocaleString(intl, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}</div>
      )}
      {optimization && !ops && (
        <OptimizingBanner since={optimization.requestedAt} pending={pending} onCancel={() => {
          if (!window.confirm(t('menu.opt.cancelConfirm'))) return
          start(async () => { await cancelMenuOptimization(restaurantId); await refresh() })
        }} />
      )}
      {anyApplyActive && (
        <div className="card flex items-center gap-4 p-5">
          <Spinner />
          <p className="text-sm font-semibold">{t('menu.publishing', { platform: [...new Set(savingAll.map((q) => LABEL[q.platform]))].join(' · ') || LABEL[platform], min: estMinutes(savingAll.length ? savingAll : [{ platform }]) })}</p>
        </div>
      )}
      {s.counts.total > 0 && !sidebar && (
        <section className="card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{t('menu.diag.title')}</h2>
            <div className="flex items-center gap-3">
              {optimizeButton('pill')}
              {syncButton('pill')}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STATS.map(([f, n, key, tone]) => (
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

      {filter === 'queued' && PLATFORMS.map((p) => {
        const rows = queuedAll.filter((q) => q.platform === p).map((q) => q.item)
        if (!rows.length) return null
        return (
          <section key={p} className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold"><PlatformIcon platform={p} className="h-5 w-5 rounded-md" />{LABEL[p]}</h3>
              <span className="text-xs text-ink-500">{rows.length}</span>
            </div>
            <ul className="grid gap-4 border-t border-ink-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((i) => <Row key={i.id} item={i} platform={p} jobs={state[p].active.filter((j) => j.menuItemId === i.id)} onChange={refresh} locked={locked} onOpenChange={onOpenChange} />)}
            </ul>
          </section>
        )
      })}
      {filter !== 'queued' && [...groups.entries()].map(([cat, items]) => (
        <section key={cat} className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3">
            <h3 className="font-display text-base font-semibold">{cat}</h3>
            <span className="text-xs text-ink-500">{items.length}</span>
          </div>
          <ul className="grid gap-4 border-t border-ink-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => <Row key={i.id} item={i} platform={platform} jobs={s.active.filter((j) => j.menuItemId === i.id)} onChange={refresh} locked={locked} onOpenChange={onOpenChange} />)}
          </ul>
        </section>
      ))}
    </div>
    {sidePanel}
    </div>
  )
}

function Row({ item, platform, jobs, onChange, locked, onOpenChange }: { item: Item; platform: Platform; jobs: MenuState['active']; onChange: () => Promise<void>; locked: boolean; onOpenChange?: (id: string, open: boolean) => void }) {
  const t = useT()
  const intl = INTL_TAG[useLocale()]
  const [open, setOpenState] = useState(false)
  const setOpen = (v: boolean) => { setOpenState(v); onOpenChange?.(item.id, v) }
  // The editor starts from the draft when there is one, else from what the platform currently shows.
  const base = item.draftDescription ?? item.description ?? ''
  const [text, setText] = useState(base)
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setText(item.draftDescription ?? item.description ?? '') }, [item.draftDescription, item.description])
  // What the textarea would store as a draft right now (null = same as the platform → no draft).
  const pendingDraft = text.trim() === (item.description ?? '').trim() ? null : text
  const hasChanges = !!pendingDraft || !!item.draftImageUrl
  const commitText = () => {
    if (text === base) return
    start(async () => { await updateDraft(item.id, { description: pendingDraft }); await onChange() })
  }
  // Immediate feedback: the button locks the instant it is clicked (server round trips can take seconds).
  const [acting, setActing] = useState<'queue' | 'unqueue' | 'discard' | null>(null)
  // "Add to save queue" straight after typing: persist the text first, then queue — the blur handler may not have run yet.
  const queueNow = () => {
    if (acting) return
    setActing('queue')
    start(async () => {
      try {
        if (pendingDraft !== (item.draftDescription ?? null)) await updateDraft(item.id, { description: pendingDraft })
        await queueItem(item.id)
        await onChange()
      } finally { setActing(null) }
    })
  }
  // Discard must win over the textarea's blur commit (which would re-save the draft text a moment later),
  // so the button swallows the mousedown (no blur) and the handler never persists the current text.
  const discardNow = () => {
    if (acting) return
    setActing('discard')
    start(async () => { try { await discardDraft(item.id); setText(item.description ?? ''); await onChange() } finally { setActing(null) } })
  }
  const unqueueNow = () => {
    if (acting) return
    setActing('unqueue')
    start(async () => { try { await unqueueItem(item.id); await onChange() } finally { setActing(null) } })
  }
  const genJobs = jobs.filter((j) => j.kind === 'generate')
  const generating = genJobs.length > 0
  const generatingText = genJobs.some((j) => j.scope !== 'image')   // 'text' or legacy both
  const generatingImage = genJobs.some((j) => j.scope !== 'text')   // 'image' or legacy both
  const NOTE_KEYS: Record<string, DictKey> = {
    'Writing the description…': 'menu.progress.describe', 'Studying your existing photos…': 'menu.progress.analyze', 'Generating the photo…': 'menu.progress.photo',
    'Checking the photo against your menu style…': 'menu.progress.check', 'Adjusting and generating again…': 'menu.progress.retry',
  }
  const genNote = jobs.find((j) => j.kind === 'generate')?.note ?? ''
  const progress = generating ? t(NOTE_KEYS[genNote] ?? 'menu.progress.generic') : ''
  const saving = item.status === 'saving' || jobs.some((j) => j.kind === 'apply')
  const queued = item.status === 'queued'
  const frozen = queued || saving || locked // no edits while waiting for / during the sync, or while Favie's team has the menu
  const photo = item.draftImageUrl ?? item.imageUrl
  const shown = item.draftDescription ?? item.description
  const flags = [
    item.photoMissing && !item.draftImageUrl && ['menu.diag.photoMissing', 'bg-orange-50 text-orange-700'],
    item.photoPoor && !item.draftImageUrl && ['menu.diag.photoPoor', 'bg-amber-50 text-amber-700'],
    item.descMissing && !item.draftDescription && ['menu.diag.descMissing', 'bg-orange-50 text-orange-700'],
    item.descThin && !item.draftDescription && ['menu.diag.descThin', 'bg-amber-50 text-amber-700'],
  ].filter(Boolean) as [DictKey, string][]

  // AI buttons live next to the thing they produce: the photo button under the picture, the text button under the textarea.
  const canAi = !locked && !saving && !queued
  // While the AI works the pill shows progress plus a × that gives the item back to the owner right away.
  const working = (label: string, scope: 'text' | 'image') => (
    <span className="pill !cursor-default !py-1.5 !pr-1.5 text-xs text-ink-500">
      <Spinner small /> {label}
      <button type="button" disabled={pending} aria-label={t('menu.cancelGen')} title={t('menu.cancelGen')}
        onClick={() => start(async () => { await cancelGenerate(item.id, scope); await onChange() })}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-50">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" /></svg>
      </button>
    </span>
  )
  const aiPhotoButton = !canAi ? null : generatingImage ? working(t('menu.genPhotoing'), 'image') : (
    <button type="button" disabled={pending} onClick={() => start(async () => { await aiPhoto(item.id); await onChange() })} className="pill !py-1.5 text-xs disabled:opacity-60">
      <Sparkle className="h-3 w-3" /> {t('menu.genPhoto')}
    </button>
  )
  const aiDescribeButton = !canAi ? null : generatingText ? working(t('menu.describing'), 'text') : (
    <button type="button" disabled={pending} onClick={() => start(async () => { await aiDescribe(item.id); await onChange() })} className="pill !py-1.5 text-xs disabled:opacity-60">
      <Sparkle className="h-3 w-3" /> {t('menu.describe')}
    </button>
  )
  const actions = locked ? null : saving ? (
    <span className="pill !py-1.5 text-xs"><Spinner small /> {t('menu.saving', { platform: LABEL[platform] })}</span>
  ) : queued ? (
    <>
      <button type="button" disabled={pending || !!acting} onClick={unqueueNow} className="pill !py-1.5 text-xs disabled:opacity-60">
        {acting === 'unqueue' ? <><Spinner small /> {t('menu.working')}</> : t('menu.unqueue')}
      </button>
      <span className="text-xs text-ink-500">{t('menu.queuedHint')}</span>
    </>
  ) : (
    <>
      <button type="button" disabled={pending || generating || !hasChanges || !!acting} onMouseDown={(e) => e.preventDefault()} onClick={queueNow} className="pill pill-active !py-1.5 text-xs disabled:opacity-60">
        {acting === 'queue' ? <><Spinner small /> {t('menu.working')}</> : t('menu.queue')}
      </button>
      {(item.draftDescription || item.draftImageUrl) && (
        <button type="button" disabled={pending || !!acting} onMouseDown={(e) => e.preventDefault()} onClick={discardNow} className="text-xs text-ink-500 hover:text-ink-900 disabled:opacity-60">
          {acting === 'discard' ? <><Spinner small /> {t('menu.working')}</> : t('menu.discard')}
        </button>
      )}
    </>
  )
  const badges = (
    <div className="mt-1 flex flex-wrap gap-1">
      {flags.map(([k, cls]) => <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{t(k)}</span>)}
      {item.status === 'draft' && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{t('menu.status.draft')}</span>}
      {queued && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{t('menu.status.queued')}</span>}
      {item.status === 'saved' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{t('menu.saved')}</span>}
      {item.status === 'failed' && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700" title={item.lastError ?? ''}>{t('menu.failed')}</span>}
      {item.availability === 'sold_out' && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">{t('menu.avail.sold_out')}</span>}
      {item.orderCnt != null && item.orderCnt > 1 && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">{t('menu.sold', { n: item.orderCnt.toLocaleString(intl) })}</span>}
    </div>
  )
  const placeholder = (big: boolean) => !item.photoMissing
    ? <span title={t('menu.photoOnPlatform')} className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-500"><svg viewBox="0 0 24 24" className={big ? 'h-8 w-8' : 'h-6 w-6'} fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><path d="m14 8 1.5 1.5L18 7" /></svg><span className="px-2 text-center text-[10px] leading-tight">{t('menu.photoOnPlatform')}</span></span>
    : <span className="flex h-full w-full items-center justify-center text-ink-300"><svg viewBox="0 0 24 24" className={big ? 'h-10 w-10' : 'h-8 w-8'} fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" /></svg></span>
  const thumb = (cls: string, big = false) => (
    <div className={`relative overflow-hidden rounded-xl bg-ink-100 ${cls}`}>
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : placeholder(big)}
      {item.draftImageUrl && <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{t('menu.status.draft')}</span>}
    </div>
  )

  return (
    <li className="flex flex-col rounded-2xl border border-ink-100 bg-white p-4">
      {thumb('aspect-[4/3] w-full')}
      <p className="mt-3 font-semibold leading-snug">{item.name}</p>
      {badges}
      <p className={`mt-2 line-clamp-2 flex-1 text-sm ${shown ? 'text-ink-700' : 'italic text-ink-300'}`}>{shown || t('menu.noDesc')}</p>
      {item.lastError && item.status === 'failed' && <p className="mt-1 line-clamp-2 text-xs text-red-700">{item.lastError}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {saving ? <span className="pill !py-1.5 text-xs"><Spinner small /> {t('menu.saving', { platform: LABEL[platform] })}</span> : queued && !locked ? (
          <button type="button" disabled={pending || !!acting} onClick={unqueueNow} className="pill !py-1.5 text-xs disabled:opacity-60">
            {acting === 'unqueue' ? <><Spinner small /> {t('menu.working')}</> : t('menu.unqueue')}
          </button>
        ) : null}
        <button type="button" onClick={() => setOpen(true)} className={`pill !py-1.5 text-xs ${frozen ? '' : 'pill-active'}`}>
          {generating ? <><Spinner small /> {t(generatingText && generatingImage ? 'menu.optimizing' : generatingText ? 'menu.describing' : 'menu.genPhotoing')}</> : frozen ? t('menu.view') : t('menu.edit')}
        </button>
      </div>
      {generating && <p className="mt-2 text-right text-[11px] text-ink-500">{progress}</p>}

      {/* Editor: a right-side drawer, so the grid stays put. */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={item.name}>
          <button type="button" aria-label={t('menu.close')} onClick={() => setOpen(false)} className="absolute inset-0 bg-ink-900/30" />
          <div className="relative flex h-full w-full max-w-[560px] flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start gap-4 border-b border-ink-100 px-6 py-5">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold leading-snug">{item.name}</p>
                <p className="text-xs text-ink-500">{item.category ?? ''}{item.category ? ' · ' : ''}{LABEL[platform]}</p>
                {badges}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="pill !py-1.5 text-xs">{t('menu.close')}</button>
            </div>
            <div className="flex-1 space-y-6 px-6 py-5">
              <section>
                <p className="text-xs font-medium text-ink-700">{t('menu.photo')}</p>
                <div className="mt-2">{thumb('aspect-[4/3] w-full', true)}</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[['keep', item.imageUrl, 'menu.keepPhoto'], ['ai', item.aiImageUrl, 'menu.useAi'], ['own', item.customImageUrl, 'menu.useOwn']].map(([k, url, label]) => url ? (
                    <button key={k} type="button" disabled={frozen} onClick={() => start(async () => { await updateDraft(item.id, { imageUrl: k === 'keep' ? null : (url as string) }); await onChange() })}
                      className={`overflow-hidden rounded-xl ring-2 disabled:opacity-60 ${(k === 'keep' ? !item.draftImageUrl : item.draftImageUrl === url) ? 'ring-brand-500' : 'ring-transparent'}`} title={t(label as DictKey)}>
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" disabled={pending || frozen} onClick={() => fileRef.current?.click()} className="pill !py-1.5 text-xs disabled:opacity-60">{t('menu.upload')}</button>
                  {aiPhotoButton}
                </div>
                {generatingImage && <p className="mt-2 text-xs text-ink-500">{progress}</p>}
              </section>
              <section>
                <label className="text-xs font-medium text-ink-700">{t('menu.draftDesc')}</label>
                <textarea value={text} disabled={frozen} onChange={(e) => setText(e.target.value)} onBlur={commitText}
                  rows={7} className="input mt-2 !rounded-2xl text-sm leading-relaxed disabled:opacity-60" placeholder={t('menu.noDesc')} />
                {item.lastError && item.status === 'failed' && <p className="mt-2 text-xs text-red-700">{item.lastError}</p>}
                {aiDescribeButton && <div className="mt-2">{aiDescribeButton}</div>}
                {generatingText && !generatingImage && <p className="mt-2 text-xs text-ink-500">{progress}</p>}
              </section>
            </div>
            {actions && (
              <div className="border-t border-ink-100 px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/** "Reading your menu": dishes from the landing-page sprite pop in one after another while the pull runs. */
const READING_DISHES: FoodItem[] = ['ramen', 'dumplings', 'sushi', 'fried_rice', 'boba', 'tempura']
function MenuReading({ platform }: { platform: Platform }) {
  const t = useT()
  return (
    <section className="card px-8 pb-10 pt-11 text-center" aria-live="polite">
      <div className="relative mx-auto h-[150px] w-[220px]">
        {READING_DISHES.map((f, i) => (
          <Food key={f} item={f} size={150} className="menu-cyc absolute bottom-2.5 left-1/2" style={{ animationDelay: `${i * 1.3}s` }} />
        ))}
        <span aria-hidden="true" className="menu-cyc-shadow absolute bottom-0 left-1/2 h-3.5 w-36 rounded-full" />
      </div>
      <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />{t('menu.reading.kicker')}
      </p>
      <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">{t('menu.reading.title', { platform: LABEL[platform] })}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-500">{t('menu.reading.body')}</p>
      <div className="ai-bar mx-auto mt-6 h-1 w-56 overflow-hidden rounded-full bg-ink-100" />
    </section>
  )
}

function Sparkle({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M12 2l1.8 5.7L19.5 9.5l-5.7 1.8L12 17l-1.8-5.7L4.5 9.5l5.7-1.8L12 2z" /><path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" opacity=".7" /></svg>
}

/** "Favie AI is optimizing your menu": a light card — dishes from the landing-page sprite roll past on a conveyor; the only control the owner keeps is cancel. */
const CONVEYOR: FoodItem[] = ['ramen', 'dumplings', 'sushi', 'fried_rice', 'boba', 'pad_thai', 'tempura', 'curry', 'poke', 'wings']
function OptimizingBanner({ since, pending, onCancel }: { since: string | Date; pending: boolean; onCancel: () => void }) {
  const t = useT()
  const intl = INTL_TAG[useLocale()]
  const steps = t('menu.opt.steps').split(' · ')
  const [step, setStep] = useState(0)
  useEffect(() => { const id = setInterval(() => setStep((i) => (i + 1) % steps.length), 2400); return () => clearInterval(id) }, [steps.length])
  const stage = '#F5F7FA' // the sprite's white cells multiply to this color and disappear
  const row = (key: string) => <div key={key} className="flex items-center gap-4 pr-4" aria-hidden="true">{CONVEYOR.map((f) => <Food key={f} item={f} size={56} />)}</div>
  return (
    <section className="card p-6 sm:p-8" aria-live="polite">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative h-28 w-64 shrink-0 self-center overflow-hidden rounded-3xl" style={{ background: stage }}>
          <div className="ai-track absolute inset-y-0 left-0 flex w-max items-center" style={{ background: stage }}>{row('a')}{row('b')}</div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10" style={{ background: `linear-gradient(90deg, ${stage}, transparent)` }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10" style={{ background: `linear-gradient(270deg, ${stage}, transparent)` }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold leading-tight sm:text-2xl">{t('menu.opt.title')}</p>
          <p className="mt-2 text-sm text-ink-500">{t('menu.opt.body')}</p>
          {/* steps + progress span the same width as the text above */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            {steps.map((label, i) => (
              <span key={label} className={`flex items-center gap-1.5 transition-opacity duration-500 ${i === step ? 'font-medium text-ink-900' : 'opacity-50'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${i === step ? 'animate-pulse bg-brand-500' : 'bg-ink-300'}`} />{label}
              </span>
            ))}
          </div>
          <div className="ai-bar mt-4 h-1 w-full overflow-hidden rounded-full bg-ink-100" />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button type="button" disabled={pending} onClick={onCancel} className="pill !py-2 text-xs disabled:opacity-60">{t('menu.opt.cancel')}</button>
          <span className="text-[11px] text-ink-400">{t('menu.opt.since', { when: new Date(since).toLocaleString(intl, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}</span>
        </div>
      </div>
    </section>
  )
}

function Spinner({ small = false }: { small?: boolean }) {
  return <span className={`inline-block ${small ? 'h-3 w-3' : 'h-5 w-5'} animate-spin rounded-full border-2 border-current border-t-transparent opacity-70`} aria-hidden="true" />
}

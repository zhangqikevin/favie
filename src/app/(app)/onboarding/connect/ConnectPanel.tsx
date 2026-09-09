'use client'
import { useEffect, useState, useTransition } from 'react'
import { startConnect, confirmLoggedIn, continueToPreferences, selectStore } from '../actions'
import type { ConnectionStatus } from '@/lib/db/schema'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'

export type StoreCandidate = { name: string; external_id: string | null; address: string | null }
export type ConnRow = {
  platform: 'uber_eats' | 'doordash'; status: ConnectionStatus; storeName: string | null; storeAddress: string | null; lastError: string | null
  handoffUrl: string | null; handoffStartedAt: string | null; storeCandidates: StoreCandidate[] | null; progressNote?: string | null
}
const META = {
  doordash: { label: 'DoorDash', portal: 'ob.connect.portal.doordash', dot: 'bg-doordash' },
  uber_eats: { label: 'Uber Eats', portal: 'ob.connect.portal.uber_eats', dot: 'bg-uber' },
} as const

export function ConnectPanel({ restaurantId, initial, agentStatus, onboardingDone }: { restaurantId: string; initial: ConnRow[]; agentStatus: string; onboardingDone: boolean }) {
  const t = useT()
  const [rows, setRows] = useState(initial)
  const [agent, setAgent] = useState(agentStatus)
  const [pending, start] = useTransition()
  const [embedded, setEmbedded] = useState<Record<string, boolean>>({})
  const [picked, setPicked] = useState<Record<string, string>>({})
  const inProgress = rows.find((r) => r.status === 'awaiting_login' || r.status === 'verifying' || r.status === 'select_store')
  const busy = !!inProgress || agent !== 'ready'

  useEffect(() => {
    if (!busy) return
    const tick = async () => {
      try {
        const res = await fetch(`/api/restaurants/${restaurantId}/connections`, { cache: 'no-store' })
        if (res.ok) { const j = await res.json(); setRows(j.connections); setAgent(j.agentStatus) }
      } catch {}
    }
    const id = setInterval(tick, 2000)
    return () => clearInterval(id)
  }, [restaurantId, busy])

  const anyConnected = rows.some((r) => r.status === 'connected')
  const setStatus = (platform: ConnRow['platform'], status: ConnectionStatus) =>
    setRows((rs) => rs.map((r) => (r.platform === platform ? { ...r, status, handoffUrl: status === 'awaiting_login' ? null : r.handoffUrl } : r)))
  const connect = (platform: ConnRow['platform']) => start(async () => { setStatus(platform, 'awaiting_login'); await startConnect(platform) })
  const confirm = (platform: ConnRow['platform']) => start(async () => { setStatus(platform, 'verifying'); await confirmLoggedIn(platform) })
  const choose = (c: ConnRow) => {
    const key = picked[c.platform]; const cand = (c.storeCandidates ?? []).find((s) => (s.external_id ?? s.name) === key)
    if (!cand) return
    start(async () => {
      setRows((rs) => rs.map((r) => (r.platform === c.platform ? { ...r, status: 'connected', storeName: cand.name, storeAddress: cand.address } : r)))
      await selectStore(c.platform, cand.external_id, cand.name)
    })
  }

  return (
    <div className="space-y-6">
      {agent !== 'ready' && (
        <div className={`rounded-2xl border p-4 text-sm ${agent === 'failed' ? 'border-red-200 bg-red-50 text-red-800' : 'border-brand-100 bg-brand-50 text-brand-800'}`}>
          {agent === 'failed' ? t('ob.connect.agent.failed') : t('ob.connect.agent.settingUp')}
        </div>
      )}
      {rows.map((c) => {
        const m = META[c.platform]
        const portal = t(m.portal as DictKey)
        return (
          <section key={c.platform} className={`card p-7 ${c.status === 'connected' ? 'border-emerald-200' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${m.dot}`} />
                <div>
                  <h2 className="font-display text-xl font-bold">{m.label}</h2>
                  {c.storeName && <p className="text-sm text-ink-500">{c.storeName}{c.storeAddress ? ` · ${c.storeAddress}` : ''}</p>}
                </div>
              </div>
              <StatusPill status={c.status} />
            </div>

            {c.status === 'not_started' && (
              <div className="mt-5">
                <ol className="space-y-2 text-sm text-ink-700">
                  <li className="flex gap-3"><Num n={1} />{t('ob.connect.step1', { portal })}</li>
                  <li className="flex gap-3"><Num n={2} />{t('ob.connect.step2', { platform: m.label })}</li>
                  <li className="flex gap-3"><Num n={3} />{t('ob.connect.step3.pre')}<b>{t('ob.connect.loggedIn')}</b>{t('ob.connect.step3.post')}</li>
                </ol>
                <button type="button" disabled={pending || agent !== 'ready' || !!inProgress} onClick={() => connect(c.platform)} className="btn-primary mt-5 !px-5 !py-2.5 text-sm">
                  {t('ob.connect.connect', { platform: m.label })}
                </button>
                {inProgress && <p className="mt-2 text-xs text-ink-500">{t('ob.connect.oneAtATime', { platform: META[inProgress.platform].label })}</p>}
              </div>
            )}

            {c.status === 'awaiting_login' && (
              <div className="mt-5">
                {c.handoffUrl ? (
                  <>
                    <p className="text-sm text-ink-700">{t('ob.connect.ready.pre', { portal })}<b>{t('ob.connect.loggedIn')}</b>.</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button type="button" onClick={() => window.open(c.handoffUrl!, `favie-${c.platform}`, 'noopener,noreferrer,width=1280,height=860')} className="btn-primary !px-5 !py-2.5 text-sm">
                        {t('ob.connect.open')}
                      </button>
                      <button type="button" disabled={pending} onClick={() => confirm(c.platform)} className="btn-secondary !px-5 !py-2.5 text-sm">{t('ob.connect.loggedIn')}</button>
                      <button type="button" onClick={() => setEmbedded((h) => ({ ...h, [c.platform]: !h[c.platform] }))} className="text-xs font-medium text-ink-500 hover:text-ink-900">
                        {embedded[c.platform] ? t('ob.connect.embed.hide') : t('ob.connect.embed.show')}
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-ink-500">
                      {t('ob.connect.popup')}
                      <span className="ml-1 select-all break-all font-mono text-[11px] text-ink-700">{c.handoffUrl}</span>
                    </p>
                    {embedded[c.platform] && (
                      <div className="mt-4 overflow-hidden rounded-xl border border-ink-100 bg-ink-900">
                        <iframe src={c.handoffUrl} title={portal} className="h-[560px] w-full" allow="clipboard-read; clipboard-write" />
                      </div>
                    )}
                    <p className="mt-2 text-xs text-ink-500">{t('ob.connect.expires')}</p>
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-ink-500"><Spinner /> {c.progressNote ?? t('ob.connect.opening')} <span className="text-xs text-ink-400">{t('ob.connect.opening.hint')}</span></p>
                )}
              </div>
            )}

            {c.status === 'verifying' && (
              <p className="mt-5 flex items-center gap-2 text-sm text-ink-500"><Spinner /> {c.progressNote ?? t('ob.connect.verifying')} <span className="text-xs text-ink-400">{t('ob.connect.verifying.hint')}</span></p>
            )}

            {c.status === 'select_store' && (
              <div className="mt-5">
                <p className="text-sm text-ink-700">{t('ob.connect.pick', { n: c.storeCandidates?.length ?? 0 })}</p>
                <div className="mt-3 grid gap-2">
                  {(c.storeCandidates ?? []).map((s) => {
                    const key = s.external_id ?? s.name
                    return (
                      <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-100 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                        <input type="radio" name={`store-${c.platform}`} checked={picked[c.platform] === key} onChange={() => setPicked((p) => ({ ...p, [c.platform]: key }))} className="mt-1 accent-brand-500" />
                        <span>
                          <span className="block font-semibold">{s.name}</span>
                          <span className="block text-xs text-ink-500">{[s.address, s.external_id ? `ID ${s.external_id}` : null].filter(Boolean).join(' · ')}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <button type="button" disabled={pending || !picked[c.platform]} onClick={() => choose(c)} className="btn-primary mt-4 !px-5 !py-2.5 text-sm">{t('ob.connect.useStore')}</button>
              </div>
            )}

            {c.status === 'connected' && (
              <p className="mt-4 text-sm text-emerald-700">{t('ob.connect.connected', { platform: m.label })}</p>
            )}

            {c.status === 'broken' && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">{t('ob.connect.broken')}</p>
                {c.lastError && <p className="mt-1">{c.lastError}</p>}
                <button type="button" disabled={pending || agent !== 'ready' || (!!inProgress && inProgress.platform !== c.platform)} onClick={() => connect(c.platform)} className="btn-secondary mt-3 !px-4 !py-2 text-sm">{t('ob.connect.tryAgain')}</button>
              </div>
            )}
          </section>
        )
      })}

      <form action={continueToPreferences} className="pt-2">
        <button type="submit" className={anyConnected ? 'btn-primary !px-8 !py-3.5' : 'btn-secondary !px-8 !py-3.5'}>
          {onboardingDone ? t('ob.connect.backToDashboard') : anyConnected ? t('common.continue') : t('ob.connect.skip')}
        </button>
        {!anyConnected && !onboardingDone && <p className="mt-2 text-sm text-ink-500">{t('ob.connect.skipHint')}</p>}
      </form>
    </div>
  )
}

function Num({ n }: { n: number }) {
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">{n}</span>
}
function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-brand-500" />
}
export function StatusPill({ status }: { status: ConnectionStatus }) {
  const t = useT()
  const cls: Record<ConnectionStatus, string> = {
    not_started: 'bg-ink-100 text-ink-700', awaiting_login: 'bg-amber-50 text-amber-700', verifying: 'bg-amber-50 text-amber-700',
    select_store: 'bg-brand-50 text-brand-700', connected: 'bg-emerald-50 text-emerald-700', broken: 'bg-red-50 text-red-700',
  }
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${cls[status]}`}>{t(`status.${status}` as DictKey)}</span>
}

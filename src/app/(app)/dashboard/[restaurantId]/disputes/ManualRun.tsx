'use client'
import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'
import { runDisputesManual, type ManualState } from './actions'

/** Two test buttons: a read-only look at the charged issues, and a real processing run. Refreshes while a run is going. */
export function ManualRun({ restaurantId, running, platforms }: { restaurantId: string; running: boolean; platforms: { id: 'uber_eats' | 'doordash'; label: string }[] }) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState<ManualState, FormData>(runDisputesManual, undefined)
  const [platform, setPlatform] = useState(platforms[0]?.id ?? 'uber_eats')
  const [orderId, setOrderId] = useState('')
  const has = (id: string) => platforms.some((p) => p.id === id)
  // The choice survives the page's own refreshes and reloads (it used to fall back to the first platform).
  useEffect(() => { try { const saved = localStorage.getItem('favie.disputes.platform'); if (saved && has(saved)) setPlatform(saved as typeof platform) } catch {} }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (id: typeof platform) => { setPlatform(id); try { localStorage.setItem('favie.disputes.platform', id) } catch {} }
  // Order ids look different per platform: DoorDash 8 hex characters (8A5664B5), Uber Eats 5 (51D86). Follow them.
  const onOrderId = (v: string) => {
    setOrderId(v)
    const id = v.trim().replace(/^#/, '')
    if (/^[0-9a-f]{8}$/i.test(id) && has('doordash')) choose('doordash')
    else if (/^[0-9a-f]{5}$/i.test(id) && has('uber_eats')) choose('uber_eats')
  }
  useEffect(() => {
    if (!running && !state?.ok) return
    const id = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(id)
  }, [running, state?.ok, router])
  const busy = pending || running
  return (
    <div className="flex flex-wrap items-center gap-3">
      {platforms.length > 1 && (
        <div role="radiogroup" className="flex rounded-full bg-ink-100 p-0.5 text-xs font-semibold">
          {platforms.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={platform === p.id} disabled={busy} onClick={() => choose(p.id)}
              className={`rounded-full px-3 py-1.5 transition-colors ${platform === p.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>{p.label}</button>
          ))}
        </div>
      )}
      <form action={action}>
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="mode" value="check" />
        <button type="submit" disabled={busy} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50 disabled:opacity-50" title={t('disp.manual.checkHint')}>{t('disp.manual.check')}</button>
      </form>
      <form action={action}>
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="mode" value="process" />
        <button type="submit" disabled={busy} className="btn-primary !py-2 text-sm" title={t('disp.manual.processHint')}>{t('disp.manual.process')}</button>
      </form>
      <input id="disputes-order-id" value={orderId} onChange={(e) => onOrderId(e.target.value)} disabled={busy} placeholder={t('disp.manual.orderPh')} title={t('disp.manual.orderHint')} aria-label={t('disp.manual.orderHint')}
        spellCheck={false} autoCapitalize="characters" className="input !w-44 !py-2 font-mono text-xs uppercase placeholder:normal-case placeholder:font-sans" />
      <form action={action}>
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="mode" value="fast" />
        <button type="submit" disabled={busy || !orderId.trim()} className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" title={t('disp.manual.fastHint')}>{t('disp.manual.fast')}</button>
      </form>
      {running ? <span className="text-sm text-ink-500">{t('disp.manual.running')}</span>
        : state?.ok ? <span className="text-sm text-emerald-700">{t('disp.manual.queued')}</span>
        : state?.error ? <span className="text-sm text-red-700">{t(`disp.manual.err.${state.error}` as DictKey)}</span> : null}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useActionState } from 'react'
import { saveZoodataKey, type ZoodataKeyState } from '../actions'
import { useT, useLocale } from '@/i18n/client'
import { INTL_TAG } from '@/i18n/config'

export interface SparkDay { date: string; orders: number | null }

/**
 * Order-data status. With a saved key: a live badge, a 14-day order sparkline and a de-emphasised
 * "replace key" link. Without one: the key form. The provider is never named to the owner.
 */
export function OrderDataCard({ restaurantId, timezone, hasKey, days, updatedAt, source }: { restaurantId: string; timezone: string; hasKey: boolean; days: SparkDay[]; updatedAt: string | null; source: 'zoodata' | 'mock' | null }) {
  const t = useT()
  const intl = INTL_TAG[useLocale()]
  const [editing, setEditing] = useState(!hasKey)
  const total = days.reduce((a, d) => a + (d.orders ?? 0), 0)
  const max = Math.max(1, ...days.map((d) => d.orders ?? 0))

  return (
    <div className="mt-4">
      {hasKey && (
        <>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              {t('settings.data.connected')}
            </span>
            {updatedAt && <span className="text-xs text-ink-500">{t('settings.data.updated', { when: new Date(updatedAt).toLocaleString(intl, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone }) })}</span>}
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{t('settings.data.last14')}</p>
              <p className="font-display mt-0.5 text-3xl font-bold">{total.toLocaleString(intl)}</p>
            </div>
            <div className="flex h-14 flex-1 items-end gap-1" aria-hidden="true">
              {days.map((d) => (
                <div key={d.date} title={`${d.date}: ${d.orders ?? '—'}`} className={`flex-1 rounded-t ${d.orders == null ? 'bg-ink-100' : 'bg-brand-500/80'}`} style={{ height: `${d.orders == null ? 6 : Math.max(6, Math.round(((d.orders ?? 0) / max) * 100))}%` }} />
              ))}
            </div>
          </div>
          {source === 'mock' && <p className="mt-3 text-xs text-ink-500">{t('settings.data.sample')}</p>}
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="mt-5 text-xs text-ink-300 underline-offset-2 hover:text-ink-500 hover:underline">{t('settings.data.replace')}</button>
          )}
        </>
      )}
      {!hasKey && <p className="text-sm text-ink-500">{t('settings.data.body.none')}</p>}
      {editing && <KeyForm restaurantId={restaurantId} hasKey={hasKey} onCancel={hasKey ? () => setEditing(false) : undefined} />}
    </div>
  )
}

function KeyForm({ restaurantId, hasKey, onCancel }: { restaurantId: string; hasKey: boolean; onCancel?: () => void }) {
  const t = useT()
  const [state, action, pending] = useActionState<ZoodataKeyState, FormData>(saveZoodataKey, undefined)
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <div>
        <label className="label" htmlFor="zoodataKey">{t('settings.data.label')}</label>
        <input id="zoodataKey" name="key" type="password" autoComplete="off" className="input font-mono" placeholder="••••••••••••••••" />
        <p className="mt-1.5 text-xs text-ink-500">{t('settings.data.hint')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${hasKey ? 'btn-secondary' : 'btn-primary'} !py-2.5 text-sm`}>{pending ? t('settings.data.checking') : t('settings.data.save')}</button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm text-ink-500 hover:text-ink-900">{t('settings.data.cancel')}</button>}
        {state?.ok && <span className="text-sm text-emerald-700">{t('settings.data.ok', { store: state.storeName ?? '' })}</span>}
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  )
}

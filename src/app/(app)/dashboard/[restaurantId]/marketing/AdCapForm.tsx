'use client'
import { useActionState } from 'react'
import { updateAdCap, type AdCapState } from '../actions'
import { useT } from '@/i18n/client'

export function AdCapForm({ restaurantId, platform, currentCents }: { restaurantId: string; platform: 'uber_eats' | 'doordash'; currentCents: number | null }) {
  const t = useT()
  const [state, action, pending] = useActionState<AdCapState, FormData>(updateAdCap, undefined)
  return (
    <form action={action} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <input type="hidden" name="platform" value={platform} />
      <div className="flex-1">
        <label className="label" htmlFor={`cap-${platform}`}>{t('caps.label')}</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-500">$</span>
          <input id={`cap-${platform}`} name="cap" inputMode="decimal" defaultValue={currentCents == null ? '' : String(currentCents / 100)} className="input !pl-8" placeholder={t('caps.placeholder')} />
        </div>
      </div>
      <button type="submit" disabled={pending} className="btn-primary !py-3">{pending ? t('common.saving') : t('common.save')}</button>
      {state?.ok && <span className="text-sm text-emerald-700">{t('caps.saved')}</span>}
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  )
}

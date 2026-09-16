'use client'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'
import { runDisputesManual, type ManualState } from './actions'

/** Two test buttons: a read-only look at the charged issues, and a real processing run. Refreshes while a run is going. */
export function ManualRun({ restaurantId, running }: { restaurantId: string; running: boolean }) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState<ManualState, FormData>(runDisputesManual, undefined)
  useEffect(() => {
    if (!running && !state?.ok) return
    const id = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(id)
  }, [running, state?.ok, router])
  const busy = pending || running
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={action}>
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <input type="hidden" name="mode" value="check" />
        <button type="submit" disabled={busy} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50 disabled:opacity-50" title={t('disp.manual.checkHint')}>{t('disp.manual.check')}</button>
      </form>
      <form action={action}>
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <input type="hidden" name="mode" value="process" />
        <button type="submit" disabled={busy} className="btn-primary !py-2 text-sm" title={t('disp.manual.processHint')}>{t('disp.manual.process')}</button>
      </form>
      {running ? <span className="text-sm text-ink-500">{t('disp.manual.running')}</span>
        : state?.ok ? <span className="text-sm text-emerald-700">{t('disp.manual.queued')}</span>
        : state?.error ? <span className="text-sm text-red-700">{t(`disp.manual.err.${state.error}` as DictKey)}</span> : null}
    </div>
  )
}

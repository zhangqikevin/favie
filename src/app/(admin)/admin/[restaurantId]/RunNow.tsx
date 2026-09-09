'use client'
import { useActionState } from 'react'
import { runNow, type AdminState } from '../actions'

export function RunNow({ restaurantId }: { restaurantId: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(runNow, undefined)
  return (
    <form action={action} className="card flex flex-wrap items-center gap-3 p-5">
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <button type="submit" disabled={pending} className="btn-primary !py-2.5 text-sm">{pending ? 'Queuing…' : 'Run the daily routine now'}</button>
      <span className="text-sm text-ink-500">Runs the current operating prompt on this restaurant's agent immediately (recorded as a manual run below). Use it to test a newly published prompt on one customer.</span>
      {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  )
}

'use client'
import { useActionState } from 'react'
import { saveMenuImageModel, type AdminState } from '../actions'

/** Which image model the agent's image_generate tool uses for dish photos. */
export function ImageModelForm({ current, isDefault, choices }: { current: string; isDefault: boolean; choices: string[] }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveMenuImageModel, undefined)
  return (
    <form action={action} className="card p-6">
      <h2 className="font-display text-base font-bold">Dish photo — image model</h2>
      <p className="mt-1 max-w-2xl text-xs text-ink-500">
        Passed to the agent's image_generate tool as "provider/model". Verified on 2026-09-11: openai/gpt-image-1.5 and openai/gpt-image-2 work (≈6 s each); "gemini" is blocked for the ZooWork team and "grok" has no credits.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input name="model" list="image-models" defaultValue={current} className="input !w-auto min-w-[280px] font-mono text-sm" />
        <datalist id="image-models">{choices.map((c) => <option key={c} value={c} />)}</datalist>
        <button type="submit" disabled={pending} className="btn-primary !py-2 text-sm">{pending ? 'Saving…' : 'Save'}</button>
        <span className="text-xs text-ink-500">{isDefault ? 'built-in default' : 'custom'}</span>
      </div>
      {state?.ok && <p className="mt-3 text-sm text-emerald-700">{state.ok}</p>}
      {state?.error && <p className="mt-3 text-sm text-red-700">{state.error}</p>}
    </form>
  )
}

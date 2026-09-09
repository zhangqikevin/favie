'use client'
import { useActionState, useState } from 'react'
import { publishPrompt, type AdminState } from './actions'

export function PromptEditor({ initial, activeVersion, activeAt }: { initial: string; activeVersion: number | null; activeAt: string | null }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(publishPrompt, undefined)
  const [dirty, setDirty] = useState(false)
  return (
    <form action={action} className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink-700">
          {activeVersion ? <>Active: <b>v{activeVersion}</b>{activeAt ? <span className="text-ink-500"> · published {new Date(activeAt).toLocaleString('en-US')}</span> : null}</> : <>No version published yet — this is the built-in default routine.</>}
        </p>
        <span className="text-xs text-ink-500">Markdown. Must start with a <code>##</code> heading. The agent reads this as the "Mode daily" section of its skill.</span>
      </div>
      <textarea
        name="prompt"
        defaultValue={initial}
        onChange={() => setDirty(true)}
        rows={28}
        spellCheck={false}
        className="input mt-4 min-h-[520px] font-mono text-[13px] leading-relaxed"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input name="note" placeholder="What changed? (shown in version history)" className="input !w-auto min-w-[280px] flex-1 !py-2 text-sm" />
        <button type="submit" disabled={pending} className="btn-primary !py-2.5 text-sm">{pending ? 'Publishing…' : 'Publish to all agents'}</button>
        {dirty && !pending && !state?.ok && <span className="text-xs text-amber-700">unsaved changes</span>}
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  )
}

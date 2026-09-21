'use client'
import { useActionState, useEffect, useState } from 'react'
import { saveDisputePrompt, resetDisputePrompt, type AdminState } from '../actions'

/** One editable prompt: read-only until the edit switch is on; Save stores it, Reset returns to the built-in default. */
export function DisputePromptEditor({ which, title, help, value, defaultValue, updatedAt, preview, footnote }: {
  which: 'rules' | 'uber_eats' | 'doordash'
  title: string
  help: string
  value: string | null
  defaultValue: string
  updatedAt: string | null
  preview?: string
  footnote?: string
}) {
  const initial = value ?? defaultValue
  const [state, action, pending] = useActionState<AdminState, FormData>(saveDisputePrompt, undefined)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial)
  const dirty = draft !== initial
  useEffect(() => { if (state?.ok) setEditing(false) }, [state?.ok])
  useEffect(() => { if (!editing) setDraft(initial) }, [initial, editing])
  const cancel = () => { if (dirty && !window.confirm('Discard your unsaved changes?')) return; setDraft(initial); setEditing(false) }

  return (
    <form action={action} className={`card p-6 ${editing ? 'ring-2 ring-amber-300' : ''}`}>
      <input type="hidden" name="which" value={which} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">{title}</h2>
          <p className="mt-1 max-w-2xl text-xs text-ink-500">{help}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${value ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-700'}`}>{value ? `custom · saved ${updatedAt ? new Date(updatedAt).toLocaleString('en-US') : ''}` : 'built-in default'}</span>
          <button type="button" role="switch" aria-checked={editing} onClick={() => (editing ? cancel() : setEditing(true))} title={editing ? 'Leave edit mode' : 'Enable editing'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editing ? 'bg-amber-500' : 'bg-ink-300'}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editing ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-xs text-ink-500">{editing ? 'Edit mode' : 'Enable editing'}</span>
        </div>
      </div>
      <textarea name="prompt" value={draft} onChange={(e) => setDraft(e.target.value)} readOnly={!editing} rows={16} spellCheck={false}
        className={`input mt-4 min-h-[320px] font-mono text-[13px] leading-relaxed ${editing ? '' : 'cursor-default bg-ink-100/60 text-ink-700'}`} />
      {preview && !editing && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-ink-500">Preview as the agent receives it (sample store)</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-ink-900 p-3 text-xs text-white">{preview}</pre>
        </details>
      )}
      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || !dirty} className="btn-primary !py-2.5 text-sm">{pending ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={cancel} disabled={pending} className="btn-secondary !py-2.5 text-sm">Cancel</button>
          {value && (
            <button formAction={resetDisputePrompt} formNoValidate disabled={pending} onClick={(e) => { if (!window.confirm('Go back to the built-in default prompt?')) e.preventDefault() }} className="text-xs text-ink-500 hover:text-ink-900 hover:underline">Reset to default</button>
          )}
          {dirty && !pending && <span className="text-xs text-amber-700">unsaved changes</span>}
        </div>
      )}
      {state?.ok && <p className="mt-3 text-sm text-emerald-700">{state.ok}</p>}
      {state?.error && <p className="mt-3 text-sm text-red-700">{state.error}</p>}
      {footnote && <p className="mt-3 text-xs text-ink-500">{footnote}</p>}
    </form>
  )
}

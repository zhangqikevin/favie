'use client'
import { useActionState, useEffect, useState } from 'react'
import { publishPrompt, type AdminState } from './actions'

/**
 * The global agent prompt. Opens read-only; an explicit Edit switch unlocks the textarea, and publishing
 * asks for a confirmation plus a change note, because one publish reaches every customer's agent.
 */
export function PromptEditor({ initial, activeVersion, activeAt }: { initial: string; activeVersion: number | null; activeAt: string | null }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(publishPrompt, undefined)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial)
  const [note, setNote] = useState('')
  const dirty = draft !== initial

  // After a successful publish the server re-renders with the new `initial`; drop back to read-only.
  useEffect(() => { if (state?.ok) { setEditing(false); setNote('') } }, [state?.ok])
  useEffect(() => { if (!editing) setDraft(initial) }, [initial, editing])

  const cancel = () => {
    if (dirty && !window.confirm('Discard your unsaved changes to the prompt?')) return
    setDraft(initial); setNote(''); setEditing(false)
  }
  const confirmPublish = (e: React.FormEvent<HTMLFormElement>) => {
    if (!dirty) { e.preventDefault(); return }
    if (!window.confirm(`Publish this prompt as v${(activeVersion ?? 0) + 1} to EVERY customer agent?\n\nIt takes effect on each agent's next run. Version history lets you roll back.`)) e.preventDefault()
  }

  return (
    <form action={action} onSubmit={confirmPublish} className={`card p-6 ${editing ? 'ring-2 ring-amber-300' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-700">
          {activeVersion ? <>Active: <b>v{activeVersion}</b>{activeAt ? <span className="text-ink-500"> · published {new Date(activeAt).toLocaleString('en-US')}</span> : null}</> : <>No version published yet — this is the built-in default routine.</>}
        </p>
        <div className="flex items-center gap-3">
          {editing ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Editing — nothing is live until you publish</span>
          ) : (
            <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700">Read-only</span>
          )}
          {/* the edit switch */}
          <button
            type="button"
            role="switch"
            aria-checked={editing}
            onClick={() => (editing ? cancel() : setEditing(true))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editing ? 'bg-amber-500' : 'bg-ink-300'}`}
            title={editing ? 'Leave edit mode' : 'Enable editing'}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editing ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-xs text-ink-500">{editing ? 'Edit mode' : 'Enable editing'}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-500">Markdown. Must start with a <code>##</code> heading. The agent reads this as the "Mode daily" section of its skill.</p>
      <textarea
        name="prompt"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        readOnly={!editing}
        rows={28}
        spellCheck={false}
        className={`input mt-4 min-h-[520px] font-mono text-[13px] leading-relaxed ${editing ? '' : 'cursor-default bg-ink-100/60 text-ink-700'}`}
      />
      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input name="note" value={note} onChange={(e) => setNote(e.target.value)} required placeholder="What changed? (required — shown in version history)" className="input !w-auto min-w-[300px] flex-1 !py-2 text-sm" />
          <button type="submit" disabled={pending || !dirty || note.trim().length < 3} className="btn-primary !py-2.5 text-sm">{pending ? 'Publishing…' : `Publish as v${(activeVersion ?? 0) + 1} to all agents`}</button>
          <button type="button" onClick={cancel} disabled={pending} className="btn-secondary !py-2.5 text-sm">Cancel</button>
          {dirty && !pending && <span className="text-xs text-amber-700">unsaved changes</span>}
          {!dirty && <span className="text-xs text-ink-500">no changes yet</span>}
        </div>
      )}
      {state?.ok && <p className="mt-3 text-sm text-emerald-700">{state.ok}</p>}
      {state?.error && <p className="mt-3 text-sm text-red-700">{state.error}</p>}
    </form>
  )
}

'use client'
import { useActionState } from 'react'
import { saveZooworkKey, clearZooworkKey, saveDefaultModel, applyModelToAgents, type AdminState } from './actions'

export function PlatformSettings({ keyInfo, models, defaultModel, agentCount }: {
  keyInfo: { source: 'database' | 'environment' | 'none'; last4: string | null; updatedAt: string | null }
  models: { model: string; label?: string }[]
  defaultModel: string | null
  agentCount: number
}) {
  const [keyState, keyAction, keyPending] = useActionState<AdminState, FormData>(saveZooworkKey, undefined)
  const [modelState, modelAction, modelPending] = useActionState<AdminState, FormData>(saveDefaultModel, undefined)
  const [applyState, applyAction, applyPending] = useActionState<AdminState, FormData>(applyModelToAgents, undefined)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="font-display text-sm font-bold">ZooWork organization key</h2>
        <p className="mt-1 text-xs text-ink-500">
          Used server-side for every ZooWork call: creating customers' agents, schedules, login handoffs, run collection and skill publishing. Stored encrypted; the environment variable is only the fallback.
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5"><dt className="text-ink-500">In use:</dt><dd className="font-mono">{keyInfo.last4 ? `zct_…${keyInfo.last4}` : '—'}</dd></div>
          <div className="flex gap-1.5"><dt className="text-ink-500">Source:</dt><dd>{keyInfo.source === 'database' ? 'saved here' : keyInfo.source === 'environment' ? 'ZOOWORK_API_KEY env' : 'none'}</dd></div>
          {keyInfo.updatedAt && <div className="flex gap-1.5"><dt className="text-ink-500">Saved:</dt><dd>{new Date(keyInfo.updatedAt).toLocaleString('en-US')}</dd></div>}
        </dl>
        <form action={keyAction} className="mt-4 space-y-2">
          <input name="key" type="password" autoComplete="off" placeholder="zct_…  (new key; verified against ZooWork before saving)" className="input font-mono text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={keyPending} className="btn-primary !py-2 text-sm">{keyPending ? 'Verifying…' : 'Verify & save'}</button>
            {keyInfo.source === 'database' && (
              <button formAction={clearZooworkKey} formNoValidate className="text-xs text-ink-500 hover:text-ink-900 hover:underline">Remove and fall back to env</button>
            )}
          </div>
          {keyState?.ok && <p className="text-sm text-emerald-700">{keyState.ok}</p>}
          {keyState?.error && <p className="text-sm text-red-700">{keyState.error}</p>}
        </form>
        <p className="mt-3 text-xs text-ink-500">Rotating the key does not touch existing agents, sessions or saved browser logins — they belong to the organization, not to the key.</p>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-sm font-bold">Default agent model</h2>
        <p className="mt-1 text-xs text-ink-500">Model given to every newly created customer agent. Existing agents keep theirs until you apply the change below.</p>
        <form action={modelAction} className="mt-4 space-y-2">
          <select name="model" defaultValue={defaultModel ?? ''} className="input text-sm">
            <option value="" disabled>Choose a model…</option>
            {models.map((m) => <option key={m.model} value={m.model}>{m.label && m.label !== m.model ? `${m.label} — ${m.model}` : m.model}</option>)}
          </select>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={modelPending} className="btn-primary !py-2 text-sm">{modelPending ? 'Saving…' : 'Save default'}</button>
            <span className="text-xs text-ink-500">Current: <span className="font-mono">{defaultModel ?? 'auto (claude-sonnet-5 if available)'}</span></span>
          </div>
          {modelState?.ok && <p className="text-sm text-emerald-700">{modelState.ok}</p>}
          {modelState?.error && <p className="text-sm text-red-700">{modelState.error}</p>}
        </form>
        <form action={applyAction} className="mt-4 border-t border-ink-100 pt-4">
          <button type="submit" disabled={applyPending || agentCount === 0} className="btn-secondary !py-2 text-sm">{applyPending ? 'Updating agents…' : `Apply to ${agentCount} existing agent${agentCount === 1 ? '' : 's'}`}</button>
          <p className="mt-1.5 text-xs text-ink-500">Switches every provisioned agent to the default model. Persona, skills and schedules are untouched; the agent's config version increments.</p>
          {applyState?.ok && <p className="mt-2 text-sm text-emerald-700">{applyState.ok}</p>}
          {applyState?.error && <p className="mt-2 text-sm text-red-700">{applyState.error}</p>}
        </form>
      </section>
    </div>
  )
}

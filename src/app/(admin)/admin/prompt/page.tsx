import { activePrompt, promptHistory, defaultOperatingPrompt } from '@/lib/zoowork/skill-publish'
import { PromptEditor } from '../PromptEditor'
import { rollbackPrompt } from '../actions'

export default async function AdminPrompt() {
  const [active, history] = await Promise.all([activePrompt(), promptHistory(15)])
  return (
    <section>
      <h1 className="font-display text-2xl font-bold tracking-tight">Agent operating prompt</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-500">
        One prompt for every customer's agent. It is the daily-routine section of the <code>favie-ops</code> skill; publishing a new version pushes it to all agents at once.
        The connection protocol (handoff, login confirmation, store listing, summary format) stays fixed in code.
      </p>
      <div className="mt-5">
        <PromptEditor initial={active?.body ?? defaultOperatingPrompt()} activeVersion={active?.version ?? null} activeAt={active?.createdAt?.toISOString() ?? null} />
      </div>
      {history.length > 0 && (
        <div className="card mt-5 p-5">
          <h2 className="font-display text-sm font-bold">Version history</h2>
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {history.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-mono text-xs">v{v.version}</span>
                {v.isActive && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">active</span>}
                <span className="text-ink-700">{v.note ?? '—'}</span>
                <span className="text-xs text-ink-500">skill {v.skillVersion} · {v.createdAt.toLocaleString('en-US')} · {v.body.length} chars</span>
                {!v.isActive && (
                  <form action={rollbackPrompt} className="ml-auto">
                    <input type="hidden" name="version" value={v.version} />
                    <button type="submit" className="text-xs font-medium text-brand-700 hover:underline">Roll back to this</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser } from '@/server/restaurants'
import { getRun } from '@/server/activity'
import { getT } from '@/i18n/server'
import { INTL_TAG } from '@/i18n/config'

/** Plain-language run report: what the agent said, plus the structured summary if it parsed. */
export default async function RunPage({ params }: { params: Promise<{ restaurantId: string; runId: string }> }) {
  const { restaurantId, runId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const run = await getRun(r.id, runId)
  if (!run) notFound()
  const { locale } = await getT()
  const intl = INTL_TAG[locale]
  const text = (run.finalText ?? '').replace(/```favie-summary[\s\S]*?```/g, '').trim()

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/${r.id}?month=${run.runDate?.slice(0, 7) ?? ''}&day=${run.runDate ?? ''}`} className="text-sm text-ink-500 hover:text-ink-900">← Back to activity</Link>
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold">{run.kind === 'daily' ? 'Daily run' : run.kind === 'verify' ? 'Connection check' : 'Run'} · {run.runDate}</h1>
          <div className="flex gap-2 text-xs">
            <Pill>{run.status.replace('_', ' ')}</Pill>
            {run.outcome && <Pill tone={run.outcome === 'succeeded' ? 'ok' : 'warn'}>{run.outcome}</Pill>}
            {run.toolErrorCount > 0 && <Pill tone="warn">{run.toolErrorCount} tool error{run.toolErrorCount > 1 ? 's' : ''}</Pill>}
          </div>
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-500">Started</dt><dd>{run.startedAt ? run.startedAt.toLocaleString(intl, { timeZone: r.timezone }) : '—'}</dd></div>
          <div><dt className="text-ink-500">Finished</dt><dd>{run.finishedAt ? run.finishedAt.toLocaleString(intl, { timeZone: r.timezone }) : '—'}</dd></div>
          <div><dt className="text-ink-500">Events</dt><dd>{run.eventCount}</dd></div>
        </dl>
        {run.summaryParseError && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">The structured report could not be read: {run.summaryParseError}</p>}
      </div>
      <div className="card p-6">
        <h2 className="font-display text-base font-bold">Agent notes</h2>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-700">{text || 'No notes recorded.'}</pre>
      </div>
      {run.summaryJson != null && (
        <details className="card p-6">
          <summary className="cursor-pointer font-display text-base font-bold">Structured report (JSON)</summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs text-white">{JSON.stringify(run.summaryJson, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'ok' | 'warn' }) {
  return <span className={`rounded-full px-2.5 py-1 font-medium ${tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-700'}`}>{children}</span>
}

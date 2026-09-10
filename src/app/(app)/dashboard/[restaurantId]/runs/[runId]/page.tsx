import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser } from '@/server/restaurants'
import { getRun } from '@/server/activity'
import { getT } from '@/i18n/server'
import { INTL_TAG } from '@/i18n/config'
import type { DictKey } from '@/i18n'

/** Plain-language run report: what the agent said, plus the structured summary if it parsed. */
export default async function RunPage({ params }: { params: Promise<{ restaurantId: string; runId: string }> }) {
  const { restaurantId, runId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const run = await getRun(r.id, runId)
  if (!run) notFound()
  const { locale, t } = await getT()
  const intl = INTL_TAG[locale]
  const text = (run.finalText ?? '').replace(/```favie-summary[\s\S]*?```/g, '').trim()

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/${r.id}?month=${run.runDate?.slice(0, 7) ?? ''}&day=${run.runDate ?? ''}`} className="text-sm text-ink-500 hover:text-ink-900">{t('runs.back')}</Link>
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{t(`runs.kind.${run.kind}` as DictKey)} · {run.runDate}</h2>
          <div className="flex gap-2 text-xs">
            <Pill>{t(`runs.status.${run.status}` as DictKey)}</Pill>
            {run.outcome && <Pill tone={run.outcome === 'succeeded' ? 'ok' : 'warn'}>{t(`runs.outcome.${run.outcome}` as DictKey)}</Pill>}
            {run.toolErrorCount > 0 && <Pill tone="warn">{t('runs.toolErrors', { n: run.toolErrorCount })}</Pill>}
          </div>
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-500">{t('runs.started')}</dt><dd>{run.startedAt ? run.startedAt.toLocaleString(intl, { timeZone: r.timezone }) : '—'}</dd></div>
          <div><dt className="text-ink-500">{t('runs.finished')}</dt><dd>{run.finishedAt ? run.finishedAt.toLocaleString(intl, { timeZone: r.timezone }) : '—'}</dd></div>
          <div><dt className="text-ink-500">{t('runs.events')}</dt><dd>{run.eventCount}</dd></div>
        </dl>
        {run.summaryParseError && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('runs.parseError', { error: run.summaryParseError })}</p>}
      </div>
      <div className="card p-6">
        <h2 className="font-display text-base font-semibold">{t('runs.notes')}</h2>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-700">{text || t('runs.noNotes')}</pre>
      </div>
    </div>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'ok' | 'warn' }) {
  return <span className={`rounded-full px-2.5 py-1 font-medium ${tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-700'}`}>{children}</span>
}

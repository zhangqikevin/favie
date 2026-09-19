import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser } from '@/server/restaurants'
import { getRun, getActionsForRun } from '@/server/activity'
import { getT } from '@/i18n/server'
import { INTL_TAG } from '@/i18n/config'
import type { DictKey } from '@/i18n'
import { displayTitle, isObserveOnly, visibleEntries, moneyFromCents } from '@/lib/activity-display'

type Action = Awaited<ReturnType<typeof getActionsForRun>>[number]
type TFn = (key: DictKey, vars?: Record<string, string | number>) => string
const PLATFORM = { uber_eats: { label: 'Uber Eats', dot: 'bg-uber' }, doordash: { label: 'DoorDash', dot: 'bg-doordash' }, none: { label: 'Favie', dot: 'bg-ink-300' } } as const

/**
 * Run report for the owner. Everything shown here is what the agent wrote FOR the owner, in the owner's
 * language: the entry they clicked (full detail), the run's other entries, and the agent's observations.
 * The agent's working narration (English, tool-by-tool) stays in /admin.
 */
export default async function RunPage({ params, searchParams }: { params: Promise<{ restaurantId: string; runId: string }>; searchParams: Promise<{ action?: string }> }) {
  const { restaurantId, runId } = await params
  const { action: actionId } = await searchParams
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const [run, actions] = await Promise.all([getRun(r.id, runId), getActionsForRun(r.id, runId)])
  if (!run) notFound()
  const { locale, t } = await getT()
  const intl = INTL_TAG[locale]
  const focus = actions.find((a) => a.id === actionId) ?? null
  const others = actions.filter((a) => a.id !== focus?.id)
  const summary = run.summaryJson as { notes?: string | null; platforms?: { platform: 'uber_eats' | 'doordash'; observations?: string[] }[] } | null
  const observations = (summary?.platforms ?? []).flatMap((p) => (p.observations ?? []).filter((o) => !/^history page url:/i.test(o)).map((text) => ({ platform: p.platform, text })))
  const base = `/dashboard/${r.id}/runs/${run.id}`

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/${r.id}?month=${run.runDate?.slice(0, 7) ?? ''}&day=${run.runDate ?? ''}`} className="text-sm text-ink-500 hover:text-ink-900">{t('runs.back')}</Link>

      {focus && (
        <section className={`card p-6 sm:p-7 ${focus.needsAttention ? 'ring-1 ring-amber-300/70' : ''}`}>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{t('runs.thisEntry')}</p>
          <ActionBody a={focus} t={t} large />
        </section>
      )}

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{t(`runs.kind.${run.kind}` as DictKey)} · {run.runDate}</h2>
          <div className="flex gap-2 text-xs">
            <Pill>{t(`runs.status.${run.status}` as DictKey)}</Pill>
            {run.outcome && <Pill tone={run.outcome === 'succeeded' ? 'ok' : 'warn'}>{t(`runs.outcome.${run.outcome}` as DictKey)}</Pill>}
          </div>
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-500">{t('runs.started')}</dt><dd>{run.startedAt ? run.startedAt.toLocaleString(intl, { timeZone: r.timezone }) : '—'}</dd></div>
          <div><dt className="text-ink-500">{t('runs.finished')}</dt><dd>{run.finishedAt ? run.finishedAt.toLocaleString(intl, { timeZone: r.timezone }) : '—'}</dd></div>
          <div><dt className="text-ink-500">{t('runs.entries')}</dt><dd>{actions.length}</dd></div>
        </dl>
        {run.status === 'parse_failed' && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('runs.noReport')}</p>}
      </div>

      {others.length > 0 && (
        <section className="card p-6">
          <h2 className="font-display text-base font-semibold">{focus ? t('runs.otherEntries') : t('runs.allEntries')}</h2>
          <ul className="mt-2 divide-y divide-ink-200/60">
            {others.map((a) => (
              <li key={a.id} className="py-4">
                <ActionBody a={a} t={t} />
                <Link href={`${base}?action=${a.id}`} className="mt-2 inline-block text-xs text-ink-500 hover:text-ink-900">{t('runs.openEntry')}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(observations.length > 0 || summary?.notes) && (
        <section className="card p-6">
          <h2 className="font-display text-base font-semibold">{t('runs.observations')}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-700">
            {observations.map((o, i) => (
              <li key={i} className="flex gap-2"><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${PLATFORM[o.platform].dot}`} /><span>{o.text}</span></li>
            ))}
            {summary?.notes && <li className="flex gap-2"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ink-300" /><span>{summary.notes}</span></li>}
          </ul>
        </section>
      )}
    </div>
  )
}

function ActionBody({ a, t, large = false }: { a: Action; t: TFn; large?: boolean }) {
  const p = PLATFORM[a.platform]
  const sysVars = (a.sysVars ?? undefined) as Record<string, string> | undefined
  const title = a.sysKey ? t(`sys.${a.sysKey}.t` as DictKey, sysVars) : displayTitle(a.title)
  const reason = a.sysKey ? t(`sys.${a.sysKey}.r` as DictKey, sysVars) : a.reason
  const before = visibleEntries(a.before as Record<string, unknown> | null), after = visibleEntries(a.after as Record<string, unknown> | null)
  return (
    <div>
      <div className={`flex flex-wrap items-center gap-2 text-xs text-ink-500 ${large ? 'mt-3' : ''}`}>
        <span className={`h-2 w-2 rounded-full ${p.dot}`} />{p.label} · {t(`cat.${a.category}` as DictKey)}
        {!a.sysKey && isObserveOnly(a.title, a.after as Record<string, unknown> | null) && <span className="rounded-full bg-ink-100 px-2 py-0.5 font-medium text-ink-600">{t('cal.observeOnly')}</span>}
        {a.needsAttention && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{t('cal.needsAttention')}</span>}
      </div>
      <p className={`mt-2 font-semibold ${large ? 'font-display text-xl' : ''}`}>{title}</p>
      <p className={`mt-2 leading-relaxed text-ink-700 ${large ? 'text-base' : 'text-sm'}`}><span className="font-medium text-ink-900">{t('cal.why')}</span>{reason}</p>
      {(before.length > 0 || after.length > 0) && (
        <div className="mt-3 grid max-w-xl grid-cols-2 gap-2 text-xs">
          <Kv label={t('cal.before')} entries={before} />
          <Kv label={t('cal.after')} entries={after} />
        </div>
      )}
    </div>
  )
}

function Kv({ label, entries }: { label: string; entries: [string, unknown][] }) {
  return (
    <div className="rounded-lg bg-ink-100/70 p-2.5">
      <p className="font-medium text-ink-500">{label}</p>
      {entries.length ? entries.map(([k, val]) => (
        <p key={k} className="mt-0.5 text-ink-800">{k.replace(/_cents$/, '').replace(/_/g, ' ')}: <b>{/_cents$/.test(k) && typeof val === 'number' ? moneyFromCents(val) : typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}</b></p>
      )) : <p className="mt-0.5 text-ink-400">—</p>}
    </div>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'ok' | 'warn' }) {
  return <span className={`rounded-full px-2.5 py-1 font-medium ${tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-700'}`}>{children}</span>
}

import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db, schema } from '@/lib/db/client'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getConnections, PLATFORM_LABEL } from '@/server/restaurants'
import { disputeStats, DISPUTE_PLATFORMS, DISPUTE_CHECK_HOUR } from '@/lib/zoowork/disputes'
import { getT } from '@/i18n/server'
import { INTL_TAG } from '@/i18n/config'
import type { DictKey } from '@/i18n'
import { isoDaysAgo } from '@/server/metrics'
import { setDisputesEnabled, dismissDisputesIntro } from './actions'
import { ManualRun } from './ManualRun'

const money = (c: number | null | undefined) => (c == null ? '—' : `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
type Dispute = typeof schema.disputes.$inferSelect
type Check = typeof schema.disputeChecks.$inferSelect

export default async function DisputesPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const { t, locale } = await getT()
  const intl = INTL_TAG[locale]
  const connsP = getConnections(r.id)
  const manualP = db.select().from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.restaurantId, r.id), eq(schema.agentRuns.kind, 'disputes'), eq(schema.agentRuns.channel, 'api-manual')))
    .orderBy(desc(schema.agentRuns.createdAt)).limit(8)
  const conns = await connsP
  const connected = conns.filter((c) => c.status === 'connected').map((c) => c.platform)
  const supported = connected.filter((p) => DISPUTE_PLATFORMS.includes(p))
  const comingSoon = connected.filter((p) => !DISPUTE_PLATFORMS.includes(p))
  const [stats, checks] = await Promise.all([
    disputeStats(r.id, r.timezone),
    db.select().from(schema.disputeChecks)
      .where(and(eq(schema.disputeChecks.restaurantId, r.id), gte(schema.disputeChecks.date, isoDaysAgo(60, r.timezone))))
      .orderBy(desc(schema.disputeChecks.date), desc(schema.disputeChecks.platform)),
  ])
  const checkRunIds = checks.map((c) => c.runId).filter((x): x is string => !!x)
  // Manual test runs (the two buttons) are agent runs of kind `disputes` that no daily ledger row points to.
  const manualRuns = (await manualP).filter((x) => !checkRunIds.includes(x.id)).slice(0, 8)
  const running = manualRuns.some((x) => x.status === 'running')
  const runIds = [...checkRunIds, ...manualRuns.map((x) => x.id)]
  const details = runIds.length ? await db.select().from(schema.disputes).where(and(eq(schema.disputes.restaurantId, r.id), inArray(schema.disputes.runId, runIds))).orderBy(desc(schema.disputes.orderDate)) : []
  const byRun = new Map<string, Dispute[]>()
  for (const d of details) if (d.runId) byRun.set(d.runId, [...(byRun.get(d.runId) ?? []), d])
  const platformNames = (ps: string[]) => ps.map((p) => PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL]).join(' / ')
  const checkTime = `${String(DISPUTE_CHECK_HOUR).padStart(2, '0')}:00`
  const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(intl, { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' })

  return (
    <div className="space-y-6">
      {!r.disputesIntroSeenAt && (
        <section className="card relative overflow-hidden p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-[#7C5CFF]/15 to-[#38C6F4]/15" />
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{t('disp.intro.kicker')}</p>
          <h2 className="font-display mt-1 text-xl font-bold">{t('disp.intro.title')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">{t('disp.intro.body', { time: checkTime })}</p>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            {supported.length ? t('disp.intro.platforms', { platforms: platformNames(supported) }) : t('disp.intro.connect')}
            {comingSoon.length ? ' ' + t('disp.intro.soon', { platforms: platformNames(comingSoon) }) : ''}
          </p>
          <form action={dismissDisputesIntro} className="mt-5">
            <input type="hidden" name="restaurantId" value={r.id} />
            <button type="submit" className="btn-primary">{t('disp.intro.ok')}</button>
          </form>
        </section>
      )}

      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{r.disputesEnabled ? t('disp.toggle.on') : t('disp.toggle.off')}</p>
          <p className="mt-1 text-sm text-ink-500">
            {r.disputesEnabled
              ? t('disp.toggle.desc', { time: checkTime, platforms: platformNames(supported.length ? supported : DISPUTE_PLATFORMS) })
              : t('disp.toggle.offDesc')}
            {comingSoon.length ? <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">{t('disp.soon', { platforms: platformNames(comingSoon) })}</span> : null}
          </p>
        </div>
        <form action={setDisputesEnabled} className="flex items-center gap-3">
          <input type="hidden" name="restaurantId" value={r.id} />
          <input type="hidden" name="enabled" value={r.disputesEnabled ? 'false' : 'true'} />
          <span className="text-sm text-ink-500">{t('disp.toggle.label')}</span>
          <button type="submit" role="switch" aria-checked={r.disputesEnabled} aria-label={t('disp.toggle.label')}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${r.disputesEnabled ? 'bg-emerald-500' : 'bg-ink-300'}`}>
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${r.disputesEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </form>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">{t('disp.manual.title')}</h2>
            <p className="mt-1 text-sm text-ink-500">{t('disp.manual.desc')}</p>
          </div>
          <ManualRun restaurantId={r.id} running={running} />
        </div>
        {manualRuns.length > 0 && (
          <ul className="mt-5 divide-y divide-ink-200/60 border-t border-ink-200/60">
            {manualRuns.map((run) => {
              const ds = byRun.get(run.id) ?? []
              const startedAt = run.startedAt ?? run.createdAt
              const summary = run.summaryJson as { notes?: string | null; platforms?: { observations?: string[]; errors?: string[]; login?: string; login_failure_reason?: string | null }[] } | null
              // Only problems are shown here (login failed, agent errors); the agent's observations and notes are for /admin.
              const notes = (summary?.platforms?.flatMap((p) => [...(p.errors ?? []), p.login && p.login !== 'ok' ? `login ${p.login}: ${p.login_failure_reason ?? ''}` : '']) ?? []).filter(Boolean)
              const statusKey = (run.status === 'running' ? 'disp.manual.st.running' : run.status === 'collected' ? 'disp.manual.st.done' : run.status === 'parse_failed' && run.summaryParseError?.startsWith('agent error') ? 'disp.manual.st.failed' : run.status === 'parse_failed' ? 'disp.manual.st.unparsed' : run.status === 'timed_out' ? 'disp.manual.st.timedOut' : run.status === 'finished' ? 'disp.manual.st.finishing' : 'disp.manual.st.failed') as DictKey
              const head = (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <span className="text-sm tabular-nums text-ink-500">{startedAt.toLocaleString(intl, { timeZone: r.timezone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={`text-sm ${run.status === 'running' ? 'text-amber-700' : run.status === 'collected' ? 'text-ink-700' : 'text-red-700'}`}>{t(statusKey)}</span>
                  {run.status === 'collected' && <span className="text-sm text-ink-500">· {t('disp.manual.found', { n: ds.length, filed: ds.filter((d) => d.status === 'filed' && d.filedBy !== 'owner').length })}</span>}
                  {ds.length > 0 && <span className="ml-auto text-xs text-ink-400">{t('disp.row.details', { n: ds.length })}</span>}
                </div>
              )
              const notesEl = notes.length > 0 && (
                <ul className="mb-3 space-y-1 text-sm text-ink-600">{notes.map((n, i) => <li key={i} className="rounded-xl bg-ink-50 px-3 py-2">{n}</li>)}</ul>
              )
              if (!ds.length) return <li key={run.id}>{head}{notesEl}</li>
              return (
                <li key={run.id}>
                  <details>
                    <summary className="cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">{head}</summary>
                    {notesEl}
                    <ul className="space-y-3 pb-4 pt-1">{ds.map((d) => <DisputeCard key={d.id} d={d} t={t} />)}</ul>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('disp.stat.found')} value={String(stats.foundMonth)} sub={t('disp.stat.foundSub')} />
        <Stat label={t('disp.stat.handled')} value={String(stats.filedMonth)} sub={stats.awaiting ? t('disp.stat.awaiting', { n: stats.awaiting }) : t('disp.stat.handledSub')} />
        <Stat label={t('disp.stat.wonMonth')} value={money(stats.wonMonthCents)} sub={t('disp.stat.wonMonthSub')} accent />
        <Stat label={t('disp.stat.wonAll')} value={money(stats.wonAllCents)} sub={t('disp.stat.wonAllSub')} />
      </div>

      <section className="card p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-6">
          <h2 className="font-display text-lg font-semibold">{t('disp.list.title')}</h2>
          <p className="text-xs text-ink-500">{t('disp.list.hint', { time: checkTime })}</p>
        </div>
        {checks.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-500">
            {supported.length ? t('disp.list.first', { time: checkTime }) : t('disp.list.connect')}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-200/60">
            {checks.map((c) => <CheckRow key={c.id} c={c} disputes={byRun.get(c.runId ?? '') ?? []} t={t} fmtDate={fmtDate} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="card p-6">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`font-display mt-2 text-3xl font-semibold tracking-tight ${accent ? 'text-emerald-600' : ''}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-500">{sub}</p>
    </div>
  )
}

type TFn = (key: DictKey, vars?: Record<string, string | number>) => string

function CheckRow({ c, disputes, t, fmtDate }: { c: Check; disputes: Dispute[]; t: TFn; fmtDate: (iso: string) => string }) {
  const platform = PLATFORM_LABEL[c.platform]
  let line: string
  let tone = 'text-ink-700'
  if (c.status === 'failed') { line = c.error === 'running' ? t('disp.row.running') : t('disp.row.failed'); tone = 'text-amber-700' }
  else if (c.status === 'skipped') { line = c.error === 'disputes_disabled' ? t('disp.row.skipped.off') : c.error === 'not_connected' ? t('disp.row.skipped.notConnected') : t('disp.soon', { platforms: platform }); tone = 'text-ink-500' }
  else if (c.found === 0 && c.won === 0 && c.lost === 0) line = t('disp.row.none')
  else line = t('disp.row.summary', { found: c.found, filed: c.filed, amount: money(c.recoveredCents) })
  const results = c.won || c.lost ? t('disp.row.results', { won: c.won, lost: c.lost }) : null
  const expandable = disputes.length > 0
  const head = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4">
      <span className="w-32 shrink-0 text-sm font-medium tabular-nums">{fmtDate(c.date)}</span>
      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">{platform}</span>
      <span className={`text-sm ${tone}`}>{line}</span>
      {results && <span className="text-sm text-ink-500">· {results}</span>}
      {expandable && <span className="ml-auto text-xs text-ink-400">{t('disp.row.details', { n: disputes.length })}</span>}
    </div>
  )
  if (!expandable) return <li>{head}</li>
  return (
    <li>
      <details className="group">
        <summary className="cursor-pointer list-none select-none hover:bg-ink-50/60 [&::-webkit-details-marker]:hidden">{head}</summary>
        <ul className="space-y-3 bg-ink-50/40 px-6 pb-5 pt-2">
          {disputes.map((d) => <DisputeCard key={d.id} d={d} t={t} />)}
        </ul>
      </details>
    </li>
  )
}

const STATUS_TONE: Record<string, string> = {
  open: 'bg-ink-100 text-ink-600', filed: 'bg-sky-50 text-sky-700', won: 'bg-emerald-50 text-emerald-700', lost: 'bg-red-50 text-red-700', expired: 'bg-ink-100 text-ink-500', skipped: 'bg-ink-100 text-ink-500',
}

function DisputeCard({ d, t }: { d: Dispute; t: TFn }) {
  const statusKey = `disp.status.${d.status}` as DictKey
  return (
    <li className="rounded-2xl bg-[var(--card-bg)] p-4 text-sm shadow-sm ring-1 ring-ink-200/50">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{t('disp.d.order')} {d.orderExternalId}</span>
        {d.orderDate && <span className="text-ink-500">{d.orderDate}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[d.status] ?? STATUS_TONE.open}`}>{t(statusKey)}</span>
        {d.filedBy === 'owner' && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">{t('disp.filedBy.owner')}</span>}
        <span className="ml-auto tabular-nums">
          <span className="text-ink-500">{t('disp.d.amount')} </span>{money(d.amountCents)}
          {d.status === 'won' && <span className="ml-3 text-emerald-700">{t('disp.d.recovered')} {money(d.recoveredCents ?? d.amountCents)}</span>}
        </span>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {d.itemsDisputed && <div><dt className="text-xs text-ink-500">{t('disp.d.items')}</dt><dd>{d.itemsDisputed}{d.itemsTotal != null ? ` · ${t('disp.d.itemsTotal', { n: d.itemsTotal })}` : ''}</dd></div>}
        {d.customerNote && <div><dt className="text-xs text-ink-500">{t('disp.d.customer')}{d.customerPhoto ? ` · ${t('disp.d.photo')}` : ''}</dt><dd className="text-ink-700">{d.customerNote}</dd></div>}
        {d.reason && <div className="sm:col-span-2"><dt className="text-xs text-ink-500">{t('disp.d.reason')}{d.reasonCategory ? ` · ${d.reasonCategory}` : ''}</dt><dd>{d.reason}</dd></div>}
        {d.submittedText && <div className="sm:col-span-2"><dt className="text-xs text-ink-500">{t('disp.d.submitted')}</dt><dd className="mt-1 whitespace-pre-wrap rounded-xl bg-ink-50 px-3 py-2 font-mono text-xs text-ink-700">{d.submittedText}</dd></div>}
        {d.decisionText && <div className="sm:col-span-2"><dt className="text-xs text-ink-500">{t('disp.d.decision')}</dt><dd>{d.decisionText}</dd></div>}
      </dl>
    </li>
  )
}

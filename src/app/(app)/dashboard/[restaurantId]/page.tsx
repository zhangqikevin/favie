import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getConnections } from '@/server/restaurants'
import { getActionsForMonth, getRunsForMonth, currentMonth, monthBounds, todayLocal } from '@/server/activity'
import { ActivityCalendar, type CalendarAction } from './ActivityCalendar'
import { getT } from '@/i18n/server'

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ restaurantId: string }>; searchParams: Promise<{ month?: string; day?: string }> }) {
  const { restaurantId } = await params
  const { month, day } = await searchParams
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const ym = /^\d{4}-\d{2}$/.test(month ?? '') ? month! : currentMonth(r.timezone)
  const [actions, runs, conns] = await Promise.all([getActionsForMonth(r.id, ym), getRunsForMonth(r.id, ym), getConnections(r.id)])
  const b = monthBounds(ym)
  const prev = `${b.month === 1 ? b.year - 1 : b.year}-${String(b.month === 1 ? 12 : b.month - 1).padStart(2, '0')}`
  const next = `${b.month === 12 ? b.year + 1 : b.year}-${String(b.month === 12 ? 1 : b.month + 1).padStart(2, '0')}`
  const today = todayLocal(r.timezone)
  const connected = conns.filter((c) => c.status === 'connected')
  const attention = actions.filter((a) => a.needsAttention).length
  const { t } = await getT()

  const payload: CalendarAction[] = actions.map((a) => ({
    id: a.id, runId: a.runId, date: a.actionDate, platform: a.platform, category: a.category, title: a.title, reason: a.reason,
    before: a.before as Record<string, unknown> | null, after: a.after as Record<string, unknown> | null, amountCents: a.amountCents, needsAttention: a.needsAttention,
    at: a.occurredAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('dash.stat.actions')} value={String(actions.filter((a) => !['no_action', 'run_unparsed', 'interrupted'].includes(a.category)).length)} />
        <Stat label={t('dash.stat.runs')} value={String(runs.length)} sub={t('dash.stat.completed', { n: runs.filter((x) => x.status === 'collected').length })} />
        <Stat label={t('dash.stat.attention')} value={String(attention)} tone={attention ? 'warn' : 'ok'} />
      </div>

      {connected.length === 0 && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-sm text-brand-900">
          <p className="font-semibold">{t('dash.noPlatform.t')}</p>
          <p className="mt-1">{t('dash.noPlatform.b')} <Link href="/onboarding/connect" className="font-medium underline">{t('dash.noPlatform.link')}</Link>.</p>
        </div>
      )}

      <ActivityCalendar restaurantId={r.id} timezone={r.timezone} ym={ym} prev={prev} next={next} today={today} actions={payload} initialDay={day} runs={runs.map((x) => ({ id: x.id, date: x.runDate ?? '', status: x.status, kind: x.kind }))} />
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`font-display mt-1 text-3xl font-bold ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-ink-500">{sub}</p>}
    </div>
  )
}

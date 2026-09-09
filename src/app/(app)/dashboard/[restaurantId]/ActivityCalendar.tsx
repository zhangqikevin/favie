'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/i18n/client'
import type { DictKey } from '@/i18n'
import { INTL_TAG } from '@/i18n/config'

export type CalendarAction = {
  id: string; runId: string; date: string; platform: 'uber_eats' | 'doordash' | 'none'; category: string; title: string; reason: string
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; amountCents: number | null; needsAttention: boolean; at: string
}
type RunLite = { id: string; date: string; status: string; kind: string }

const PLATFORM = { uber_eats: { label: 'Uber Eats', dot: 'bg-uber' }, doordash: { label: 'DoorDash', dot: 'bg-doordash' }, none: { label: 'Favie', dot: 'bg-ink-300' } } as const
const money = (c: number | null | undefined) => (c == null ? null : `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)

export function ActivityCalendar({ restaurantId, timezone, ym, prev, next, today, actions, runs, initialDay }: {
  restaurantId: string; timezone: string; ym: string; prev: string; next: string; today: string; actions: CalendarAction[]; runs: RunLite[]; initialDay?: string
}) {
  const t = useT()
  const intl = INTL_TAG[useLocale()]
  const [y, m] = ym.split('-').map(Number) as [number, number]
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarAction[]>()
    for (const a of actions) { const arr = map.get(a.date) ?? []; arr.push(a); map.set(a.date, arr) }
    return map
  }, [actions])
  const defaultDay = initialDay && byDay.has(initialDay) ? initialDay : (byDay.has(today) ? today : [...byDay.keys()].sort().at(-1) ?? today)
  const [selected, setSelected] = useState(defaultDay)
  const dayActions = byDay.get(selected) ?? []
  const dayRuns = runs.filter((r) => r.date === selected)
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(intl, { month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="card p-6 lg:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{monthLabel}</h2>
          <div className="flex items-center gap-1 text-sm">
            <Link href={`/dashboard/${restaurantId}?month=${prev}`} className="rounded-lg px-2.5 py-1.5 hover:bg-ink-100" aria-label="Previous month">‹</Link>
            <Link href={`/dashboard/${restaurantId}?month=${next}`} className="rounded-lg px-2.5 py-1.5 hover:bg-ink-100" aria-label="Next month">›</Link>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-ink-500">
          {Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 8, 1 + i)).toLocaleDateString(intl, { weekday: 'short', timeZone: 'UTC' })).map((d, i) => <div key={i} className="py-1">{d}</div>)}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
            const acts = byDay.get(date) ?? []
            const platforms = [...new Set(acts.map((a) => a.platform))]
            const warn = acts.some((a) => a.needsAttention)
            const isSel = date === selected
            const isFuture = date > today
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition-colors ${
                  isSel ? 'border-brand-500 bg-brand-50 font-semibold text-brand-800' : isFuture ? 'border-transparent text-ink-300' : 'border-ink-100 text-ink-800 hover:bg-ink-100'
                } ${date === today && !isSel ? 'ring-1 ring-brand-300' : ''}`}
              >
                {i + 1}
                {acts.length > 0 && (
                  <span className="mt-1 flex gap-0.5">
                    {platforms.map((p) => <span key={p} className={`h-1.5 w-1.5 rounded-full ${PLATFORM[p].dot}`} />)}
                  </span>
                )}
                {warn && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-500">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-uber" />Uber Eats</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-doordash" />DoorDash</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{t('cal.legend.attention')}</span>
        </div>
      </section>

      <section className="lg:col-span-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display text-lg font-bold">{new Date(selected + 'T00:00:00Z').toLocaleDateString(intl, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</h3>
          {dayRuns.length > 0 && <span className="text-xs text-ink-500">{t('cal.runs', { n: dayRuns.length })}</span>}
        </div>
        {dayActions.length === 0 ? (
          <div className="card p-6 text-sm text-ink-500">
            {selected > today ? t('cal.empty.future') : dayRuns.some((r) => r.status === 'running' || r.status === 'discovered') ? t('cal.empty.running') : t('cal.empty.none')}
          </div>
        ) : (
          <ul className="space-y-3">
            {[...dayActions].sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention)).map((a) => (
              <li key={a.id} className={`card p-5 ${a.needsAttention ? 'border-amber-300' : ''}`}>
                <div className="flex items-center justify-between gap-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${PLATFORM[a.platform].dot}`} />{PLATFORM[a.platform].label} · {t(`cat.${a.category}` as DictKey)}</span>
                  {a.needsAttention && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{t('cal.needsAttention')}</span>}
                </div>
                <p className="mt-2 font-semibold">{a.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-700"><span className="font-medium text-ink-900">{t('cal.why')}</span>{a.reason}</p>
                {(a.before || a.after) && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Kv label={t('cal.before')} v={a.before} />
                    <Kv label={t('cal.after')} v={a.after} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
                  <span>{new Date(a.at).toLocaleTimeString(intl, { hour: 'numeric', minute: '2-digit', timeZone: timezone })}</span>
                  <Link href={`/dashboard/${restaurantId}/runs/${a.runId}`} className="hover:text-ink-900">{t('cal.viewRun')}</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Kv({ label, v }: { label: string; v: Record<string, unknown> | null }) {
  return (
    <div className="rounded-lg bg-ink-100/70 p-2.5">
      <p className="font-medium text-ink-500">{label}</p>
      {v ? Object.entries(v).map(([k, val]) => (
        <p key={k} className="mt-0.5 text-ink-800">{k.replace(/_cents$/, '').replace(/_/g, ' ')}: <b>{/_cents$/.test(k) && typeof val === 'number' ? money(val) : String(val)}</b></p>
      )) : <p className="mt-0.5 text-ink-400">—</p>}
    </div>
  )
}

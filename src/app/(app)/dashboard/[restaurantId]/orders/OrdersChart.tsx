'use client'
import { useState } from 'react'
import type { DaySeries } from '@/server/metrics'
import { useT, useLocale } from '@/i18n/client'
import { INTL_TAG } from '@/i18n/config'

type Key = 'all' | 'uber_eats' | 'doordash'
type Metric = 'orders' | 'gmvCents' | 'adSpendCents'
const money = (v: number) => `$${(v / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const fmt = (m: Metric, v: number | null) => (v == null ? '—' : m === 'orders' ? String(v) : money(v))
/** Compact per-point label: 42 · $1.2k · $84 */
const short = (m: Metric, v: number | null) => {
  if (v == null) return ''
  if (m === 'orders') return String(v)
  const d = v / 100
  return d >= 10_000 ? `$${(d / 1000).toFixed(0)}k` : d >= 1000 ? `$${(d / 1000).toFixed(1)}k` : `$${Math.round(d)}`
}

export function OrdersChart({ series }: { series: Record<Key, DaySeries[]> }) {
  const t = useT()
  const intl = INTL_TAG[useLocale()]
  const KEYS: [Key, string][] = [['all', t('orders.both')], ['uber_eats', 'Uber Eats'], ['doordash', 'DoorDash']]
  const METRICS: [Metric, string][] = [['orders', t('orders.metric.orders')], ['gmvCents', t('orders.metric.sales')], ['adSpendCents', t('orders.metric.ad')]]
  const [key, setKey] = useState<Key>('all')
  const [metric, setMetric] = useState<Metric>('orders')
  const [range, setRange] = useState<14 | 30>(14)
  const [hover, setHover] = useState<number | null>(null)
  // Drop trailing days with no data yet (yesterday is often still "immature" upstream) so the line does not fall to zero.
  const full = series[key]
  let lastIdx = full.length - 1
  while (lastIdx > 0 && full[lastIdx].orders == null && full[lastIdx].gmvCents == null && full[lastIdx].adSpendCents == null) lastIdx--
  const data = full.slice(0, lastIdx + 1).slice(-range)
  const values = data.map((d) => d[metric] ?? 0)
  const max = Math.max(1, ...values)
  const W = 720, H = 260, PADX = 24, TOP = 40, BOT = 30
  const slot = (W - PADX * 2) / Math.max(1, data.length)
  const barW = Math.max(6, Math.min(28, slot * 0.58))
  const x = (i: number) => PADX + slot * i + slot / 2
  const y = (v: number) => H - BOT - (v / max) * (H - BOT - TOP)
  const color = key === 'uber_eats' ? 'var(--color-uber)' : key === 'doordash' ? 'var(--color-doordash)' : '#3B6CFF'
  const gradId = `bar-${key}`
  const h = hover ?? data.length - 1
  const day = data[h]
  const dateLabel = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T00:00:00Z').toLocaleDateString(intl, { ...o, timeZone: 'UTC' })
  const dense = data.length > 16
  const tipW = 168, tipX = Math.min(W - tipW - 4, Math.max(4, x(h) - tipW / 2))

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 font-display text-lg font-semibold">{t('orders.chart.title')}</h2>
          {METRICS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMetric(k)} className={`pill ${metric === k ? 'pill-active' : ''}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {KEYS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKey(k)} className={`pill ${key === k ? 'pill-active' : ''}`}>{l}</button>
          ))}
          <span className="mx-1 hidden w-px self-stretch bg-ink-100 sm:block" />
          {([14, 30] as const).map((n) => (
            <button key={n} type="button" onClick={() => { setRange(n); setHover(null) }} className={`pill ${range === n ? 'pill-active' : ''}`}>{t(n === 14 ? 'orders.range14' : 'orders.range30')}</button>
          ))}
        </div>
      </div>

      {/* Selected day: all three figures, always visible */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-sm font-medium text-ink-700">{day ? dateLabel(day.date, { weekday: 'short', month: 'short', day: 'numeric' }) : ''}</span>
        {METRICS.map(([k, l]) => (
          <span key={k} className={`text-sm ${metric === k ? 'text-ink-900' : 'text-ink-500'}`}>
            {l} <span className={`font-display text-lg font-bold ${metric === k ? '' : 'text-ink-700'}`}>{fmt(k, day?.[k] ?? null)}</span>
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)} role="img" aria-label={`${METRICS.find(([k]) => k === metric)![1]} over the last ${range} days`}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={key === 'all' ? '#7C5CFF' : color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={key === 'all' ? '#38C6F4' : color} stopOpacity="0.75" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PADX} x2={W - PADX} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-ink-100)" strokeDasharray="3 4" />
        ))}
        {values.map((v, i) => {
          const isNull = data[i][metric] == null
          const top = y(v), hgt = Math.max(isNull ? 0 : 3, H - BOT - top)
          // Every bar carries its own number; on the 30-day view alternate the baseline so neighbours do not collide.
          const dy = dense && i % 2 === 1 ? -17 : -7
          return (
            <g key={i}>
              <rect x={x(i) - slot / 2} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
              <rect x={x(i) - barW / 2} y={H - BOT - hgt} width={barW} height={hgt} rx={Math.min(6, barW / 2)} fill={`url(#${gradId})`} opacity={hover == null || i === h ? 1 : 0.45} />
              {!isNull && (
                <text x={x(i)} y={top + dy} textAnchor="middle" fontSize={dense ? 9.5 : 11} fontWeight="600" fill="var(--color-ink-700)">{short(metric, v)}</text>
              )}
            </g>
          )
        })}
        {data.map((d, i) => (i % (dense ? 5 : 2) === 0 || i === data.length - 1) && (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">{dateLabel(d.date, { month: 'short', day: 'numeric' })}</text>
        ))}
        {/* Hover tooltip with all three metrics for the day */}
        {day && hover != null && (
          <g transform={`translate(${tipX}, 2)`}>
            <rect width={tipW} height="66" rx="12" fill="#0b0f19" />
            <text x="12" y="17" fontSize="10" fontWeight="700" fill="#ffffff">{dateLabel(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</text>
            {METRICS.map(([k, l], j) => (
              <g key={k}>
                <text x="12" y={33 + j * 15} fontSize="10" fill="#9aa3b5">{l}</text>
                <text x={tipW - 12} y={33 + j * 15} fontSize="10" fontWeight="700" textAnchor="end" fill={k === metric ? '#38C6F4' : '#ffffff'}>{fmt(k, day[k])}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </section>
  )
}

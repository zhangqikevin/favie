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
  const x = (i: number) => PADX + (i * (W - PADX * 2)) / Math.max(1, data.length - 1)
  const y = (v: number) => H - BOT - (v / max) * (H - BOT - TOP)
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${path} L${x(values.length - 1).toFixed(1)},${H - BOT} L${x(0).toFixed(1)},${H - BOT} Z`
  const color = key === 'uber_eats' ? 'var(--color-uber)' : key === 'doordash' ? 'var(--color-doordash)' : 'var(--color-brand-500)'
  const h = hover ?? data.length - 1
  const day = data[h]
  const dateLabel = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T00:00:00Z').toLocaleDateString(intl, { ...o, timeZone: 'UTC' })
  const dense = data.length > 16
  const step = (W - PADX * 2) / Math.max(1, data.length - 1)
  const tipW = 168, tipX = Math.min(W - tipW - 4, Math.max(4, x(h) - tipW / 2))

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-ink-100 p-1 text-sm">
          {METRICS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMetric(k)} className={`rounded-lg px-3 py-1.5 font-medium ${metric === k ? 'bg-white shadow-sm' : 'text-ink-500'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-xl bg-ink-100 p-1 text-sm">
            {KEYS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setKey(k)} className={`rounded-lg px-3 py-1.5 font-medium ${key === k ? 'bg-white shadow-sm' : 'text-ink-500'}`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1 rounded-xl bg-ink-100 p-1 text-sm">
            {([14, 30] as const).map((n) => (
              <button key={n} type="button" onClick={() => { setRange(n); setHover(null) }} className={`rounded-lg px-3 py-1.5 font-medium ${range === n ? 'bg-white shadow-sm' : 'text-ink-500'}`}>{t(n === 14 ? 'orders.range14' : 'orders.range30')}</button>
            ))}
          </div>
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
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PADX} x2={W - PADX} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-ink-100)" strokeDasharray="3 4" />
        ))}
        <path d={area} fill={color} opacity="0.12" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {values.map((v, i) => {
          const isNull = data[i][metric] == null
          // Every point carries its own number; on 30-day view alternate the baseline so neighbours do not collide.
          const dy = dense && i % 2 === 1 ? -20 : -9
          return (
            <g key={i}>
              <rect x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
              <circle cx={x(i)} cy={y(v)} r={i === h ? 4.5 : 2.5} fill={i === h ? 'white' : color} stroke={color} strokeWidth={i === h ? 2.5 : 0} />
              {!isNull && i !== h && (
                <text x={x(i)} y={y(v) + dy} textAnchor="middle" fontSize={dense ? 9.5 : 11} fontWeight="600" fill="var(--color-ink-700)">{short(metric, v)}</text>
              )}
              {i === h && <line x1={x(i)} x2={x(i)} y1={TOP - 10} y2={H - BOT} stroke={color} strokeWidth="1" opacity="0.5" />}
            </g>
          )
        })}
        {data.map((d, i) => (i % (dense ? 5 : 2) === 0 || i === data.length - 1) && (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">{dateLabel(d.date, { month: 'short', day: 'numeric' })}</text>
        ))}
        {/* Hover tooltip with all three metrics for the day */}
        {day && hover != null && (
          <g transform={`translate(${tipX}, 2)`}>
            <rect width={tipW} height="66" rx="8" fill="white" stroke="var(--color-ink-100)" />
            <text x="10" y="16" fontSize="10" fontWeight="700" fill="var(--color-ink-900)">{dateLabel(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</text>
            {METRICS.map(([k, l], j) => (
              <g key={k}>
                <text x="10" y={32 + j * 15} fontSize="10" fill="var(--color-ink-500)">{l}</text>
                <text x={tipW - 10} y={32 + j * 15} fontSize="10" fontWeight="700" textAnchor="end" fill={k === metric ? color : 'var(--color-ink-900)'}>{fmt(k, day[k])}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </section>
  )
}

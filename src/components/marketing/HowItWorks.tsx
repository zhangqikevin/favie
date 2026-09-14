'use client'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n/client'
import { PlatformIcon } from '@/components/PlatformIcon'
import { Logo } from '@/components/marketing/Logo'
import { Food } from '@/components/marketing/Food'

const STEP_MS = 4500

/**
 * How it works: the three steps cycle on their own (click to jump, hover to pause). A highlight slides
 * behind the active step and the visual on the right switches with it: sign-up form → the two portal
 * login windows handed to the owner → the next morning's activity.
 */
export function HowItWorks() {
  const t = useT()
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const items = useRef<(HTMLLIElement | null)[]>([])
  const [hl, setHl] = useState({ top: 0, height: 0 })

  useEffect(() => { const mq = window.matchMedia('(prefers-reduced-motion: reduce)'); setReduced(mq.matches); const f = () => setReduced(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f) }, [])
  useEffect(() => {
    if (paused || reduced) return
    const id = setInterval(() => setStep((s) => (s + 1) % 3), STEP_MS)
    return () => clearInterval(id)
  }, [paused, reduced, step])
  useEffect(() => {
    const measure = () => { const el = items.current[step]; if (el) setHl({ top: el.offsetTop, height: el.offsetHeight }) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step])

  return (
    <div className="container-x grid items-center gap-14 lg:grid-cols-12" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="lg:col-span-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t('how.kicker')}</p>
        <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('how.title')}</h2>
        <ol className="relative mt-10">
          {/* sliding highlight */}
          <span aria-hidden="true" className="absolute left-0 right-0 rounded-2xl bg-white shadow-sm transition-[top,height] duration-500 ease-out" style={{ top: hl.top, height: hl.height }} />
          <span aria-hidden="true" className="absolute left-[31px] top-4 bottom-4 w-px bg-ink-300/50" />
          {([0, 1, 2] as const).map((i) => {
            const active = i === step
            return (
              <li key={i} ref={(el) => { items.current[i] = el }} className="relative">
                <button type="button" onClick={() => setStep(i)} aria-current={active ? 'step' : undefined} className="flex w-full gap-5 rounded-2xl px-4 py-4 text-left">
                  <span className={`font-display relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${active ? 'bg-brand-500 text-white' : 'bg-white text-ink-900 ring-1 ring-ink-300/60'}`}>{i + 1}</span>
                  <span className="min-w-0 pt-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold">{t(`how.${(i + 1) as 1 | 2 | 3}.t`)}</span>
                      <span className="rounded-full bg-ink-100/80 px-2 py-0.5 text-[11px] font-medium text-ink-500">{t(`how.${(i + 1) as 1 | 2 | 3}.time`)}</span>
                    </span>
                    <span className={`mt-1.5 block max-w-md leading-relaxed transition-colors duration-300 ${active ? 'text-ink-700' : 'text-ink-500'}`}>{t(`how.${(i + 1) as 1 | 2 | 3}.b`)}</span>
                    {active && !reduced && !paused && <span key={step} className="how-progress mt-3 block h-0.5 w-24 overflow-hidden rounded-full bg-ink-100"><span className="block h-full rounded-full bg-brand-500" style={{ animation: `how-fill ${STEP_MS}ms linear forwards` }} /></span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="relative mx-auto w-full max-w-xl lg:col-span-7">
        <Food item="boba" size={110} className="absolute -left-6 -top-10 -rotate-6" />
        <Food item="wings" size={130} className="absolute -bottom-10 -right-4 rotate-6" />
        <div className="relative min-h-[380px]">
          {/* 1 · sign up */}
          <Scene show={step === 0}>
            <div className="card mx-auto w-[88%] p-7 shadow-xl">
              <div className="flex items-center gap-2"><Logo className="h-7 w-7" /><span className="font-display text-sm font-bold">Favie</span></div>
              <p className="font-display mt-5 text-xl font-bold">{t('how.mock.add')}</p>
              <div className="mt-4 space-y-3">
                <div><p className="text-[11px] text-ink-500">{t('how.mock.name')}</p><div className="mt-1 h-10 rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900">Golden Wok 金锅 (Irvine)</div></div>
                <div><p className="text-[11px] text-ink-500">{t('how.mock.address')}</p><div className="mt-1 h-10 rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-700">2700 Alton Pkwy, Irvine, CA</div></div>
              </div>
              <div className="mt-5 flex h-11 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-white">{t('how.mock.continue')}</div>
            </div>
          </Scene>
          {/* 2 · the two portal logins */}
          <Scene show={step === 1}>
            <div className="card relative ml-auto w-[88%] p-0 shadow-xl">
              <Chrome url="merchant-portal.doordash.com" />
              <div className="flex items-center gap-4 px-6 py-7">
                <PlatformIcon platform="doordash" className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2.5"><div className="h-2.5 w-2/5 rounded bg-ink-100" /><div className="h-9 rounded-lg bg-ink-100/70" /><div className="h-9 rounded-lg bg-ink-100/70" /></div>
              </div>
            </div>
            <div className="card relative -mt-16 w-[88%] p-0 shadow-2xl">
              <Chrome url="merchants.ubereats.com/manager" />
              <div className="flex items-center gap-4 px-6 py-7">
                <PlatformIcon platform="uber_eats" className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2.5"><div className="h-2.5 w-2/5 rounded bg-ink-100" /><div className="h-9 rounded-lg bg-ink-100/70" /><div className="h-9 w-1/3 rounded-lg bg-ink-900" /></div>
              </div>
            </div>
            <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              {t('how.visual.badge')}
            </div>
          </Scene>
          {/* 3 · tomorrow morning: what Favie did */}
          <Scene show={step === 2}>
            <div className="card mx-auto w-[88%] p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Logo className="h-7 w-7" /><span className="font-display text-sm font-bold">Favie</span></div>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('how.mock.ran')}</span>
              </div>
              <ul className="mt-5 divide-y divide-ink-100">
                {/* every job runs on both platforms, so each row carries both marks */}
                {([
                  ['dash.nav.menu', '+12'],
                  ['cat.ad_budget_changed', '$40 → $31'],
                  ['cat.dispute_filed', '$14.50'],
                ] as const).map(([k, v], i) => (
                  <li key={i} className="flex items-center gap-3 py-3">
                    <span className="flex shrink-0 -space-x-2">
                      <PlatformIcon platform="uber_eats" className="h-8 w-8 rounded-lg ring-2 ring-white" />
                      <PlatformIcon platform="doordash" className="h-8 w-8 rounded-lg ring-2 ring-white" />
                    </span>
                    <span className="flex-1 text-sm font-medium">{t(k)}</span>
                    <span className="font-display text-sm font-bold tabular-nums">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Scene>
        </div>
      </div>
    </div>
  )
}

function Scene({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div aria-hidden={!show} className={`absolute inset-0 flex flex-col justify-center transition-all duration-500 ease-out ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}>
      <div className="relative">{children}</div>
    </div>
  )
}

function Chrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-ink-300/70" /><span className="h-2.5 w-2.5 rounded-full bg-ink-300/70" /><span className="h-2.5 w-2.5 rounded-full bg-ink-300/70" />
      <span className="ml-3 truncate rounded-md bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">{url}</span>
    </div>
  )
}

import Link from 'next/link'
import { Nav } from '@/components/marketing/Nav'
import { Logo } from '@/components/marketing/Logo'
import { DashboardPreview } from '@/components/marketing/DashboardPreview'
import { getT } from '@/i18n/server'

const HERO_IMG =
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=2400&q=70'

export default async function LandingPage() {
  const { t } = await getT()
  const benefits = [1, 2, 3] as const
  const faqs = [1, 2, 3, 4, 5, 6] as const
  const icons = [
    <path key="a" d="M4 17l5-5 4 4 7-8M15 8h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    <g key="b"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M12 8v8m-2.5-2.2c.4.9 1.4 1.2 2.5 1.2 1.4 0 2.5-.6 2.5-1.6 0-2.4-5-1.4-5-3.8 0-1 1.1-1.6 2.5-1.6 1.1 0 2.1.3 2.5 1.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></g>,
    <g key="c"><rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M3 10h18M8 3v4M16 3v4M8 15h3M13 15h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></g>,
  ]

  return (
    <main>
      <Nav />

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-ink-900 text-white">
        <img src={HERO_IMG} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-900/80 via-ink-900/70 to-ink-900" />
        <div className="container-x relative flex min-h-[92vh] flex-col items-center justify-center pb-24 pt-32 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {t('hero.badge')}
          </div>
          <h1 className="font-display max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
            {t('hero.title.pre')}<span className="text-brand-400">{t('hero.title.highlight')}</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">{t('hero.subtitle')}</p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary !px-7 !py-3.5 !text-base">
              {t('hero.cta')}
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h12m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <a href="#how" className="btn-ghost !px-7 !py-3.5 !text-base">{t('hero.secondary')}</a>
          </div>
          <p className="mt-4 text-sm text-white/60">{t('hero.fineprint')}</p>

          <dl className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {([1, 2, 3, 4] as const).map((i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                <dt className="font-display text-2xl font-bold sm:text-3xl">{t(`hero.stat${i}.v`)}</dt>
                <dd className="mt-1 text-xs text-white/70">{t(`hero.stat${i}.l`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="results" className="py-24">
        <div className="container-x">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t('benefits.kicker')}</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{t('benefits.title')}</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {benefits.map((i) => (
              <div key={i} className="card p-7">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">{icons[i - 1]}</svg>
                </div>
                <h3 className="font-display text-xl font-bold">{t(`benefits.${i}.t`)}</h3>
                <p className="mt-2 leading-relaxed text-ink-500">{t(`benefits.${i}.b`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-ink-100/60 py-24">
        <div className="container-x">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t('how.kicker')}</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{t('how.title')}</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {([1, 2, 3] as const).map((i) => (
              <li key={i} className="card relative p-7">
                <div className="font-display mb-4 text-4xl font-bold text-brand-500/30">0{i}</div>
                <h3 className="font-display text-lg font-bold">{t(`how.${i}.t`)}</h3>
                <p className="mt-2 leading-relaxed text-ink-500">{t(`how.${i}.b`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PRODUCT */}
      <section className="py-24">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t('product.kicker')}</p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('product.title')}</h2>
            <p className="mt-4 text-lg text-ink-500">{t('product.body')}</p>
          </div>
          <div className="mt-12"><DashboardPreview /></div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-ink-900 py-24 text-white">
        <div className="container-x grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">{t('pricing.kicker')}</p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('pricing.title')}</h2>
            <p className="mt-4 text-lg text-white/70">{t('pricing.body')}</p>
            <ul className="mt-8 space-y-3 text-white/85">
              {([1, 2, 3, 4, 5] as const).map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg className="mt-1 h-4 w-4 shrink-0 text-brand-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t(`pricing.f${i}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-white p-8 text-ink-900 shadow-2xl sm:p-10">
            <p className="text-sm font-semibold text-ink-500">{t('common.perRestaurant')}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-6xl font-bold tracking-tight">$299</span>
              <span className="text-ink-500">{t('common.month')}</span>
            </div>
            <p className="mt-3 text-sm text-ink-500">{t('pricing.billed')}</p>
            <Link href="/signup" className="btn-primary mt-8 w-full !py-4 !text-base">{t('common.getStarted')}</Link>
            <p className="mt-4 text-center text-sm text-ink-500">
              <span className="font-semibold text-ink-900">{t('pricing.guarantee.b')}</span> {t('pricing.guarantee')}
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="container-x max-w-3xl">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('faq.title')}</h2>
          <div className="mt-10 divide-y divide-ink-100">
            {faqs.map((i) => (
              <details key={i} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold">
                  {t(`faq.${i}.q`)}
                  <svg className="h-5 w-5 shrink-0 text-ink-300 transition-transform group-open:rotate-45" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </summary>
                <p className="mt-3 leading-relaxed text-ink-500">{t(`faq.${i}.a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + FOOTER */}
      <section className="border-t border-ink-100 bg-ink-100/60 py-20">
        <div className="container-x text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('cta.title')}</h2>
          <Link href="/signup" className="btn-primary mt-8 !px-8 !py-4 !text-base">{t('hero.cta')}</Link>
        </div>
      </section>
      <footer className="border-t border-ink-100 py-10 text-sm text-ink-500">
        <div className="container-x flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <span className="font-semibold text-ink-900">{t('common.brand')}</span>
            <span>· {t('footer.tagline')}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-ink-900">{t('footer.terms')}</Link>
            <Link href="/privacy" className="hover:text-ink-900">{t('footer.privacy')}</Link>
            <a href="mailto:hello@favie.us" className="hover:text-ink-900">{t('footer.contact')}</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

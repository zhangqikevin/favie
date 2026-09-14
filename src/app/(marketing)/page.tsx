import Link from 'next/link'
import { Nav } from '@/components/marketing/Nav'
import { Logo } from '@/components/marketing/Logo'
import { Food, FoodMarquee } from '@/components/marketing/Food'
import { DashboardPreview } from '@/components/marketing/DashboardPreview'
import { HowItWorks } from '@/components/marketing/HowItWorks'
import { getT } from '@/i18n/server'

// Counter scene: staff handing Uber Eats / DoorDash / Grubhub couriers their orders (public/hero.jpg, 1672×941).
const HERO_IMG = '/hero.jpg'

export default async function LandingPage() {
  const { t } = await getT()
  const faqs = [1, 2, 3, 4, 5, 6] as const
  const icons = [
    // menu card with photo + lines
    <g key="a" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 9.5h4M7 13h4M7 16.5h3" /><rect x="13.5" y="8.5" width="4.5" height="4.5" rx="1" /></g>,
    // trend up (ads & promos)
    <path key="b" d="M4 17l5-5 4 4 7-8M15 8h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    // shield with check (disputes)
    <g key="c" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z" /><path d="m9 12 2 2 4-4" /></g>,
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
            {t('hero.title.pre')}<span className="block text-brand-400">{t('hero.title.highlight')}</span>
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

      {/* WHERE THE MONEY LEAKS */}
      <section id="results" className="py-24">
        <div className="container-x">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t('leaks.kicker')}</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{t('leaks.title')}</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {([1, 2, 3] as const).map((i) => (
              <div key={i} className="relative overflow-hidden rounded-3xl bg-[#FFF4EA] p-8 pt-10">
                {/* faint oversized numeral: the leak's place in the story, not decoration */}
                <span aria-hidden="true" className="font-display pointer-events-none absolute -right-2 -top-6 select-none text-[120px] font-bold leading-none text-orange-500/10">{i}</span>
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-600 ring-1 ring-orange-200">{t(`leaks.${i}.tag`)}</span>
                <h3 className="font-display mt-5 text-2xl font-bold leading-tight tracking-tight">{t(`leaks.${i}.t`)}</h3>
                <p className="mt-3 max-w-[30ch] leading-relaxed text-ink-700">{t(`leaks.${i}.b`)}</p>
              </div>
            ))}
          </div>

          {/* THE THREE JOBS */}
          <p className="mt-20 text-sm font-semibold uppercase tracking-wider text-brand-600">{t('pillars.kicker')}</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{t('pillars.title')}</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {([1, 2, 3] as const).map((i) => (
              <div key={i} className="card relative flex flex-col p-7">
                <Food item={(['ramen', 'dumplings', 'fried_rice'] as const)[i - 1]} size={132} className="absolute -right-3 -top-9 rotate-6" />
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">{icons[i - 1]}</svg>
                </div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-500">{t(`pillars.${i}.k`)}{i === 3 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-700">{t('common.comingSoon')}</span>}</p>
                <h3 className="font-display mt-1 text-xl font-bold">{t(`pillars.${i}.t`)}</h3>
                <p className="mt-2 leading-relaxed text-ink-500">{t(`pillars.${i}.p`)}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {([1, 2, 3] as const).map((j) => (
                    <li key={j} className="rounded-full bg-ink-100/80 px-3 py-1 text-xs font-medium text-ink-700">{t(`pillars.${i}.b${j}`)}</li>
                  ))}
                </ul>
                <p className="mt-6 text-sm text-ink-500">{t(`pillars.${i}.see`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS: auto-cycling steps with a matching visual (client component) */}
      <section id="how" className="bg-ink-100/60 py-24">
        <HowItWorks />
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
            <ul className="mt-8 space-y-2.5 text-white/85">
              {([['g1', 1, 2], ['g2', 3, 4], ['g3', 5], ['g4', 6, 7]] as const).map(([g, ...items]) => (
                <li key={g}>
                  <p className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/50 first:mt-0">{t(`pricing.${g}`)}{g === 'g3' && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-white/70">{t('common.comingSoon')}</span>}</p>
                  <ul className="mt-1.5 space-y-2">
                    {items.map((i) => (
                      <li key={i} className="flex items-start gap-3">
                        <svg className="mt-1 h-4 w-4 shrink-0 text-brand-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {t(`pricing.f${i}`)}
                      </li>
                    ))}
                  </ul>
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
      <section className="border-t border-ink-100 bg-[#F5F7FA] py-20">
        <div className="container-x text-center">
          <FoodMarquee />
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('cta.title')}</h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary !px-8 !py-4 !text-base">{t('hero.cta')}</Link>
            <a href="#how" className="btn-secondary !px-8 !py-4 !text-base">{t('hero.secondary')}</a>
          </div>
        </div>
      </section>
      <footer className="border-t border-ink-100 py-10 text-sm text-ink-500">
        <div className="container-x flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
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

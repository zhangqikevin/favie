import Link from 'next/link'
import { Logo } from '@/components/marketing/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getT } from '@/i18n/server'

const STEPS = [
  { key: 'billing', label: 'ob.steps.billing' },
  { key: 'connect', label: 'ob.steps.connect' },
  { key: 'preferences', label: 'ob.steps.preferences' },
] as const

export async function OnboardingShell({ step, title, subtitle, children }: {
  step: (typeof STEPS)[number]['key']; title: string; subtitle?: string; children: React.ReactNode
}) {
  const { t } = await getT()
  const idx = STEPS.findIndex((s) => s.key === step)
  return (
    <main className="min-h-screen bg-ink-100/60">
      <header className="border-b border-ink-100 bg-white">
        <div className="container-x flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-display text-lg font-bold">{t('common.brand')}</span>
          </Link>
          <ol className="hidden items-center gap-2 text-sm sm:flex">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    i < idx ? 'bg-emerald-500 text-white' : i === idx ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500'
                  }`}
                >
                  {i < idx ? '✓' : i + 1}
                </span>
                <span className={i === idx ? 'font-medium text-ink-900' : 'text-ink-500'}>{t(s.label)}</span>
                {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-ink-100" />}
              </li>
            ))}
          </ol>
          <LanguageSwitcher />
        </div>
      </header>
      <div className="container-x max-w-3xl py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t('ob.step', { n: idx + 1, total: STEPS.length })}</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-ink-500">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  )
}

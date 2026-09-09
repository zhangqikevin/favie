import Link from 'next/link'
import { Logo } from '@/components/marketing/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getT } from '@/i18n/server'

const IMG = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=70'

export async function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode
}) {
  const { t } = await getT()
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-ink-900 text-white lg:block">
        <img src={IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-ink-900/30" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-display text-xl font-bold">{t('common.brand')}</span>
          </Link>
          <div>
            <p className="font-display max-w-md text-4xl font-bold leading-tight tracking-tight">
              {t('auth.side.title.pre')}<span className="text-brand-400">{t('auth.side.title.highlight')}</span>
            </p>
            <p className="mt-4 max-w-md text-white/70">{t('auth.side.body')}</p>
          </div>
        </div>
      </section>
      <section className="relative flex items-center justify-center px-5 py-16 sm:px-8">
        <div className="absolute right-5 top-5 sm:right-8"><LanguageSwitcher /></div>
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Logo className="h-8 w-8" />
            <span className="font-display text-xl font-bold">{t('common.brand')}</span>
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-ink-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-ink-500">{footer}</p>
        </div>
      </section>
    </main>
  )
}

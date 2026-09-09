import Link from 'next/link'
import { Logo } from './Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getT } from '@/i18n/server'

export async function Nav({ dark = true }: { dark?: boolean }) {
  const { t } = await getT()
  const text = dark ? 'text-white/85 hover:text-white' : 'text-ink-700 hover:text-ink-900'
  return (
    <header className={`absolute inset-x-0 top-0 z-20 ${dark ? 'text-white' : 'text-ink-900'}`}>
      <div className="container-x flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="font-display text-xl font-bold tracking-tight">{t('common.brand')}</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#how" className={text}>{t('nav.how')}</a>
          <a href="#results" className={text}>{t('nav.results')}</a>
          <a href="#pricing" className={text}>{t('nav.pricing')}</a>
          <a href="#faq" className={text}>{t('nav.faq')}</a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher tone={dark ? 'dark' : 'light'} />
          <Link href="/login" className={`hidden text-sm font-medium sm:block ${text}`}>{t('common.logIn')}</Link>
          <Link href="/signup" className="btn-primary !px-4 !py-2.5">{t('common.getStarted')}</Link>
        </div>
      </div>
    </header>
  )
}

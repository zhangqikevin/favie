'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALES, LOCALE_LABELS } from '@/i18n/config'
import { useLocale, useT } from '@/i18n/client'
import { setLocale } from '@/i18n/actions'

/** Compact <select> for the header; `tone` follows the header's background. */
export function LanguageSwitcher({ tone = 'light', className = '' }: { tone?: 'light' | 'dark'; className?: string }) {
  const locale = useLocale()
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  const cls = tone === 'dark'
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/20 [&>option]:text-ink-900'
    : 'border-ink-100 bg-white text-ink-700 hover:bg-ink-100'
  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="sr-only">{t('common.language')}</span>
      <svg viewBox="0 0 20 20" className={`h-4 w-4 ${tone === 'dark' ? 'text-white/70' : 'text-ink-500'}`} fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.5 10h15M10 2.5c2.5 2.5 2.5 12.5 0 15M10 2.5c-2.5 2.5-2.5 12.5 0 15" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => { const v = e.target.value; start(async () => { await setLocale(v); router.refresh() }) }}
        className={`rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${cls}`}
      >
        {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
      </select>
    </label>
  )
}

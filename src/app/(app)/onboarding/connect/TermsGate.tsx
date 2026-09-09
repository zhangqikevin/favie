'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptTerms } from '../actions'
import { useT } from '@/i18n/client'

export function TermsGate() {
  const [checked, setChecked] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  const t = useT()
  return (
    <section className="card p-7">
      <h2 className="font-display text-lg font-bold">{t('ob.terms.heading')}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-700">{t('ob.terms.body')}</p>
      <label className="mt-5 flex items-start gap-3 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 accent-brand-500" />
        <span>{t('ob.terms.check.pre')}<a href="/terms" className="underline" target="_blank">{t('ob.terms.check.tos')}</a>.</span>
      </label>
      <button
        type="button"
        disabled={!checked || pending}
        onClick={() => start(async () => { await acceptTerms(); router.refresh() })}
        className="btn-primary mt-6 !px-8 !py-3"
      >
        {pending ? t('common.saving') : t('ob.terms.agree')}
      </button>
    </section>
  )
}

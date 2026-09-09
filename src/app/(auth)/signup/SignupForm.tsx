'use client'
import { useActionState } from 'react'
import { signUp, type AuthState } from '../actions'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'

export function SignupForm() {
  const t = useT()
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, undefined)
  const err = state?.error ? (state.error.includes('.') && !state.error.includes(' ') ? t(state.error as DictKey) : state.error) : null
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">{t('signup.name')}</label>
        <input id="name" name="name" className="input" placeholder="Alex Chen" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">{t('signup.email')}</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@restaurant.com" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t('signup.password')}</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" placeholder={t('signup.passwordHint')} autoComplete="new-password" />
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3.5">
        {pending ? t('signup.submitting') : t('signup.submit')}
      </button>
      <p className="text-center text-xs text-ink-500">
        {t('signup.agree.pre')}<a href="/terms" className="underline">{t('footer.terms')}</a>{t('signup.agree.and')}<a href="/privacy" className="underline">{t('footer.privacy')}</a>.
      </p>
    </form>
  )
}

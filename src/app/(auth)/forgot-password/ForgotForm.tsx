'use client'
import { useActionState } from 'react'
import { requestPasswordReset, type AuthState } from '../actions'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'

export function ForgotForm({ email }: { email?: string }) {
  const t = useT()
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, undefined)
  const err = state?.error ? (/^(login|reset)\./.test(state.error) ? t(state.error as DictKey) : state.error) : null
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">{t('login.email')}</label>
        <input id="email" name="email" type="email" required defaultValue={email ?? ''} className="input" autoComplete="email" />
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3.5">{pending ? t('forgot.sending') : t('forgot.submit')}</button>
    </form>
  )
}

'use client'
import { useActionState } from 'react'
import { updatePassword, type AuthState } from '../actions'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'

export function ResetForm() {
  const t = useT()
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, undefined)
  const err = state?.error ? (/^(login|reset)\./.test(state.error) ? t(state.error as DictKey) : state.error) : null
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">{t('reset.password')}</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
        <p className="mt-1 text-xs text-ink-500">{t('signup.passwordHint')}</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">{t('reset.confirm')}</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} className="input" autoComplete="new-password" />
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3.5">{pending ? t('reset.saving') : t('reset.submit')}</button>
    </form>
  )
}

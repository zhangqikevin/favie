'use client'
import { useActionState } from 'react'
import { logIn, type AuthState } from '../actions'
import { useT } from '@/i18n/client'
import type { DictKey } from '@/i18n'

export function LoginForm({ next, email }: { next?: string; email?: string }) {
  const t = useT()
  const [state, action, pending] = useActionState<AuthState, FormData>(logIn, undefined)
  const err = state?.error ? (state.error.startsWith('login.') ? t(state.error as DictKey) : state.error) : null
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="label" htmlFor="email">{t('login.email')}</label>
        <input id="email" name="email" type="email" required defaultValue={email ?? ''} className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t('login.password')}</label>
        <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3.5">
        {pending ? t('login.submitting') : t('login.submit')}
      </button>
    </form>
  )
}

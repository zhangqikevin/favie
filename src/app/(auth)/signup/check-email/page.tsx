import Link from 'next/link'
import { AuthShell } from '../../AuthShell'
import { resendConfirmation } from '../../actions'
import { getT } from '@/i18n/server'

export const metadata = { title: 'Check your email — Favie' }

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; resent?: string }> }) {
  const { email, resent } = await searchParams
  const { t } = await getT()
  return (
    <AuthShell
      title={t('checkEmail.title')}
      subtitle={t('checkEmail.subtitle', { email: email ?? '' })}
      footer={<>{t('checkEmail.wrong')} <Link href="/signup" className="font-medium text-brand-600 hover:underline">{t('checkEmail.startOver')}</Link></>}
    >
      <div className="card p-6 text-sm text-ink-700">
        <p>{t('checkEmail.body')}</p>
        {resent && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{t('checkEmail.resent')}</p>}
        <form action={resendConfirmation} className="mt-4">
          <input type="hidden" name="email" value={email ?? ''} />
          <button type="submit" className="btn-secondary !py-2.5 text-sm" disabled={!email}>{t('checkEmail.resend')}</button>
        </form>
      </div>
    </AuthShell>
  )
}

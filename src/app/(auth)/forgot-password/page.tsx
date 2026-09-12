import Link from 'next/link'
import { AuthShell } from '../AuthShell'
import { ForgotForm } from './ForgotForm'
import { getT } from '@/i18n/server'

export const metadata = { title: 'Reset your Favie password' }

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string; sent?: string }> }) {
  const { email, sent } = await searchParams
  const { t } = await getT()
  return (
    <AuthShell title={t('forgot.title')} subtitle={t('forgot.subtitle')} footer={<Link href="/login" className="font-medium text-brand-600 hover:underline">{t('forgot.back')}</Link>}>
      {sent ? (
        <div className="rounded-lg bg-brand-50 px-3 py-3 text-sm text-brand-800">{t('forgot.sent', { email: email ?? '' })}</div>
      ) : (
        <ForgotForm email={email} />
      )}
    </AuthShell>
  )
}

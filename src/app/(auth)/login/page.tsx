import Link from 'next/link'
import { AuthShell } from '../AuthShell'
import { LoginForm } from './LoginForm'
import { getT } from '@/i18n/server'

export const metadata = { title: 'Log in to Favie' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; exists?: string; email?: string }> }) {
  const { next, error, exists, email } = await searchParams
  const { t } = await getT()
  return (
    <AuthShell
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={<>{t('login.new')} <Link href="/signup" className="font-medium text-brand-600 hover:underline">{t('login.create')}</Link></>}
    >
      {error && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('login.invalidLink')}</p>}
      {exists && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{t('login.exists')}</p>}
      <LoginForm next={next} email={email} />
    </AuthShell>
  )
}

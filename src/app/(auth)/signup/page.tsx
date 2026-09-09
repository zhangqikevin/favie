import Link from 'next/link'
import { AuthShell } from '../AuthShell'
import { SignupForm } from './SignupForm'
import { getT } from '@/i18n/server'

export const metadata = { title: 'Create your Favie account' }

export default async function SignupPage() {
  const { t } = await getT()
  return (
    <AuthShell
      title={t('signup.title')}
      subtitle={t('signup.subtitle')}
      footer={<>{t('signup.haveAccount')} <Link href="/login" className="font-medium text-brand-600 hover:underline">{t('common.logIn')}</Link></>}
    >
      <SignupForm />
    </AuthShell>
  )
}

import { redirect } from 'next/navigation'
import { AuthShell } from '../AuthShell'
import { ResetForm } from './ResetForm'
import { getT } from '@/i18n/server'
import { createSupabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Choose a new Favie password' }

/** Landing page of the recovery / invite link: /auth/confirm has already exchanged the token for a session. */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=invalid_link')
  const { t } = await getT()
  return (
    <AuthShell title={t('reset.title')} subtitle={t('reset.subtitle', { email: user.email ?? '' })} footer={null}>
      <ResetForm />
    </AuthShell>
  )
}

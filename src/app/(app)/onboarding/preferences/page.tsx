import { redirect } from 'next/navigation'
import { requireUser, getPrimaryRestaurant } from '@/server/auth'
import { getConnections, getAdCaps } from '@/server/restaurants'
import { OnboardingShell } from '../OnboardingShell'
import { PreferencesForm } from './PreferencesForm'
import { getT } from '@/i18n/server'

export default async function PreferencesStep() {
  const user = await requireUser()
  const r = await getPrimaryRestaurant(user.id)
  if (!r) redirect('/onboarding')
  if (r.onboardingStep === 'billing' || r.onboardingStep === 'connect') redirect(`/onboarding/${r.onboardingStep}`)
  const [conns, caps] = await Promise.all([getConnections(r.id), getAdCaps(r.id)])
  const connected = conns.filter((c) => c.status === 'connected')
  const { t } = await getT()

  return (
    <OnboardingShell
      step="preferences"
      title={connected.length ? t('ob.prefs.titleNamed', { name: r.name }) : t('ob.prefs.title')}
      subtitle={t('ob.prefs.subtitle')}
    >
      <PreferencesForm
        defaults={{ timezone: r.timezone, capUber: caps.uber_eats, capDoordash: caps.doordash }}
        connected={connected.map((c) => c.platform)}
      />
    </OnboardingShell>
  )
}

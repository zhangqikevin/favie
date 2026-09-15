import { SubmitButton } from '@/components/SubmitButton'
import { redirect } from 'next/navigation'
import { requireUser, getPrimaryRestaurant } from '@/server/auth'
import { getConnections } from '@/server/restaurants'
import { menuState } from '@/lib/zoowork/menu'
import { OnboardingShell } from '../OnboardingShell'
import { MenuClinic } from '@/components/MenuClinic'
import { continueFromMenu } from '../actions'
import { getT } from '@/i18n/server'

export default async function MenuStep() {
  const user = await requireUser()
  const r = await getPrimaryRestaurant(user.id)
  if (!r) redirect('/onboarding')
  if (r.onboardingStep === 'billing' || r.onboardingStep === 'connect') redirect(`/onboarding/${r.onboardingStep}`)
  const [conns, ue, dd] = await Promise.all([getConnections(r.id), menuState(r.id, 'uber_eats'), menuState(r.id, 'doordash')])
  const connected = { uber_eats: conns.find((c) => c.platform === 'uber_eats')?.status === 'connected', doordash: conns.find((c) => c.platform === 'doordash')?.status === 'connected' }
  const { t } = await getT()
  return (
    <OnboardingShell step="menu" title={t('ob.menu.title')} subtitle={t('ob.menu.subtitle')} wide>
      <div className="app-shell -mx-5 rounded-3xl px-5 py-6 sm:-mx-8 sm:px-8">
        <MenuClinic restaurantId={r.id} connected={connected} initial={{ uber_eats: ue, doordash: dd }} />
      </div>
      <form action={continueFromMenu} className="mt-8 flex flex-wrap items-center gap-4">
        <SubmitButton className="btn-primary !px-8 !py-3.5">{t('ob.menu.continue')}</SubmitButton>
        <SubmitButton className="text-sm text-ink-500 hover:text-ink-900">{t('ob.menu.skip')}</SubmitButton>
      </form>
    </OnboardingShell>
  )
}

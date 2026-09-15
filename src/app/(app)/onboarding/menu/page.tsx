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
        {/* Diagnosis + "Continue" live in a sticky side panel: the menu list can be long, the next step must stay in reach. */}
        <MenuClinic restaurantId={r.id} connected={connected} initial={{ uber_eats: ue, doordash: dd }} autoPull sidebar
          aside={
            <form action={continueFromMenu} className="space-y-3">
              <SubmitButton className="btn-primary w-full !py-3.5 !bg-brand-500 !text-white hover:!bg-brand-600">{t('ob.menu.continue')}</SubmitButton>
              <p className="text-center text-xs text-ink-500">{t('ob.menu.laterHint')}</p>
            </form>
          } />
      </div>
    </OnboardingShell>
  )
}

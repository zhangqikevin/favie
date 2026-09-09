import { redirect } from 'next/navigation'
import { requireUser, getPrimaryRestaurant } from '@/server/auth'
import { getConnections, getPrimaryAgent } from '@/server/restaurants'
import { OnboardingShell } from '../OnboardingShell'
import { ConnectPanel } from './ConnectPanel'
import { TermsGate } from './TermsGate'
import { getT } from '@/i18n/server'

export default async function ConnectStep() {
  const user = await requireUser()
  const r = await getPrimaryRestaurant(user.id)
  if (!r) redirect('/onboarding')
  if (r.onboardingStep === 'billing') redirect('/onboarding/billing')
  const [conns, agent] = await Promise.all([getConnections(r.id), getPrimaryAgent(r.id)])
  const { t } = await getT()

  if (!r.termsAcceptedAt) {
    return (
      <OnboardingShell step="connect" title={t('ob.terms.title')} subtitle={t('ob.terms.subtitle')}>
        <TermsGate />
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell
      step="connect"
      title={t('ob.connect.title')}
      subtitle={t('ob.connect.subtitle')}
    >
      <ConnectPanel
        restaurantId={r.id}
        agentStatus={agent?.agentStatus ?? 'none'}
        onboardingDone={r.onboardingStep === 'done'}
        initial={conns.map((c) => ({
          platform: c.platform, status: c.status, storeName: c.storeName, storeAddress: c.storeAddress, lastError: c.lastError,
          handoffUrl: c.handoffUrl, handoffStartedAt: c.handoffStartedAt?.toISOString() ?? null, storeCandidates: c.storeCandidates ?? null, progressNote: c.progressNote,
        }))}
      />
    </OnboardingShell>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getConnections, getPrimaryAgent } from '@/server/restaurants'
import { ConnectPanel } from '@/app/(app)/onboarding/connect/ConnectPanel'
import { getT } from '@/i18n/server'

/** Settings → Platform access: connect or reconnect a platform inside the app shell (not the onboarding flow). */
export default async function ConnectionsPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const [conns, agent] = await Promise.all([getConnections(r.id), getPrimaryAgent(r.id)])
  const { t } = await getT()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-500">{t('settings.platforms.manage')}</p>
        <Link href={`/dashboard/${r.id}/settings`} className="pill">{t('common.back')}</Link>
      </div>
      <ConnectPanel
        mode="manage"
        restaurantId={r.id}
        agentStatus={agent?.agentStatus ?? 'none'}
        onboardingDone
        initial={conns.map((c) => ({
          platform: c.platform, status: c.status, storeName: c.storeName, storeAddress: c.storeAddress, lastError: c.lastError,
          handoffUrl: c.handoffUrl, handoffStartedAt: c.handoffStartedAt?.toISOString() ?? null, storeCandidates: c.storeCandidates ?? null, progressNote: c.progressNote,
        }))}
      />
    </div>
  )
}

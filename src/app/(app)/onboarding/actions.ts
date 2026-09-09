'use server'

import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db/client'
import { requireUser, getPrimaryRestaurant } from '@/server/auth'
import { ensureStripeCustomer, createCheckoutSession } from '@/server/billing/checkout'
import { setAdCap } from '@/server/restaurants'
import { enqueueProvisionAgent, enqueueStartHandoff, enqueueConfirmLogin, enqueueReconcileSchedule } from '@/server/jobs/enqueue'
import { adoptRestaurantName } from '@/server/connections/transitions'
import { TERMS_VERSION } from '@/lib/terms'

async function ownRestaurant() {
  const user = await requireUser()
  const r = await getPrimaryRestaurant(user.id)
  if (!r) redirect('/onboarding')
  return { user, r }
}

export async function devSkipBilling() {
  if (process.env.FAVIE_SKIP_BILLING !== '1') redirect('/onboarding/billing')
  const { r } = await ownRestaurant()
  await db.update(schema.restaurants).set({ onboardingStep: 'connect', updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  redirect('/onboarding/connect')
}

export async function startCheckout() {
  const { user, r } = await ownRestaurant()
  const customerId = await ensureStripeCustomer(r.id, user.email, user.name)
  const url = await createCheckoutSession(r.id, customerId)
  redirect(url)
}

/** Service authorization must be accepted before the agent touches any platform. */
export async function acceptTerms() {
  const { r } = await ownRestaurant()
  await db.update(schema.restaurants).set({ termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION, updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  // Provision the agent as soon as we are allowed to; it is usually ready before the user finishes logging in.
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.restaurantId, r.id)).limit(1)
  if (agent && agent.agentStatus === 'none') await enqueueProvisionAgent(agent.id).catch((e) => console.warn('[onboarding] provision enqueue failed', e))
}

/** Owner picks one of the stores the agent saw in the account. */
export async function selectStore(platform: 'uber_eats' | 'doordash', externalId: string | null, name: string) {
  const { r } = await ownRestaurant()
  const [conn] = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform))).limit(1)
  const pick = (conn?.storeCandidates ?? []).find((c) => (externalId ? c.external_id === externalId : c.name === name))
  if (!conn || !pick) return
  await db.update(schema.platformConnections).set({
    status: 'connected', storeName: pick.name, storeExternalId: pick.external_id, storeAddress: pick.address,
    verifiedAt: new Date(), lastVerifiedAt: new Date(), lastError: null, brokenSince: null, updatedAt: new Date(),
  }).where(eq(schema.platformConnections.id, conn.id))
  await adoptRestaurantName(r.id, pick)
  await enqueueReconcileSchedule(r.id).catch(() => {})
}

const Prefs = z.object({
  timezone: z.string().min(3),
  capUber: z.string().optional(),
  capDoordash: z.string().optional(),
})
export type PrefsState = { error?: string } | undefined
const dollarsToCents = (v?: string) => {
  const n = Number((v ?? '').replace(/[^0-9.]/g, ''))
  return v && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export async function savePreferences(_prev: PrefsState, fd: FormData): Promise<PrefsState> {
  const { user, r } = await ownRestaurant()
  const parsed = Prefs.safeParse(Object.fromEntries(fd.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]!.message }
  const p = parsed.data
  await db.update(schema.restaurants).set({ timezone: p.timezone, onboardingStep: 'done', updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  await setAdCap(r.id, 'uber_eats', dollarsToCents(p.capUber), user.id)
  await setAdCap(r.id, 'doordash', dollarsToCents(p.capDoordash), user.id)
  await enqueueReconcileSchedule(r.id).catch(() => {})
  redirect(`/dashboard/${r.id}`)
}

export async function startConnect(platform: 'uber_eats' | 'doordash') {
  const { r } = await ownRestaurant()
  await db.update(schema.platformConnections)
    .set({ status: 'awaiting_login', handoffUrl: null, handoffSessionId: null, handoffStartedAt: new Date(), lastError: null, progressNote: 'Queued…', updatedAt: new Date() })
    .where(and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform)))
  await enqueueStartHandoff(r.id, platform).catch((e) => console.warn('[onboarding] handoff enqueue failed', e))
}

export async function confirmLoggedIn(platform: 'uber_eats' | 'doordash') {
  const { r } = await ownRestaurant()
  await db.update(schema.platformConnections)
    .set({ status: 'verifying', progressNote: 'Queued…', updatedAt: new Date() })
    .where(and(eq(schema.platformConnections.restaurantId, r.id), eq(schema.platformConnections.platform, platform), eq(schema.platformConnections.status, 'awaiting_login')))
  await enqueueConfirmLogin(r.id, platform).catch((e) => console.warn('[onboarding] confirm enqueue failed', e))
}

export async function continueToPreferences() {
  const { r } = await ownRestaurant()
  if (r.onboardingStep === 'connect') await db.update(schema.restaurants).set({ onboardingStep: 'preferences', updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  redirect(r.onboardingStep === 'done' ? `/dashboard/${r.id}` : '/onboarding/preferences')
}

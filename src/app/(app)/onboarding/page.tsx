import { redirect } from 'next/navigation'
import { requireUser, getPrimaryRestaurant } from '@/server/auth'
import { createRestaurantShell } from '@/server/restaurants'

/** Entry point: creates the restaurant shell on first visit, then routes to the current step. */
export default async function OnboardingIndex() {
  const user = await requireUser()
  let r = await getPrimaryRestaurant(user.id)
  if (!r) r = await createRestaurantShell(user.id)
  if (r.onboardingStep === 'done') redirect(`/dashboard/${r.id}`)
  redirect(`/onboarding/${r.onboardingStep}`)
}

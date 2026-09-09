import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/** Ensures a Stripe customer + subscriptions row exist for the restaurant; returns the customer id. */
export async function ensureStripeCustomer(restaurantId: string, email: string, name?: string | null) {
  const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.restaurantId, restaurantId)).limit(1)
  if (existing) return existing.stripeCustomerId
  const customer = await stripe().customers.create({
    email,
    name: name ?? undefined,
    metadata: { restaurant_id: restaurantId },
  })
  await db.insert(schema.subscriptions).values({ restaurantId, stripeCustomerId: customer.id, status: 'incomplete' }).onConflictDoNothing()
  return customer.id
}

/** Pay-now subscription Checkout (no trial). Refunds are handled manually in Stripe within 30 days. */
export async function createCheckoutSession(restaurantId: string, customerId: string) {
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID(), quantity: 1 }],
    client_reference_id: restaurantId,
    subscription_data: { metadata: { restaurant_id: restaurantId } },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/onboarding/connect?checkout=success`,
    cancel_url: `${appUrl()}/onboarding/billing?checkout=cancelled`,
  })
  return session.url!
}

export async function createPortalSession(customerId: string, restaurantId: string) {
  const portal = await stripe().billingPortal.sessions.create({
    customer: customerId,
    ...(process.env.STRIPE_PORTAL_CONFIG_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIG_ID } : {}),
    return_url: `${appUrl()}/dashboard/${restaurantId}/settings`,
  })
  return portal.url
}

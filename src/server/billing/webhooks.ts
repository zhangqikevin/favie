import type Stripe from 'stripe'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import type { SubscriptionStatus } from '@/lib/db/schema'
import { onBillingChanged } from '@/server/billing/hooks'

const toDate = (secs: number | null | undefined) => (secs ? new Date(secs * 1000) : null)

function restaurantIdFrom(sub: Stripe.Subscription): string | null {
  return (sub.metadata?.restaurant_id as string | undefined) ?? null
}

async function mirrorSubscription(sub: Stripe.Subscription, eventCreated: Date) {
  const restaurantId = restaurantIdFrom(sub)
  if (!restaurantId) return
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const item = sub.items.data[0]
  const periodEnd = item ? toDate(item.current_period_end) : null
  await db
    .insert(schema.subscriptions)
    .values({
      restaurantId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: item?.price.id ?? null,
      status: sub.status as SubscriptionStatus,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: toDate(sub.canceled_at),
      lastStripeEventCreated: eventCreated,
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.restaurantId,
      set: {
        stripeSubscriptionId: sub.id,
        stripePriceId: item?.price.id ?? null,
        status: sub.status as SubscriptionStatus,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: toDate(sub.canceled_at),
        lastStripeEventCreated: eventCreated,
        updatedAt: new Date(),
      },
      // Out-of-order protection: only apply if this event is newer than the last applied one.
      setWhere: sql`${schema.subscriptions.lastStripeEventCreated} IS NULL OR ${schema.subscriptions.lastStripeEventCreated} <= ${eventCreated}`,
    })
  await onBillingChanged(restaurantId)
}

/** Idempotent per event id. Throws to make Stripe retry only on unexpected failures. */
export async function handleStripeEvent(event: Stripe.Event) {
  const created = new Date(event.created * 1000)
  const inserted = await db
    .insert(schema.stripeEvents)
    .values({ id: event.id, type: event.type, created, payload: event as unknown as Record<string, unknown> })
    .onConflictDoNothing()
    .returning({ id: schema.stripeEvents.id })
  if (inserted.length === 0) return { duplicate: true }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object
        const restaurantId = s.client_reference_id
        if (restaurantId && s.mode === 'subscription') {
          await db.update(schema.subscriptions)
            .set({ firstPaidAt: created, stripeSubscriptionId: typeof s.subscription === 'string' ? s.subscription : s.subscription?.id ?? null, updatedAt: new Date() })
            .where(eq(schema.subscriptions.restaurantId, restaurantId))
          await db.update(schema.restaurants)
            .set({ onboardingStep: 'connect', updatedAt: new Date() })
            .where(sql`${schema.restaurants.id} = ${restaurantId} AND ${schema.restaurants.onboardingStep} = 'billing'`)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await mirrorSubscription(event.data.object, created)
        break
      case 'invoice.paid': {
        const inv = event.data.object
        const subId = typeof inv.parent?.subscription_details?.subscription === 'string'
          ? inv.parent.subscription_details.subscription
          : inv.parent?.subscription_details?.subscription?.id
        if (subId) {
          await db.update(schema.subscriptions)
            .set({ firstPaidAt: sql`COALESCE(${schema.subscriptions.firstPaidAt}, ${created})`, updatedAt: new Date() })
            .where(eq(schema.subscriptions.stripeSubscriptionId, subId))
        }
        break
      }
      case 'invoice.payment_failed':
        // Subscription status flips to past_due via customer.subscription.updated; email is M4.
        break
      case 'charge.refunded': {
        const ch = event.data.object
        const customerId = typeof ch.customer === 'string' ? ch.customer : ch.customer?.id
        if (customerId && ch.refunded) {
          await db.update(schema.subscriptions)
            .set({ refundedAt: created, updatedAt: new Date() })
            .where(eq(schema.subscriptions.stripeCustomerId, customerId))
        }
        break
      }
      default:
        break
    }
    await db.update(schema.stripeEvents).set({ processedAt: new Date() }).where(eq(schema.stripeEvents.id, event.id))
    return { duplicate: false }
  } catch (e) {
    await db.update(schema.stripeEvents).set({ error: (e as Error).message }).where(eq(schema.stripeEvents.id, event.id))
    throw e
  }
}

import type { SubscriptionStatus, ConnectionStatus } from '@/lib/db/schema'

export interface GateInput {
  subscriptionStatus: SubscriptionStatus | null | undefined
  serviceDisabled: boolean
  dailySchedulePaused?: boolean
  agentStatus: string
  connectionStatuses: ConnectionStatus[]
}

/** Billing is OK only while the subscription is active. There is no trial in V1. */
export function billingOk(status: SubscriptionStatus | null | undefined) {
  if (process.env.FAVIE_SKIP_BILLING === '1') return true // dev only: Stripe webhooks cannot reach localhost
  return status === 'active'
}

/**
 * Pure decision: should this restaurant's daily ZooWork schedule be enabled?
 * The only inputs are our own database state; the caller reconciles ZooWork to match.
 */
export function computeDesiredEnabled(i: GateInput): boolean {
  if (!billingOk(i.subscriptionStatus)) return false
  if (i.serviceDisabled) return false
  if (i.dailySchedulePaused) return false
  if (i.agentStatus !== 'ready') return false
  return i.connectionStatuses.some((s) => s === 'connected')
}

export function refundWindowEnd(firstPaidAt: Date | null | undefined, days = 30) {
  if (!firstPaidAt) return null
  return new Date(firstPaidAt.getTime() + days * 86_400_000)
}

export function refundDaysLeft(firstPaidAt: Date | null | undefined, now = new Date(), days = 30) {
  const end = refundWindowEnd(firstPaidAt, days)
  if (!end) return null
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000))
}

import Stripe from 'stripe'

let client: Stripe | undefined
export function stripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    client = new Stripe(key, { typescript: true })
  }
  return client
}

export const STRIPE_PRICE_ID = () => {
  const id = process.env.STRIPE_PRICE_ID
  if (!id) throw new Error('STRIPE_PRICE_ID is not set')
  return id
}

/** Yearly price ($3,289 = 11 × $299, recurring yearly). Optional: without it the yearly option is not offered. */
export const STRIPE_PRICE_ID_YEARLY = () => process.env.STRIPE_PRICE_ID_YEARLY || null

export const REFUND_WINDOW_DAYS = 30

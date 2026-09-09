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

export const REFUND_WINDOW_DAYS = 30

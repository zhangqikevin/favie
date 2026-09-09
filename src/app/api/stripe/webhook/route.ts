import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { handleStripeEvent } from '@/server/billing/webhooks'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 })
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  const body = await req.text()
  let event
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret)
  } catch (e) {
    return NextResponse.json({ error: `invalid signature: ${(e as Error).message}` }, { status: 400 })
  }
  try {
    const r = await handleStripeEvent(event)
    return NextResponse.json({ received: true, ...r })
  } catch (e) {
    console.error('[stripe webhook]', event.type, event.id, e)
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }
}

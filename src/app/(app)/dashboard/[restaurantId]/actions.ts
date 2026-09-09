'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getSubscription, setAdCap } from '@/server/restaurants'
import { createPortalSession } from '@/server/billing/checkout'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { encrypt } from '@/lib/crypto'
import { McpZoodataClient } from '@/lib/zoodata/mcp'
import { boss, JOBS } from '@/server/jobs/enqueue'

export type AdCapState = { ok?: boolean; error?: string } | undefined

export async function updateAdCap(_prev: AdCapState, fd: FormData): Promise<AdCapState> {
  const user = await requireUser()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const platform = String(fd.get('platform') ?? '')
  if (platform !== 'uber_eats' && platform !== 'doordash') return { error: 'Unknown platform' }
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) return { error: 'Not found' }
  const raw = String(fd.get('cap') ?? '').replace(/[^0-9.]/g, '')
  let cents: number | null = null
  if (raw) {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return { error: 'Enter a dollar amount' }
    if (n > 0 && n < 50) return { error: 'Caps under $50 are too small to manage meaningfully' }
    cents = n === 0 ? null : Math.round(n * 100)
  }
  await setAdCap(r.id, platform, cents, user.id)
  revalidatePath(`/dashboard/${r.id}/marketing`)
  return { ok: true }
}

export async function openBillingPortal(fd: FormData) {
  const user = await requireUser()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) redirect('/onboarding')
  const sub = await getSubscription(r.id)
  if (!sub) redirect(`/dashboard/${r.id}/settings`)
  redirect(await createPortalSession(sub.stripeCustomerId, r.id))
}

export type ZoodataKeyState = { ok?: boolean; storeName?: string | null; error?: string } | undefined

/** Owner pastes the per-restaurant Zoodata key; we verify it, store it encrypted, and kick off a sync. */
export async function saveZoodataKey(_prev: ZoodataKeyState, fd: FormData): Promise<ZoodataKeyState> {
  const user = await requireUser()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const key = String(fd.get('key') ?? '').trim()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) return { error: 'Not found' }
  if (key.length < 16) return { error: 'That does not look like a valid access key' }
  let storeName: string | null = null
  try {
    const client = new McpZoodataClient(process.env.ZOODATA_MCP_URL ?? 'https://api.zoodata.ai/mcp-restaurant', key)
    const list = await client.listRestaurants()
    if (list.length === 0) return { error: 'The key is valid but no restaurant is attached to it yet. Ask your data provider to grant your store, then try again.' }
    storeName = list[0]!.name
  } catch (e) {
    return { error: `The data provider rejected the key: ${(e as Error).message.slice(0, 120)}` }
  }
  await db.update(schema.restaurants).set({ zoodataKeyCiphertext: encrypt(key), updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  try { const b = await boss(); await b.send(JOBS.zoodataSync, { restaurantId: r.id }, { singletonKey: `zd:${r.id}`, singletonSeconds: 60 }) } catch (e) { console.warn('[zoodata] sync enqueue failed', e) }
  revalidatePath(`/dashboard/${r.id}/settings`)
  revalidatePath(`/dashboard/${r.id}/orders`)
  return { ok: true, storeName }
}

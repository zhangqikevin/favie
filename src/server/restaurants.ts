import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import type { Platform } from '@/lib/db/schema'

export const PLATFORMS: Platform[] = ['uber_eats', 'doordash']
export const PLATFORM_LABEL: Record<Platform, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash' }

/** Deterministic minute-of-hour so N restaurants do not all log in at the same second. */
function cronMinuteFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 60
}

/** Creates the restaurant shell + its delivery-ops agent row + two platform_connections rows. */
export async function createRestaurantShell(ownerUserId: string, name = 'My restaurant') {
  return db.transaction(async (tx) => {
    const [r] = await tx.insert(schema.restaurants).values({ ownerUserId, name }).returning()
    await tx.insert(schema.restaurantAgents).values({ restaurantId: r!.id, kind: 'delivery-ops', cronMinute: cronMinuteFor(r!.id) })
    await tx.insert(schema.platformConnections).values(PLATFORMS.map((platform) => ({ restaurantId: r!.id, platform })))
    return r!
  })
}

export async function getRestaurantForUser(restaurantId: string, userId: string) {
  const [r] = await db
    .select()
    .from(schema.restaurants)
    .where(and(eq(schema.restaurants.id, restaurantId), eq(schema.restaurants.ownerUserId, userId)))
    .limit(1)
  return r ?? null
}

export async function getConnections(restaurantId: string) {
  const rows = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.restaurantId, restaurantId))
  return PLATFORMS.map((p) => rows.find((r) => r.platform === p)!).filter(Boolean)
}

export async function getSubscription(restaurantId: string) {
  const [s] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.restaurantId, restaurantId)).limit(1)
  return s ?? null
}

export async function getPrimaryAgent(restaurantId: string) {
  const [a] = await db
    .select()
    .from(schema.restaurantAgents)
    .where(and(eq(schema.restaurantAgents.restaurantId, restaurantId), eq(schema.restaurantAgents.kind, 'delivery-ops')))
    .limit(1)
  return a ?? null
}

export async function getAdCaps(restaurantId: string) {
  const rows = await db.select().from(schema.adCaps).where(eq(schema.adCaps.restaurantId, restaurantId))
  return Object.fromEntries(PLATFORMS.map((p) => [p, rows.find((r) => r.platform === p)?.monthlyCapCents ?? null])) as Record<Platform, number | null>
}

export async function setAdCap(restaurantId: string, platform: Platform, newCapCents: number | null, userId: string) {
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.adCaps).where(and(eq(schema.adCaps.restaurantId, restaurantId), eq(schema.adCaps.platform, platform))).limit(1)
    if ((cur?.monthlyCapCents ?? null) === newCapCents && cur) return
    await tx
      .insert(schema.adCaps)
      .values({ restaurantId, platform, monthlyCapCents: newCapCents, updatedByUserId: userId })
      .onConflictDoUpdate({ target: [schema.adCaps.restaurantId, schema.adCaps.platform], set: { monthlyCapCents: newCapCents, updatedByUserId: userId, updatedAt: new Date() } })
    await tx.insert(schema.adCapHistory).values({ restaurantId, platform, oldCapCents: cur?.monthlyCapCents ?? null, newCapCents, changedByUserId: userId })
  })
}

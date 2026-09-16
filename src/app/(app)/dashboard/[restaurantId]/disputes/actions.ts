'use server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, schema } from '@/lib/db/client'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser } from '@/server/restaurants'

/** Owner switch: Favie checks and files disputes every morning (on by default). */
export async function setDisputesEnabled(fd: FormData) {
  const user = await requireUser()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) return
  const enabled = String(fd.get('enabled')) === 'true'
  await db.update(schema.restaurants).set({ disputesEnabled: enabled, updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  revalidatePath(`/dashboard/${r.id}/disputes`)
}

export async function dismissDisputesIntro(fd: FormData) {
  const user = await requireUser()
  const restaurantId = String(fd.get('restaurantId') ?? '')
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) return
  await db.update(schema.restaurants).set({ disputesIntroSeenAt: new Date(), updatedAt: new Date() }).where(eq(schema.restaurants.id, r.id))
  revalidatePath(`/dashboard/${r.id}/disputes`)
}

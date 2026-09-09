import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { createSupabaseServer } from '@/lib/supabase/server'
import { db, schema } from '@/lib/db/client'
import { getLocale } from '@/i18n/server'

export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/** Returns the signed-in user's `users` row, creating it on first sight. Redirects to /login when signed out. */
export async function requireUser() {
  const authUser = await getAuthUser()
  if (!authUser) redirect('/login')
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, authUser.id)).limit(1)
  if (row) {
    if (!row.locale) { const locale = await getLocale(); await db.update(schema.users).set({ locale }).where(eq(schema.users.id, row.id)).catch(() => {}); return { ...row, locale } }
    return row
  }
  const locale = await getLocale()
  const [created] = await db
    .insert(schema.users)
    .values({ id: authUser.id, email: authUser.email ?? '', name: (authUser.user_metadata?.name as string | undefined) ?? null, locale })
    .onConflictDoNothing()
    .returning()
  if (created) return created
  const [again] = await db.select().from(schema.users).where(eq(schema.users.id, authUser.id)).limit(1)
  return again!
}

/** The user's first restaurant (V1: one restaurant per account). */
export async function getPrimaryRestaurant(userId: string) {
  const [r] = await db
    .select()
    .from(schema.restaurants)
    .where(eq(schema.restaurants.ownerUserId, userId))
    .orderBy(schema.restaurants.createdAt)
    .limit(1)
  return r ?? null
}

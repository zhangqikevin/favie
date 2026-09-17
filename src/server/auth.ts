import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { createSupabaseServer } from '@/lib/supabase/server'
import { db, schema } from '@/lib/db/client'
import { getLocale } from '@/i18n/server'

export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServer()
  // Local JWT verification (see proxy.ts) — no Auth-server round trip per render.
  const { data } = await supabase.auth.getClaims()
  const c = data?.claims
  if (!c?.sub) return null
  return { id: c.sub, email: (c.email as string | undefined) ?? null, user_metadata: (c.user_metadata ?? {}) as Record<string, unknown> }
})

/**
 * Returns the signed-in user's `users` row, creating it on first sight. Redirects to /login when signed out.
 * Cached per request: the layout and the page both call it, and that used to be two identical queries.
 */
export const requireUser = cache(async () => requireUserUncached())

async function requireUserUncached() {
  const authUser = await getAuthUser()
  if (!authUser) redirect('/login')
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, authUser.id)).limit(1)
  if (row) {
    // The cookie is the language the user actually sees (browser default or an explicit switch); keep the
    // account in step with it so the agent writes its reports in the same language.
    const locale = await getLocale()
    if (row.locale !== locale) { await db.update(schema.users).set({ locale, updatedAt: new Date() }).where(eq(schema.users.id, row.id)).catch(() => {}); return { ...row, locale } }
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

'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE, isLocale } from './config'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { getAuthUser } from '@/server/auth'

/** Persist the chosen language for a year; the page refreshes itself afterwards. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return
  const c = await cookies()
  c.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  // Remember it on the account too, so the agent reports in the owner's language.
  const user = await getAuthUser().catch(() => null)
  if (user) await db.update(schema.users).set({ locale, updatedAt: new Date() }).where(eq(schema.users.id, user.id)).catch(() => {})
}

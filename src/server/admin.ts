import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'

const DEFAULT_ADMINS = ['kevin_z@srp.one']

export function adminEmails() {
  const env = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return new Set([...DEFAULT_ADMINS, ...env])
}

export function isAdminEmail(email: string | null | undefined) {
  return !!email && adminEmails().has(email.toLowerCase())
}

/** Signed-in AND on the admin list, else 404 (admins are not advertised). */
export async function requireAdmin() {
  const user = await requireUser()
  if (!isAdminEmail(user.email)) notFound()
  return user
}

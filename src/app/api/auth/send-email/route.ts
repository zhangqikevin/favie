import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { normalizeLocale, renderAuthEmail, type AuthEmailType } from '@/lib/email/auth-templates'

/**
 * Supabase Auth "Send Email" hook. Supabase calls this instead of its own mailer for every auth email;
 * we render the owner's language and send through Resend. Payload and signature follow Standard Webhooks
 * (headers webhook-id / webhook-timestamp / webhook-signature; secret `v1,whsec_<base64>`).
 * Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */
export const runtime = 'nodejs'

type Payload = {
  user: { id: string; email: string; user_metadata?: Record<string, unknown> }
  email_data: { token: string; token_hash: string; redirect_to: string; email_action_type: string; site_url: string; token_new?: string; token_hash_new?: string }
}

function verify(req: Request, raw: string): boolean {
  const secret = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET ?? ''
  const id = req.headers.get('webhook-id'), ts = req.headers.get('webhook-timestamp'), sigs = req.headers.get('webhook-signature')
  if (!secret || !id || !ts || !sigs) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false // 5-minute replay window
  const keys = secret.split(/\s+/).map((s) => s.replace(/^v1,/, '').replace(/^whsec_/, ''))
  const given = sigs.split(/\s+/).map((s) => s.replace(/^v1,/, ''))
  for (const k of keys) {
    const expected = createHmac('sha256', Buffer.from(k, 'base64')).update(`${id}.${ts}.${raw}`).digest('base64')
    for (const g of given) { const a = Buffer.from(expected), b = Buffer.from(g); if (a.length === b.length && timingSafeEqual(a, b)) return true }
  }
  return false
}

const TYPE: Record<string, { type: AuthEmailType; next: string }> = {
  signup: { type: 'signup', next: '/onboarding' },
  magiclink: { type: 'magiclink', next: '/dashboard' },
  recovery: { type: 'recovery', next: '/reset-password' },
  invite: { type: 'invite', next: '/reset-password' },
  email_change: { type: 'email_change', next: '/dashboard' },
  email_change_new: { type: 'email_change', next: '/dashboard' },
  email_change_current: { type: 'email_change', next: '/dashboard' },
  reauthentication: { type: 'reauthentication', next: '/dashboard' },
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!verify(req, raw)) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  const p = JSON.parse(raw) as Payload
  const kind = TYPE[p.email_data.email_action_type]
  if (!kind) return NextResponse.json({ error: `unsupported email_action_type ${p.email_data.email_action_type}` }, { status: 400 })

  // Language: our users table (kept in sync with the UI cookie) → sign-up metadata → English.
  const [row] = await db.select({ locale: schema.users.locale }).from(schema.users).where(eq(schema.users.id, p.user.id)).limit(1).catch(() => [])
  const locale = normalizeLocale(row?.locale ?? (p.user.user_metadata?.locale as string | undefined))

  // Our confirm route; `next` comes from the redirect the app asked for when it has one.
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? p.email_data.site_url).replace(/\/$/, '')
  let next = kind.next
  try { const n = new URL(p.email_data.redirect_to).searchParams.get('next'); if (n?.startsWith('/')) next = n } catch { /* keep default */ }
  const hashType = p.email_data.email_action_type === 'email_change_new' || p.email_data.email_action_type === 'email_change_current' ? 'email_change' : p.email_data.email_action_type
  const tokenHash = p.email_data.email_action_type === 'email_change_new' ? (p.email_data.token_hash_new || p.email_data.token_hash) : p.email_data.token_hash
  const link = kind.type === 'reauthentication' ? undefined : `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${hashType}&next=${encodeURIComponent(next)}`
  const newEmail = typeof p.user.user_metadata?.new_email === 'string' ? (p.user.user_metadata.new_email as string) : undefined
  const mail = renderAuthEmail(kind.type, locale, { siteUrl, email: p.user.email, newEmail, link, code: kind.type === 'reauthentication' ? p.email_data.token : undefined })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY ?? ''}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM ?? 'Favie <hello@favie.us>', to: [p.user.email], subject: mail.subject, html: mail.html, text: mail.text, tags: [{ name: 'category', value: `auth_${kind.type}` }] }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[auth email] resend failed', res.status, detail.slice(0, 300))
    return NextResponse.json({ error: { http_code: 500, message: `email provider ${res.status}` } }, { status: 500 })
  }
  return NextResponse.json({})
}

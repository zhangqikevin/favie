import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase/server'
import { publicOrigin } from '@/server/url'

/** Target of the Supabase confirmation email: verifies the token, sets the session cookie, continues onboarding. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = publicOrigin(req) // not url.origin: behind Replit's proxy that is localhost:3000
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') ?? '/onboarding'
  const redirectTo = new URL(next.startsWith('/') ? next : '/onboarding', origin)
  if (!tokenHash || !type) return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, origin))
  return NextResponse.redirect(redirectTo)
}

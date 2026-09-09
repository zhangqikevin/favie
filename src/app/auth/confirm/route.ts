import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase/server'

/** Target of the Supabase confirmation email: verifies the token, sets the session cookie, continues onboarding. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') ?? '/onboarding'
  const redirectTo = new URL(next.startsWith('/') ? next : '/onboarding', url.origin)
  if (!tokenHash || !type) return NextResponse.redirect(new URL('/login?error=invalid_link', url.origin))
  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
  return NextResponse.redirect(redirectTo)
}

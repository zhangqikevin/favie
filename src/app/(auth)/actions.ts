'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServer } from '@/lib/supabase/server'

const Credentials = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
})

export type AuthState = { error?: string } | undefined

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0]!.message }
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: (formData.get('name') as string | null) || undefined },
      emailRedirectTo: `${appUrl()}/auth/confirm?next=/onboarding`,
    },
  })
  if (error) return { error: error.message }
  // Supabase returns an obfuscated user with NO identities when the email already has an account
  // (anti-enumeration) and sends no email. Send them to log in instead of "check your email".
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    redirect(`/login?exists=1&email=${encodeURIComponent(parsed.data.email)}`)
  }
  // Email confirmation is ON: no session until the link is clicked.
  if (!data.session) redirect(`/signup/check-email?email=${encodeURIComponent(parsed.data.email)}`)
  redirect('/onboarding')
}

export async function resendConfirmation(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  if (!email) return
  const supabase = await createSupabaseServer()
  await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${appUrl()}/auth/confirm?next=/onboarding` } })
  redirect(`/signup/check-email?email=${encodeURIComponent(email)}&resent=1`)
}

export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0]!.message }
  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    console.warn('[auth] signInWithPassword failed:', error.status, error.code, error.message)
    if (/confirm/i.test(error.message)) return { error: 'Please confirm your email first — check your inbox for the link.' }
    return { error: process.env.NODE_ENV === 'production' ? 'Wrong email or password.' : `Wrong email or password. (${error.message})` }
  }
  const next = (formData.get('next') as string | null) || '/onboarding'
  redirect(next.startsWith('/') ? next : '/onboarding')
}

export async function logOut() {
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()
  redirect('/')
}

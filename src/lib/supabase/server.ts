import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client for auth. Uses the project's secret key (server only, never shipped
 * to the browser); the signed-in user's session still comes from cookies. Swap in the publishable
 * key here if/when a browser client is needed.
 */
export function supabaseKey() {
  const k = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY
  if (!k) throw new Error('No Supabase key configured (SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY)')
  return k
}
export function supabaseUrl() {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!u) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  return u
}

export async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component: cookies are read-only there. proxy.ts refreshes them.
        }
      },
    },
  })
}

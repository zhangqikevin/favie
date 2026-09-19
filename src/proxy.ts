import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseKey, supabaseUrl, AUTH_COOKIE_OPTIONS } from '@/lib/supabase/server'
import { LOCALE_COOKIE, detectLocale, isLocale } from '@/i18n/config'

// Refreshes the Supabase session cookie on every request and gates the app routes.
export async function proxy(request: NextRequest) {
  const t0 = Date.now()
  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
        },
      },
  })
  // getClaims verifies the access token locally against the project's public signing keys (cached in
  // process) and still refreshes an expiring session; only projects on the legacy shared secret fall
  // back to a network call. getUser() cost a ~150 ms round trip to the Auth server on EVERY request.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims?.sub ? { id: data.claims.sub } : null
  const authMs = Date.now() - t0
  // Slow-request breadcrumb for the deployment logs: the auth round trip is the only network hop here.
  if (authMs > 1500) console.warn(`[proxy] slow auth getUser ${authMs}ms ${request.method} ${request.nextUrl.pathname}`)
  response.headers.set('x-favie-auth-ms', String(authMs))
  // Cookies of a Supabase project this deployment no longer uses (the database moved regions) are dead weight —
  // 3 KB each on every request. Drop them.
  const ref = /https:\/\/([a-z0-9]+)\./.exec(supabaseUrl())?.[1]
  if (ref) for (const c of request.cookies.getAll()) {
    if (/^sb-[a-z0-9]{20}-auth-token/.test(c.name) && !c.name.startsWith(`sb-${ref}-`)) response.cookies.set(c.name, '', { path: '/', maxAge: 0 })
  }
  // Language: remember the browser's preference on first visit so server components can read one cookie.
  if (!isLocale(request.cookies.get(LOCALE_COOKIE)?.value)) {
    response.cookies.set(LOCALE_COOKIE, detectLocale(request.headers.get('accept-language')), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }
  const path = request.nextUrl.pathname
  const isApp = path.startsWith('/dashboard') || path.startsWith('/onboarding') || path.startsWith('/admin')
  if (isApp && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }
  if ((path === '/login' || path === '/signup') && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/agent|auth/confirm).*)'],
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseKey, supabaseUrl } from '@/lib/supabase/server'
import { LOCALE_COOKIE, detectLocale, isLocale } from '@/i18n/config'

// Refreshes the Supabase session cookie on every request and gates the app routes.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
        },
      },
  })
  const { data: { user } } = await supabase.auth.getUser()
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

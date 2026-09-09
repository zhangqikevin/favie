import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { DEFAULT_LOCALE, LOCALE_COOKIE, detectLocale, isLocale, type Locale } from './config'
import { dictionaryFor, makeT } from './index'

/** Cookie set by the language switcher or by proxy.ts from Accept-Language; header as a fallback. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(c)) return c
  const h = (await headers()).get('accept-language')
  return detectLocale(h) ?? DEFAULT_LOCALE
})

export const getT = cache(async () => {
  const locale = await getLocale()
  return { locale, t: makeT(dictionaryFor(locale)), dict: dictionaryFor(locale) }
})

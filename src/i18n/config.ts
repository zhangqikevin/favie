export const LOCALES = ['en', 'zh-CN', 'zh-TW', 'es', 'ja'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'favie_locale'

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  es: 'Español',
  ja: '日本語',
}

export function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v)
}

/** Pick the best supported locale from an Accept-Language header. */
export function detectLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const ranked = acceptLanguage
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { tag: (tag ?? '').toLowerCase(), q: q ? Number(q.split('=')[1]) : 1, i }
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q || a.i - b.i)
  for (const { tag } of ranked) {
    if (tag.startsWith('zh')) {
      // zh-TW / zh-HK / zh-Hant → Traditional; everything else Chinese → Simplified
      return /hant|tw|hk|mo/.test(tag) ? 'zh-TW' : 'zh-CN'
    }
    if (tag.startsWith('ja')) return 'ja'
    if (tag.startsWith('es')) return 'es'
    if (tag.startsWith('en')) return 'en'
  }
  return DEFAULT_LOCALE
}

/** Locale → Intl locale tag for dates/numbers. */
export const INTL_TAG: Record<Locale, string> = { en: 'en-US', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', es: 'es-US', ja: 'ja-JP' }

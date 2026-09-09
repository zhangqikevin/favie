import type { Locale } from './config'
import en, { type Dictionary } from './dictionaries/en'
import zhCN from './dictionaries/zh-CN'
import zhTW from './dictionaries/zh-TW'
import es from './dictionaries/es'
import ja from './dictionaries/ja'

export type { Dictionary }
export type DictKey = keyof Dictionary

const DICTS: Record<Locale, Dictionary> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, es, ja }

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTS[locale] ?? en
}

/** `t('key', { n: 3 })` — replaces `{n}` placeholders; falls back to English, then the key itself. */
export function makeT(dict: Dictionary) {
  return (key: DictKey, vars?: Record<string, string | number | null | undefined>): string => {
    let s: string = dict[key] ?? en[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v == null ? '' : String(v))
    return s
  }
}
export type T = ReturnType<typeof makeT>

'use client'
import { createContext, useContext, useMemo } from 'react'
import type { Locale } from './config'
import { makeT, type Dictionary, type T } from './index'

const Ctx = createContext<{ locale: Locale; dict: Dictionary } | null>(null)

/** Mounted once in the root layout with the server-chosen locale and its dictionary. */
export function LocaleProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLocale(): Locale {
  return useContext(Ctx)?.locale ?? 'en'
}

export function useT(): T {
  const ctx = useContext(Ctx)
  return useMemo(() => makeT(ctx?.dict ?? ({} as Dictionary)), [ctx?.dict])
}

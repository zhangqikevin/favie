'use client'
import { useActionState } from 'react'
import { savePreferences, type PrefsState } from '../actions'
import { useT } from '@/i18n/client'

const TIMEZONES = [
  ['America/New_York', 'Eastern (New York)'], ['America/Chicago', 'Central (Chicago)'], ['America/Denver', 'Mountain (Denver)'],
  ['America/Phoenix', 'Arizona (Phoenix)'], ['America/Los_Angeles', 'Pacific (Los Angeles)'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii'],
]

export function PreferencesForm({ defaults, connected }: {
  defaults: { timezone: string; capUber: number | null; capDoordash: number | null }
  connected: ('uber_eats' | 'doordash')[]
}) {
  const t = useT()
  const [state, action, pending] = useActionState<PrefsState, FormData>(savePreferences, undefined)
  const dollars = (c: number | null) => (c == null ? '' : String(c / 100))
  return (
    <form action={action} className="space-y-8">
      <section className="card p-7">
        <h2 className="font-display text-lg font-bold">{t('prefs.caps.title')}</h2>
        <p className="mt-1 text-sm text-ink-500">{t('prefs.caps.body')}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {([['capUber', 'Uber Eats', 'bg-uber', 'uber_eats', defaults.capUber], ['capDoordash', 'DoorDash', 'bg-doordash', 'doordash', defaults.capDoordash]] as const).map(([n, l, c, key, val]) => (
            <div key={n} className={connected.includes(key) ? '' : 'opacity-60'}>
              <label className="label flex items-center gap-2" htmlFor={n}><span className={`h-2 w-2 rounded-full ${c}`} />{l}{!connected.includes(key) && <span className="text-xs font-normal text-ink-500">{t('prefs.caps.notConnected')}</span>}</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-500">$</span>
                <input id={n} name={n} inputMode="decimal" defaultValue={dollars(val)} className="input !pl-8" placeholder="e.g. 900" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-7">
        <h2 className="font-display text-lg font-bold">{t('prefs.tz.title')}</h2>
        <p className="mt-1 text-sm text-ink-500">{t('prefs.tz.body')}</p>
        <select name="timezone" defaultValue={defaults.timezone} className="input mt-4 sm:max-w-xs">
          {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </section>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3.5 sm:w-auto sm:!px-8">
        {pending ? t('common.saving') : t('prefs.finish')}
      </button>
    </form>
  )
}

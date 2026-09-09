import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { decrypt, encrypt } from '@/lib/crypto'

export const SETTING_KEYS = {
  zooworkApiKey: 'zoowork_api_key',
  zooworkDefaultModel: 'zoowork_default_model',
} as const
type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

const TTL_MS = 60_000
let cache: { at: number; values: Map<SettingKey, { value: string; updatedAt: Date }> } | null = null

/** Load every setting (decrypting secrets) into the process cache. Cheap: the table has a handful of rows. */
export async function refreshSettings() {
  const rows = await db.select().from(schema.appSettings)
  const values = new Map<SettingKey, { value: string; updatedAt: Date }>()
  for (const r of rows) {
    let value = r.value
    if (r.isSecret) { try { value = decrypt(r.value) } catch { continue } }
    values.set(r.key as SettingKey, { value, updatedAt: r.updatedAt })
  }
  cache = { at: Date.now(), values }
  return cache
}

/** Synchronous read from the cache; kicks off a background refresh when stale. `undefined` until first load. */
export function settingSync(key: SettingKey): string | undefined {
  if (!cache || Date.now() - cache.at > TTL_MS) void refreshSettings().catch(() => {})
  return cache?.values.get(key)?.value
}

export async function getSetting(key: SettingKey) {
  if (!cache || Date.now() - cache.at > TTL_MS) await refreshSettings()
  return cache!.values.get(key) ?? null
}

export async function setSetting(key: SettingKey, value: string, opts: { secret?: boolean; userId?: string | null }) {
  const stored = opts.secret ? encrypt(value) : value
  await db.insert(schema.appSettings)
    .values({ key, value: stored, isSecret: !!opts.secret, updatedByUserId: opts.userId ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: stored, isSecret: !!opts.secret, updatedByUserId: opts.userId ?? null, updatedAt: new Date() } })
  await refreshSettings()
}

export async function deleteSetting(key: SettingKey) {
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, key))
  await refreshSettings()
}

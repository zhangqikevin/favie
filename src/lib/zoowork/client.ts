import { createZooworkClient, ZooworkError, type ZooworkClient } from '@zoowork-ai/sdk'
import { db, schema } from '@/lib/db/client'
import { SETTING_KEYS, settingSync, refreshSettings } from '@/server/settings'

let client: ZooworkClient | undefined
let clientKey: string | undefined
let cachedModel: string | undefined
let cachedModelFor: string | undefined

/** The key the sysadmin saved in /admin wins; ZOOWORK_API_KEY is the bootstrap fallback. */
export function currentZooworkKey() {
  return settingSync(SETTING_KEYS.zooworkApiKey) ?? process.env.ZOOWORK_API_KEY ?? undefined
}

/**
 * Client for the currently configured key. Rebuilt transparently when the key changes (settings cache
 * refreshes every 60s in every process; the admin action refreshes its own process immediately).
 * Never pass `?? ''` — an explicit empty apiKey bypasses the SDK's missing-key guard and 401s later.
 */
export function zoowork() {
  const key = currentZooworkKey()
  if (!client || clientKey !== key) {
    client = createZooworkClient(key ? { apiKey: key } : {})
    clientKey = key
  }
  return client
}

/** Load settings once at process start (worker, instrumentation) so the first call already uses the DB key. */
export async function prepareZoowork() {
  await refreshSettings().catch((e) => console.warn('[zoowork] settings load failed, using env', (e as Error).message))
}

/**
 * Model for new agents: the sysadmin's default (/admin) → ZOOWORK_MODEL → claude-sonnet-5 → first listed.
 * Validated against listModels() because a recalled id is a 400 at createAgent time.
 */
export async function resolveModel() {
  const preferred = settingSync(SETTING_KEYS.zooworkDefaultModel) ?? process.env.ZOOWORK_MODEL
  if (cachedModel && cachedModelFor === preferred) return cachedModel
  const models = await zoowork().listModels()
  const pick =
    (preferred && models.find((m) => m.model === preferred)?.model) ??
    models.find((m) => m.model.includes('claude-sonnet-5'))?.model ??
    models[0]?.model
  if (!pick) throw new Error('ZooWork returned no models for this key')
  cachedModel = pick; cachedModelFor = preferred
  return pick
}

/** Wraps a mutating SDK call and records request/response/error in zoowork_ops_log for reconciliation. */
export async function logged<T>(op: string, restaurantAgentId: string | null, request: unknown, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now()
  try {
    const response = await fn()
    await db.insert(schema.zooworkOpsLog).values({ restaurantAgentId, op, request: request as object, response: (response ?? null) as object, durationMs: Date.now() - t0 }).catch(() => {})
    return response
  } catch (e) {
    const err = e instanceof ZooworkError ? { status: e.status, type: e.type, message: e.message } : { message: (e as Error).message }
    await db.insert(schema.zooworkOpsLog).values({ restaurantAgentId, op, request: request as object, error: err, durationMs: Date.now() - t0 }).catch(() => {})
    throw e
  }
}

export { ZooworkError }

import { createZooworkClient, ZooworkError, type ZooworkClient } from '@zoowork-ai/sdk'
import { db, schema } from '@/lib/db/client'

let client: ZooworkClient | undefined
let cachedModel: string | undefined

/** Lets the SDK read ZOOWORK_API_KEY itself (an explicit `?? ''` would bypass its guard and 401 later). */
export function zoowork() {
  if (!client) client = createZooworkClient()
  return client
}

/** Model id resolved from listModels() once per process; recalled ids are a 400. */
export async function resolveModel() {
  if (cachedModel) return cachedModel
  const models = await zoowork().listModels()
  const preferred = process.env.ZOOWORK_MODEL
  const pick =
    (preferred && models.find((m) => m.model === preferred)?.model) ??
    models.find((m) => m.model.includes('claude-sonnet-5'))?.model ??
    models[0]?.model
  if (!pick) throw new Error('ZooWork returned no models for this key')
  cachedModel = pick
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

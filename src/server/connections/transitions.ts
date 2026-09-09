import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import type { FavieSummary } from '@/lib/zoowork/summary-schema'
import { enqueueReconcileSchedule } from '@/server/jobs/enqueue'

type PlatformReport = FavieSummary['platforms'][number]

/**
 * State machine:
 *   not_started → awaiting_login   (user clicks Connect; agent hands over the live browser)
 *   awaiting_login → verifying     (user clicks "I've logged in"; agent saves the profile and checks the store)
 *   verifying → connected          (store visible)   |   verifying → broken (not logged in / store not visible)
 *   connected → broken             (a daily run finds the saved login expired or the store gone)
 *   broken → awaiting_login        (user clicks Reconnect)
 */
export async function applyConnectionReport(restaurantId: string, p: PlatformReport, runId: string) {
  const [conn] = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, p.platform))).limit(1)
  if (!conn || conn.status === 'not_started' || conn.status === 'awaiting_login') return
  const now = new Date()

  // First login (no store chosen yet): the agent lists the stores it can see and the owner picks.
  if (!conn.storeExternalId && !conn.storeName && p.login === 'ok') {
    const stores = p.stores.map((st) => ({ name: st.name, external_id: st.external_id ?? null, address: st.address ?? null }))
    if (stores.length === 1) {
      await db.update(schema.platformConnections).set({
        status: 'connected', storeName: stores[0]!.name, storeExternalId: stores[0]!.external_id, storeAddress: stores[0]!.address, storeCandidates: stores,
        roleSeen: p.role_seen ?? null, verifiedAt: now, lastVerifiedAt: now, lastVerifyRunId: runId, lastError: null, brokenSince: null, updatedAt: now,
      }).where(eq(schema.platformConnections.id, conn.id))
      await adoptRestaurantName(restaurantId, stores[0]!)
      await enqueueReconcileSchedule(restaurantId).catch(() => {})
      return
    }
    if (stores.length > 1) {
      await db.update(schema.platformConnections).set({ status: 'select_store', storeCandidates: stores, roleSeen: p.role_seen ?? null, lastVerifyRunId: runId, lastError: null, updatedAt: now })
        .where(eq(schema.platformConnections.id, conn.id))
      return
    }
    await db.update(schema.platformConnections).set({ status: 'broken', lastError: 'Logged in, but no store was visible in this account.', brokenSince: now, lastVerifyRunId: runId, updatedAt: now })
      .where(eq(schema.platformConnections.id, conn.id))
    return
  }

  const ok = p.login === 'ok' && p.store_visible === true
  const failed = p.login === 'failed' || p.store_visible === false
  const error = p.login === 'failed'
    ? (p.login_failure_reason === 'not_logged_in' || p.login_failure_reason === 'session_expired'
        ? 'The saved login is no longer valid. Reconnect to log in again.'
        : `Login failed (${p.login_failure_reason ?? 'unknown'})`)
    : p.store_visible === false ? 'Logged in, but the store was not found in this account.' : null

  if (ok) {
    await db.update(schema.platformConnections).set({
      status: 'connected', storeName: p.store_name ?? conn.storeName, storeExternalId: p.store_external_id ?? conn.storeExternalId,
      roleSeen: p.role_seen ?? conn.roleSeen, verifiedAt: conn.verifiedAt ?? now, lastVerifiedAt: now, lastVerifyRunId: runId,
      lastError: null, brokenSince: null, updatedAt: now,
    }).where(eq(schema.platformConnections.id, conn.id))
    if (conn.status !== 'connected') await enqueueReconcileSchedule(restaurantId).catch(() => {})
    return
  }
  if (!failed) return
  await db.update(schema.platformConnections).set({
    status: 'broken', lastError: error, brokenSince: conn.brokenSince ?? now, lastVerifyRunId: runId,
    verifyAttempts: sql`${schema.platformConnections.verifyAttempts} + 1`, updatedAt: now,
  }).where(eq(schema.platformConnections.id, conn.id))
  if (conn.status === 'connected') await enqueueReconcileSchedule(restaurantId).catch(() => {})
}

/** The restaurant is named after the first store the owner connects (they never type it). */
export async function adoptRestaurantName(restaurantId: string, store: { name: string; address: string | null }) {
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!r) return
  const values: Partial<typeof schema.restaurants.$inferInsert> = { updatedAt: new Date() }
  if (r.name === 'My restaurant') values.name = store.name
  if (!r.addressLine && store.address) {
    values.addressLine = store.address
    const m = /,\s*([A-Za-z .'-]+),\s*([A-Z]{2})\s*(\d{5})?/.exec(store.address)
    if (m) { values.city = m[1]!.trim(); values.state = m[2]!; if (m[3]) values.zip = m[3] }
    const tz = TZ_BY_STATE[values.state ?? '']
    if (tz) values.timezone = tz
  }
  await db.update(schema.restaurants).set(values).where(eq(schema.restaurants.id, restaurantId))
}

const TZ_BY_STATE: Record<string, string> = {
  CA: 'America/Los_Angeles', WA: 'America/Los_Angeles', OR: 'America/Los_Angeles', NV: 'America/Los_Angeles',
  AZ: 'America/Phoenix', CO: 'America/Denver', UT: 'America/Denver', NM: 'America/Denver', ID: 'America/Denver', MT: 'America/Denver', WY: 'America/Denver',
  TX: 'America/Chicago', IL: 'America/Chicago', MN: 'America/Chicago', WI: 'America/Chicago', MO: 'America/Chicago', LA: 'America/Chicago', OK: 'America/Chicago', KS: 'America/Chicago', NE: 'America/Chicago', IA: 'America/Chicago', AR: 'America/Chicago', MS: 'America/Chicago', AL: 'America/Chicago', TN: 'America/Chicago', SD: 'America/Chicago', ND: 'America/Chicago',
  NY: 'America/New_York', NJ: 'America/New_York', PA: 'America/New_York', MA: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', NC: 'America/New_York', SC: 'America/New_York', VA: 'America/New_York', MD: 'America/New_York', DC: 'America/New_York', OH: 'America/New_York', MI: 'America/New_York', IN: 'America/New_York', KY: 'America/New_York', WV: 'America/New_York', CT: 'America/New_York', RI: 'America/New_York', NH: 'America/New_York', VT: 'America/New_York', ME: 'America/New_York', DE: 'America/New_York',
  HI: 'Pacific/Honolulu', AK: 'America/Anchorage',
}

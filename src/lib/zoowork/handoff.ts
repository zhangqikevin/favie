import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'
import { streamTurn } from './streamTurn'
import { toolCall, type SessionEvent } from '@zoowork-ai/sdk'
import { collectRun, localDate } from './collect'
import type { Platform } from '@/lib/db/schema'

export const PORTAL_URL: Record<Platform, string> = {
  doordash: 'https://www.doordash.com/merchant/login/',
  uber_eats: 'https://merchants.ubereats.com/manager/home',
}
const PLATFORM_NAME: Record<Platform, string> = { doordash: 'DoorDash Merchant Portal', uber_eats: 'Uber Eats Manager' }

/**
 * One login profile per restaurant, shared by every platform, so the owner's Uber Eats and DoorDash
 * logins persist together and a daily run restarts the browser once. Reuses whatever label already
 * holds a saved login (older rows had per-platform labels).
 */
export async function resolveLoginLabel(restaurantId: string): Promise<string> {
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (r?.browserLoginLabel) return r.browserLoginLabel
  const conns = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.restaurantId, restaurantId))
  const label = conns.find((c) => c.status === 'connected' && c.loginLabel)?.loginLabel ?? `favie-${restaurantId.slice(0, 8)}`
  await db.update(schema.restaurants).set({ browserLoginLabel: label, updatedAt: new Date() }).where(eq(schema.restaurants.id, restaurantId))
  return label
}

async function readyAgent(restaurantId: string) {
  const [agent] = await db.select().from(schema.restaurantAgents)
    .where(and(eq(schema.restaurantAgents.restaurantId, restaurantId), eq(schema.restaurantAgents.kind, 'delivery-ops'))).limit(1)
  if (!agent?.zooworkAgentId || agent.agentStatus !== 'ready') throw new Error(`agent not ready (${agent?.agentStatus ?? 'missing'})`) // pg-boss retries
  return { ...agent, zooworkAgentId: agent.zooworkAgentId }
}

/**
 * The handoff `liveUrl` is a ONE-TIME redeem link (`/browser/anything/r/<code>`): the first GET
 * redirects to the real VNC embed page (with an access token valid ~1 h) and the code then dies with
 * `{"detail":"redeem code expired or invalid"}`. Redeem it once server-side and keep the embed URL.
 */
export async function redeemLiveUrl(liveUrl: string): Promise<string> {
  try {
    const res = await fetch(liveUrl, { redirect: 'manual' })
    const loc = res.headers.get('location')
    if (loc) return new URL(loc, liveUrl).toString()
    // Some deployments may answer 200 with the page itself: then the URL is reusable as-is.
    if (res.ok) return liveUrl
    console.warn('[handoff] redeem answered', res.status, (await res.text()).slice(0, 200))
    return liveUrl
  } catch (e) {
    console.warn('[handoff] redeem failed', (e as Error).message)
    return liveUrl
  }
}

/**
 * Release the browser held by an earlier (abandoned) handoff session, otherwise the profile stays
 * "locked by another session" and every later `session restart` for this loginLabel is a 409.
 */
export async function releaseBrowser(zooworkAgentId: string, sessionId: string, restaurantAgentId: string | null) {
  const zc = zoowork()
  try {
    const prior = await zc.listAllEvents(zooworkAgentId, sessionId)
    const afterSeq = prior.reduce((m, e) => Math.max(m, e.seq), -1)
    await logged('postEvents.releaseBrowser', restaurantAgentId, { sessionId }, () =>
      zc.postEvents(zooworkAgentId, sessionId, [{ type: 'user.message', content: 'Release the browser now: call the browser tool with action "session" op "close". Do nothing else and reply with exactly: CLOSED', idempotency_key: `release-${sessionId}-${Date.now()}` }]))
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 90_000)
    try { await streamTurn(zc, zooworkAgentId, sessionId, { afterSeq, signal: ctl.signal }) } finally { clearTimeout(t) }
  } catch (e) {
    console.warn('[handoff] releaseBrowser failed', sessionId, (e as Error).message)
  }
}

/** Turns tool-call events into a short "what is happening" note the connect page shows while it waits. */
function progressNoter(restaurantId: string, platform: Platform) {
  let last = ''
  let pending: Promise<unknown> | null = null
  const label = (ev: SessionEvent): string | null => {
    const t = toolCall(ev)
    if (!t || t.phase !== 'start') return ev.eventType === 'run.started' ? 'Agent is starting…' : null
    const a = (t.args ?? {}) as Record<string, unknown>
    if (t.toolName === 'read') return 'Reading instructions…'
    if (t.toolName === 'browser') {
      if (a.action === 'session' && a.op === 'restart') return 'Opening a secure browser…'
      if (a.action === 'session' && a.op === 'save_login') return 'Saving your login…'
      if (a.action === 'session' && a.op === 'close') return 'Closing the browser…'
      if (a.action === 'navigate') return 'Loading the merchant portal…'
      if (a.action === 'handoff') return 'Preparing your secure link…'
      if (a.action === 'snapshot' || a.action === 'screenshot') return 'Reading the page…'
      if (a.action === 'act') return 'Looking through your stores…'
    }
    return null
  }
  const fn = (ev: SessionEvent) => {
    if (fn.stopped) return
    const n = label(ev)
    if (!n || n === last) return
    last = n
    pending = db.update(schema.platformConnections).set({ progressNote: n })
      .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform))).catch(() => {})
    void pending
  }
  fn.stopped = false
  return fn
}

/** Extract the live-view URL from the agent's reply (it echoes the handoff tool result). */
export function extractLiveUrl(text: string): string | null {
  const m = /"liveUrl"\s*:\s*"([^"]+)"/.exec(text) ?? /(https:\/\/[^\s"'<>]+\/browser\/[^\s"'<>]+)/.exec(text)
  return m ? m[1]!.replace(/\\\//g, '/') : null
}

/**
 * Step 1 of connecting a platform: the agent opens the portal login page in a fresh browser profile
 * (named by loginLabel) and hands the live browser to the user. The session is left OPEN so that
 * confirmLogin() can continue in the same browser.
 */
export async function startHandoff(restaurantId: string, platform: Platform) {
  const agent = await readyAgent(restaurantId)
  // One browser per agent: a `session restart` for a second platform would close the first one's
  // login window. Refuse while another platform is mid-connection.
  const others = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), inArray(schema.platformConnections.status, ['awaiting_login', 'verifying'])))
  const other = others.find((c) => c.platform !== platform)
  if (other) {
    await db.update(schema.platformConnections).set({ status: 'not_started', lastError: null, updatedAt: new Date() })
      .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform)))
    throw new Error(`another platform (${other.platform}) is mid-connection; finish it first`)
  }
  const [restaurant] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  const label = await resolveLoginLabel(restaurantId)
  const zc = zoowork()
  // A previous handoff that was never confirmed may still hold this profile open in another
  // browser session; close it first or the restart answers 409 "profile locked".
  const abandoned = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), inArray(schema.platformConnections.status, ['awaiting_login', 'broken'])))
  for (const c of abandoned) {
    if (c.handoffSessionId && !c.loginConfirmedAt && c.handoffStartedAt && Date.now() - c.handoffStartedAt.getTime() < 3 * 3600_000) {
      await db.update(schema.platformConnections).set({ progressNote: 'Closing a previous browser…' }).where(eq(schema.platformConnections.id, c.id))
      await releaseBrowser(agent.zooworkAgentId, c.handoffSessionId, agent.id)
    }
  }
  // Two turns in one session. The agent used to skip the navigate step and hand off a blank browser,
  // so step A (open the login page, prove it loaded) is checked before step B (handoff) is even asked.
  const stepA = [
    `FAVIE_HANDOFF ${platform} — STEP A only (do NOT call handoff yet).`,
    `1. browser action "session" op "restart" with loginLabel "${label}" and egressCountry "US".`,
    `2. browser action "navigate" to ${PORTAL_URL[platform]}`,
    '3. browser action "act" kind "wait" for 3 seconds, then browser action "snapshot" (mode "efficient").',
    `4. Reply with exactly one line: PAGE <current url> | <page title or first heading>. Type nothing into the page. Leave the browser open.`,
  ].join('\n')
  const session = await logged('createSession.handoff', agent.id, { platform }, () =>
    zc.createSession(agent.zooworkAgentId!, {
      initial_events: [{ type: 'user.message', content: stepA }],
      metadata: { kind: 'handoff', restaurant_id: restaurantId, platform },
    }, `handoff-${restaurantId}-${platform}-${Date.now()}`))
  const note = progressNoter(restaurantId, platform)
  const turn = async (afterSeq: number, budgetMs: number) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), budgetMs)
    try { return await streamTurn(zc, agent.zooworkAgentId, session.session_id, { signal: ctl.signal, onEvent: note, afterSeq }) } finally { clearTimeout(t) }
  }
  const post = async (content: string) => {
    const prior = await zc.listAllEvents(agent.zooworkAgentId, session.session_id)
    const afterSeq = prior.reduce((m, e) => Math.max(m, e.seq), -1)
    await zc.postEvents(agent.zooworkAgentId, session.session_id, [{ type: 'user.message', content, idempotency_key: `handoff-${session.session_id}-${Date.now()}` }])
    return afterSeq
  }
  const host = platform === 'doordash' ? 'doordash.com' : 'uber.com|ubereats.com'
  const onPortal = (text: string) => new RegExp(`(${host})`, 'i').test(text)
  let res
  try {
    res = await turn(-1, 2 * 60_000)
    if (!onPortal(res.text)) {
      // One retry: the first navigate sometimes lands on a blank tab or an interstitial.
      const afterSeq = await post(`The page is not the ${PLATFORM_NAME[platform]} login page yet. browser action "navigate" to ${PORTAL_URL[platform]} again, wait 3 seconds, snapshot, and reply with the same one-line PAGE report.`)
      res = await turn(afterSeq, 90_000)
    }
    const afterSeq = await post([
      `STEP B: browser action "handoff" with reason "Log in to ${PLATFORM_NAME[platform]}".`,
      'Reply with the handoff tool\'s JSON verbatim (it contains liveUrl) and nothing else. Leave the browser session open; your turn ends there.',
    ].join('\n'))
    res = await turn(afterSeq, 90_000)
  } finally { note.stopped = true }
  const liveUrl = extractLiveUrl(res.text)
  if (!liveUrl) {
    await db.update(schema.platformConnections).set({ status: 'broken', lastError: 'Could not open the login browser. Please try again.', updatedAt: new Date() })
      .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform)))
    throw new Error(`handoff produced no liveUrl (outcome ${res.outcome}); tail: ${res.text.slice(-300)}`)
  }
  const embedUrl = await redeemLiveUrl(liveUrl)
  await db.update(schema.platformConnections).set({
    status: 'awaiting_login', loginLabel: label, handoffSessionId: session.session_id, handoffUrl: embedUrl, handoffStartedAt: new Date(),
    lastError: null, progressNote: null, updatedAt: new Date(),
  }).where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform)))
  return liveUrl
}

/**
 * Step 2: the user says they are logged in. Continue in the SAME session: the agent snapshots the
 * page, checks it is inside the merchant portal, saves the login profile, identifies the store, and
 * closes the browser. The report goes through the normal collector → connected / broken.
 */
export const VERIFY_REPLY_FORMAT = 'Reply text only (never the `message` tool), ending with exactly this fenced block, filled in: ```favie-summary\n{"favie_summary_version":1,"mode":"verify","run_date":"YYYY-MM-DD","aborted_early":false,"platforms":[{"platform":"<uber_eats|doordash>","login":"ok","store_visible":true,"store_name":"<exact name>","store_external_id":null,"stores":[{"name":"<exact name>","external_id":null,"address":null}],"actions":[],"observations":[],"errors":[]}]}\n```'

export async function confirmLogin(restaurantId: string, platform: Platform) {
  const agent = await readyAgent(restaurantId)
  const [restaurant] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  const [conn] = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform))).limit(1)
  if (!conn?.handoffSessionId) throw new Error('no handoff session to confirm')
  const zc = zoowork()
  const sessionId = conn.handoffSessionId
  const message = [
    `FAVIE_CONFIRM_LOGIN ${platform}. The owner says they finished logging in to ${PLATFORM_NAME[platform]} in the handed-off browser. You already have the favie-ops skill in context; do not re-read it. Be fast:`,
    '1. snapshot. If a login form is still showing → report login "failed", login_failure_reason "not_logged_in", type nothing, close the session, summary.',
    '2. Otherwise call action "session" op "save_login" immediately.',
    '3. List the stores this account can see using ONLY the store/location switcher or business selector list (one snapshot of that list is enough). Record each store\'s exact name and its id if the list or URL shows one. Do NOT open each store, do NOT look up addresses (leave address null). Budget: at most 8 tool calls for this step.',
    '4. Close the browser session and end with the favie-summary block (mode "verify") with those stores in "stores".',
    `5. ${VERIFY_REPLY_FORMAT}`,
  ].join('\n')
  // Everything already in this session belongs to the handoff turn; only read what comes after it.
  const prior = await zc.listAllEvents(agent.zooworkAgentId, sessionId)
  const afterSeq = prior.reduce((m, e) => Math.max(m, e.seq), -1)
  await logged('postEvents.confirmLogin', agent.id, { sessionId }, () =>
    zc.postEvents(agent.zooworkAgentId!, sessionId, [{ type: 'user.message', content: message, idempotency_key: `confirm-${conn.id}-${Date.now()}` }]))

  const [run] = await db.insert(schema.agentRuns).values({
    restaurantId, restaurantAgentId: agent.id, zooworkAgentId: agent.zooworkAgentId, zooworkSessionId: sessionId,
    channel: 'api', kind: 'verify', status: 'running', runDate: localDate(new Date(), restaurant?.timezone ?? 'America/Los_Angeles'), startedAt: new Date(),
  }).onConflictDoUpdate({ target: schema.agentRuns.zooworkSessionId, set: { status: 'running', kind: 'verify', startedAt: new Date(), updatedAt: new Date() } }).returning()

  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6 * 60_000)
  let res
  const note = progressNoter(restaurantId, platform)
  try {
    res = await streamTurn(zc, agent.zooworkAgentId, sessionId, { afterSeq, signal: ctl.signal,
      onEvent: (ev) => { note(ev); if (ev.cursor) void db.update(schema.agentRuns).set({ lastCursor: ev.cursor }).where(eq(schema.agentRuns.id, run!.id)).catch(() => {}) } })
  } finally { clearTimeout(t); note.stopped = true }
  if (!res.outcome) {
    await db.update(schema.agentRuns).set({ status: 'timed_out', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    return
  }
  await db.update(schema.agentRuns).set({ status: 'finished', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
  const [fresh] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run!.id)).limit(1)
  await collectRun(fresh!, restaurant?.timezone ?? 'America/Los_Angeles')
  await db.update(schema.platformConnections).set({ loginConfirmedAt: new Date(), handoffUrl: null, progressNote: null, updatedAt: new Date() }).where(eq(schema.platformConnections.id, conn.id))
}

// ---------------------------------------------------------------------------------------------
// Ops: live browser on the restaurant's saved login for Favie's team (menu work, support).
// Same two-step handoff as onboarding, but nothing on platform_connections changes and the browser
// opens straight on the menu editor. One browser per agent still applies: while ops holds it, the
// restaurant's menu jobs and daily run wait.

/** Where the ops browser should land: the menu editor when we know it, else the portal home. */
async function opsTargetUrl(restaurantId: string, platform: Platform) {
  const [conn] = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform))).limit(1)
  if (platform === 'doordash') return conn?.menuEditorUrl ?? 'https://www.doordash.com/merchant/menu-editor/'
  const uuid = conn?.storeExternalId && /^[0-9a-f-]{36}$/i.test(conn.storeExternalId) ? conn.storeExternalId : null
  return uuid ? `https://merchants.ubereats.com/manager/menumaker/${uuid}` : 'https://merchants.ubereats.com/manager/menumaker'
}

export async function startOpsHandoff(opsId: string) {
  const [row] = await db.select().from(schema.opsHandoffs).where(eq(schema.opsHandoffs.id, opsId)).limit(1)
  if (!row || row.status !== 'queued') return
  const set = (patch: Partial<typeof schema.opsHandoffs.$inferInsert>) => db.update(schema.opsHandoffs).set({ ...patch, updatedAt: new Date() }).where(eq(schema.opsHandoffs.id, opsId))
  try {
    const agent = await readyAgent(row.restaurantId)
    const label = await resolveLoginLabel(row.restaurantId)
    const zc = zoowork()
    // Close any earlier ops browser for this restaurant (the profile is locked while it is open).
    const earlier = await db.select().from(schema.opsHandoffs)
      .where(and(eq(schema.opsHandoffs.restaurantId, row.restaurantId), eq(schema.opsHandoffs.status, 'ready')))
    for (const e of earlier) {
      if (e.sessionId) { await set({ note: 'Closing the previous browser…' }); await releaseBrowser(agent.zooworkAgentId, e.sessionId, agent.id) }
      await db.update(schema.opsHandoffs).set({ status: 'released', releasedAt: new Date(), updatedAt: new Date() }).where(eq(schema.opsHandoffs.id, e.id))
    }
    const target = row.targetUrl ?? await opsTargetUrl(row.restaurantId, row.platform)
    await set({ note: 'Opening the browser…', targetUrl: target })
    const stepA = [
      `FAVIE_HANDOFF ${row.platform} — STEP A only (do NOT call handoff yet).`,
      `1. browser action "session" op "restart" with loginLabel "${label}" and egressCountry "US".`,
      `2. browser action "navigate" to ${target}`,
      '3. browser action "act" kind "wait" for 4 seconds, then browser action "snapshot" (mode "efficient").',
      '4. Reply with exactly one line: PAGE <current url> | <page title or first heading>. Type nothing into the page. Leave the browser open.',
    ].join('\n')
    const session = await logged('createSession.opsHandoff', agent.id, { platform: row.platform, opsId }, () =>
      zc.createSession(agent.zooworkAgentId!, {
        initial_events: [{ type: 'user.message', content: stepA }],
        metadata: { kind: 'ops-handoff', restaurant_id: row.restaurantId, platform: row.platform },
      }, `ops-handoff-${opsId}`))
    await set({ sessionId: session.session_id })
    const turn = async (afterSeq: number, budgetMs: number) => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), budgetMs)
      try { return await streamTurn(zc, agent.zooworkAgentId, session.session_id, { signal: ctl.signal, afterSeq }) } finally { clearTimeout(t) }
    }
    const post = async (content: string) => {
      const prior = await zc.listAllEvents(agent.zooworkAgentId, session.session_id)
      const afterSeq = prior.reduce((m, e) => Math.max(m, e.seq), -1)
      await zc.postEvents(agent.zooworkAgentId, session.session_id, [{ type: 'user.message', content, idempotency_key: `ops-${session.session_id}-${Date.now()}` }])
      return afterSeq
    }
    let res = await turn(-1, 2 * 60_000)
    await set({ note: 'Preparing the live view…' })
    const afterSeq = await post([
      `STEP B: browser action "handoff" with reason "Favie ops: ${PLATFORM_NAME[row.platform]}".`,
      'Reply with the handoff tool\'s JSON verbatim (it contains liveUrl) and nothing else. Leave the browser session open; your turn ends there.',
    ].join('\n'))
    res = await turn(afterSeq, 90_000)
    const liveUrl = extractLiveUrl(res.text)
    if (!liveUrl) throw new Error(`handoff produced no liveUrl (outcome ${res.outcome}); tail: ${res.text.slice(-200)}`)
    const embedUrl = await redeemLiveUrl(liveUrl)
    await set({ status: 'ready', liveUrl: embedUrl, readyAt: new Date(), note: null, error: null })
  } catch (e) {
    await set({ status: 'failed', error: (e as Error).message.slice(0, 500), note: null })
  }
}

export async function releaseOpsHandoff(opsId: string) {
  const [row] = await db.select().from(schema.opsHandoffs).where(eq(schema.opsHandoffs.id, opsId)).limit(1)
  if (!row || row.status === 'released') return
  const [agent] = await db.select().from(schema.restaurantAgents)
    .where(and(eq(schema.restaurantAgents.restaurantId, row.restaurantId), eq(schema.restaurantAgents.kind, 'delivery-ops'))).limit(1)
  if (row.sessionId && agent?.zooworkAgentId) await releaseBrowser(agent.zooworkAgentId, row.sessionId, agent.id)
  await db.update(schema.opsHandoffs).set({ status: 'released', releasedAt: new Date(), updatedAt: new Date() }).where(eq(schema.opsHandoffs.id, opsId))
}

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'
import { streamTurn } from './streamTurn'
import { collectRun, localDate } from './collect'
import { releaseHandoffBrowsers } from './handoff'
import { billingOk } from '@/server/billing/gate'
import { enqueueDisputesCheck } from '@/server/jobs/enqueue'
import type { Platform } from '@/lib/db/schema'

/** Platforms whose dispute flow the skill implements today. DoorDash follows once its portal steps are specified. */
export const DISPUTE_PLATFORMS: Platform[] = ['uber_eats']
export const DISPUTE_CHECK_HOUR = 8       // local time the daily check runs
const DISPUTE_CHECK_LAST_HOUR = 20         // no first attempts / retries after this local hour
const MAX_ATTEMPTS_PER_DAY = 3
const RUN_BUDGET_MS = 30 * 60_000

export class InflightError extends Error {}

/** Literal reply contract — the model drifts into prose/YAML or the `message` tool without it (seen 2026-09-16). */
export const DISPUTES_REPLY_FORMAT = 'REPLY FORMAT (mandatory): write the report as your final reply text — never through the `message` or `sessions_yield` tools — and END it with exactly one fenced JSON block like this, filled in (JSON, not YAML; keys exactly as shown; one entry per order you looked at):\n```favie-summary\n{"favie_summary_version":1,"mode":"disputes","run_date":"YYYY-MM-DD","aborted_early":false,"platforms":[{"platform":"uber_eats","login":"ok","store_visible":true,"store_name":"<store name>","store_external_id":"<uuid or null>","stores":[],"disputes_found":1,"disputes":[{"order_id":"51D86","order_date":"2026-09-02","kind":"missing_item","amount_cents":1102,"recovered_cents":null,"status":"filed","reason":"<one sentence for the owner>","evidence":null,"deadline":null,"reason_category":"Customer made a mistake","submitted_text":"<exact text you submitted, or null>","customer_note":"<what the customer reported>","customer_photo":false,"items_total":3,"items_disputed":"1 customization missing","customer_type":"returning","filed_by":"favie","decision_text":null}],"actions":[],"observations":["History page URL: <the URL of the filtered order list, with its query string>"],"errors":[]}]}\n```'
const NUDGE = 'You stopped without the report. Reply NOW with the favie-summary fenced JSON block described in the task (mode "disputes", one entry per order you looked at) — as plain reply text, not via the message tool. If the browser is still open, close it first with one browser call.'

type CheckRow = typeof schema.disputeChecks.$inferInsert

async function upsertCheck(values: CheckRow) {
  const set = { ...values, updatedAt: new Date() }
  delete (set as { id?: string }).id
  await db.insert(schema.disputeChecks).values(values)
    .onConflictDoUpdate({ target: [schema.disputeChecks.restaurantId, schema.disputeChecks.platform, schema.disputeChecks.date], set })
}

/**
 * The daily disputes check for one restaurant × platform: the agent reviews the platform's charged
 * order issues from the last 30 days, records the decision on every appeal already filed, files a
 * dispute on every new charged issue, and reports it all in a favie-summary (mode "disputes").
 * One `dispute_checks` row per local day records what happened — including failures, which the
 * hourly tick retries.
 */
export type DisputesRunOpts = {
  /** `check` = read-only: list charged issues and record decisions, file nothing. `process` = file every new one. */
  mode?: 'check' | 'process'
  /** Owner/admin-triggered: recorded as an agent run only, never as the day's `dispute_checks` row. */
  manual?: boolean
}

export async function runDisputesCheck(restaurantId: string, platform: Platform, date?: string, opts: DisputesRunOpts = {}) {
  const mode = opts.mode ?? 'process'
  const manual = opts.manual ?? false
  const [restaurant] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!restaurant) throw new Error('restaurant not found')
  const today = date ?? localDate(new Date(), restaurant.timezone)
  const [existing] = manual ? [] : await db.select().from(schema.disputeChecks)
    .where(and(eq(schema.disputeChecks.restaurantId, restaurantId), eq(schema.disputeChecks.platform, platform), eq(schema.disputeChecks.date, today))).limit(1)
  if (existing?.status === 'done') return existing
  const attempts = (existing?.attempts ?? 0) + (existing ? 1 : 0)
  const base: CheckRow = { restaurantId, platform, date: today, attempts: Math.max(1, attempts) }
  // Manual runs leave the daily ledger alone; a precondition failure becomes a thrown error instead of a row.
  const record = manual ? async (v: CheckRow) => { if (v.status === 'skipped' || (v.status === 'failed' && v.error !== 'running' && !v.runId)) throw new Error(v.error ?? v.status) } : upsertCheck

  if (!restaurant.disputesEnabled && !manual) { await record({ ...base, status: 'skipped', error: 'disputes_disabled' }); return null }
  if (!DISPUTE_PLATFORMS.includes(platform)) { await record({ ...base, status: 'skipped', error: 'platform_not_supported' }); return null }
  const [conn] = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.platform, platform))).limit(1)
  if (!conn || conn.status !== 'connected') { await record({ ...base, status: 'skipped', error: 'not_connected' }); return null }
  const [agent] = await db.select().from(schema.restaurantAgents)
    .where(and(eq(schema.restaurantAgents.restaurantId, restaurantId), eq(schema.restaurantAgents.kind, 'delivery-ops'))).limit(1)
  if (!agent?.zooworkAgentId || agent.agentStatus !== 'ready') { await record({ ...base, status: 'failed', error: `agent not ready (${agent?.agentStatus ?? 'missing'})` }); return null }

  // A live onboarding handoff (the owner is logging in right now) or a verification owns the browser:
  // releasing it would kill the owner's login. Scheduled runs record a retryable failure; manual ones bail.
  const busy = await db.select({ platform: schema.platformConnections.platform, status: schema.platformConnections.status }).from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), inArray(schema.platformConnections.status, ['awaiting_login', 'verifying', 'select_store'])))
  if (busy.length) {
    if (manual) throw new InflightError('a platform connection is in progress')
    await upsertCheck({ ...base, status: 'failed', error: 'connection_in_progress' }); return null
  }
  // One browser per agent: if the daily run or a Menu Clinic job is using it, leave the row alone; the next tick retries.
  const inflight = await db.select({ id: schema.agentRuns.id }).from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.restaurantAgentId, agent.id), eq(schema.agentRuns.status, 'running'))).limit(1)
  if (inflight.length) throw new InflightError('another run is in flight for this agent')

  // What we already know, so the agent checks decisions instead of re-filing and skips what it settled before.
  const known = await db.select().from(schema.disputes)
    .where(and(eq(schema.disputes.restaurantId, restaurantId), eq(schema.disputes.platform, platform), sql`${schema.disputes.updatedAt} > now() - interval '60 days'`))
  const awaiting = known.filter((d) => d.status === 'filed')
  const settled = known.filter((d) => d.status !== 'filed' && d.status !== 'open')
  const money = (c: number | null) => (c == null ? '?' : `$${(c / 100).toFixed(2)}`)
  const list = (rows: typeof known) => rows.length ? rows.map((d) => `  - ${d.orderExternalId} (${d.orderDate ?? '?'}, ${money(d.amountCents)}, ${d.status}${d.filedBy === 'owner' ? ', filed by owner' : ''})`).join('\n') : '  (none)'

  const message = [
    `FAVIE_DISPUTES ${platform}. Use the favie-ops skill section "Disputes (FAVIE_DISPUTES)".`,
    `Today is ${today} (${restaurant.timezone}). Store: "${conn.storeName ?? restaurant.name}"${conn.storeExternalId ? ` (store id ${conn.storeExternalId})` : ''}. If the account has several stores, switch to this one first and work only on it.`,
    'Fetch the context URL from AGENTS.md, restore the saved login profile, then:',
    '1. Record the decision on every appeal below that is still awaiting a result (accepted → "won" with recovered_cents, rejected → "lost", still under review → "filed"):',
    list(awaiting),
    '2. Orders already settled — do not open them again unless they show a new decision:',
    list(settled),
    mode === 'process'
      ? '3. Every other charged order issue in the last 30 days: open it, dispute it (≤ 400 characters, English, assertive, one hard fact from the order itself), confirm the submission, and report it as "filed" with the exact submitted_text. Report a charged issue that was already disputed before you saw it as "filed" with filed_by "owner".'
      : '3. READ-ONLY RUN: do NOT click 争议 / Dispute and do NOT submit anything on any order. For every other charged order issue in the last 30 days open the detail page, read the archive fields (items, customer note, photo, amount, date) and report it as status "open" with `reason` = the argument you WOULD make (one sentence, owner\'s language). A charged issue that is already under dispute → "filed" with filed_by "owner".',
    'Change nothing else on the platform. Close the browser. End with the favie-summary block, mode "disputes", one entry per order you looked at in `disputes`, and `disputes_found` = the number of charged order issues visible in the 30-day list.',
    DISPUTES_REPLY_FORMAT,
  ].join('\n')

  const zc = zoowork()
  await releaseHandoffBrowsers(restaurantId, agent.zooworkAgentId, agent.id)
  const session = await logged('createSession.disputes', agent.id, { platform, date: today, attempts: base.attempts }, () =>
    zc.createSession(agent.zooworkAgentId!, {
      initial_events: [{ type: 'user.message', content: message }],
      metadata: { kind: 'disputes', restaurant_id: restaurantId, platform, date: today, mode, manual },
    }, `disputes-${restaurantId}-${platform}-${today}-${manual ? `m${Date.now()}` : base.attempts}`))
  const [run] = await db.insert(schema.agentRuns).values({
    restaurantId, restaurantAgentId: agent.id, zooworkAgentId: agent.zooworkAgentId, zooworkSessionId: session.session_id,
    sessionKey: session.session_key ?? null, channel: 'api', kind: 'disputes', status: 'running', runDate: today, startedAt: new Date(),
  }).returning()
  await record({ ...base, status: 'failed', error: 'running', runId: run!.id })

  const before = new Map(known.map((d) => [d.orderExternalId, d.status]))
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), RUN_BUDGET_MS)
  let res
  try {
    res = await streamTurn(zc, agent.zooworkAgentId, session.session_id, {
      signal: ctl.signal,
      onEvent: (ev) => { if (ev.cursor) void db.update(schema.agentRuns).set({ lastCursor: ev.cursor }).where(eq(schema.agentRuns.id, run!.id)).catch(() => {}) },
    })
    // The model sometimes ends the turn with the findings in prose or in a `message` tool call and no
    // fenced block. The session is still alive: ask for the block, up to twice, before giving up.
    for (let nudge = 0; res.outcome && !/```favie-summary/.test(res.text) && nudge < 2; nudge++) {
      const prior = await zc.listAllEvents(agent.zooworkAgentId, session.session_id)
      const afterSeq = prior.reduce((m, e) => Math.max(m, e.seq), -1)
      await zc.postEvents(agent.zooworkAgentId, session.session_id, [{ type: 'user.message', content: NUDGE, idempotency_key: `disputes-nudge-${run!.id}-${nudge}` }])
      const nctl = new AbortController(); const nt = setTimeout(() => nctl.abort(), 4 * 60_000)
      try {
        const more = await streamTurn(zc, agent.zooworkAgentId, session.session_id, { afterSeq, signal: nctl.signal })
        res = { ...more, text: `${res.text}\n${more.text}` }
      } finally { clearTimeout(nt) }
    }
  } catch (e) {
    await db.update(schema.agentRuns).set({ status: 'interrupted', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    await record({ ...base, status: 'failed', error: (e as Error).message.slice(0, 500), runId: run!.id })
    throw e
  } finally { clearTimeout(timer) }
  if (!res.outcome) {
    await zc.postEvents(agent.zooworkAgentId, session.session_id, [{ type: 'user.interrupt' }]).catch(() => {})
    await db.update(schema.agentRuns).set({ status: 'timed_out', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    await record({ ...base, status: 'failed', error: 'timed_out', runId: run!.id })
    return null
  }
  await db.update(schema.agentRuns).set({ status: 'finished', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
  const [fresh] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run!.id)).limit(1)
  await collectRun(fresh!, restaurant.timezone)
  const [done] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run!.id)).limit(1)
  if (done?.status !== 'collected') {
    await record({ ...base, status: 'failed', error: done?.status === 'parse_failed' ? 'The agent did not return a readable report.' : (done?.status ?? 'unknown'), runId: run!.id })
    return null
  }
  const summary = done.summaryJson as { platforms?: { platform: string; login?: string; login_failure_reason?: string | null; disputes_found?: number | null; disputes?: { status: string }[] }[]; aborted_early?: boolean; abort_reason?: string | null } | null
  const p = summary?.platforms?.find((x) => x.platform === platform)
  if (summary?.aborted_early || !p || p.login !== 'ok') {
    await record({ ...base, status: 'failed', error: summary?.abort_reason ?? p?.login_failure_reason ?? (p ? `login ${p.login}` : 'no report for this platform'), runId: run!.id })
    return null
  }
  // Compare the archive before and after: only state changes count, re-reports of the same state do not.
  const after = await db.select().from(schema.disputes).where(and(eq(schema.disputes.restaurantId, restaurantId), eq(schema.disputes.platform, platform), eq(schema.disputes.runId, run!.id)))
  let filed = 0, skipped = 0, won = 0, lost = 0, recovered = 0
  for (const d of after) {
    const prev = before.get(d.orderExternalId)
    if (d.status === 'filed' && prev !== 'filed' && d.filedBy !== 'owner') filed++
    else if (d.status === 'skipped' && prev !== 'skipped') skipped++
    else if (d.status === 'won' && prev !== 'won') { won++; recovered += d.recoveredCents ?? d.amountCents ?? 0 }
    else if (d.status === 'lost' && prev !== 'lost') lost++
  }
  const found = p.disputes_found ?? after.filter((d) => before.get(d.orderExternalId) !== 'filed').length
  const row: CheckRow = { ...base, status: 'done', found, filed, skipped, won, lost, recoveredCents: recovered, error: null, runId: run!.id }
  await record(row)
  return row
}

/**
 * Hourly: at 08:xx local (and hourly until 20:00 while a day's check is still failed) enqueue the
 * check for every restaurant that has disputes on, an active subscription, a connected platform
 * and a ready agent. Idempotent per restaurant × platform × day.
 */
export async function disputesTick(now = new Date()) {
  const rows = await db.select({
    id: schema.restaurants.id, timezone: schema.restaurants.timezone, agentStatus: schema.restaurantAgents.agentStatus, subStatus: schema.subscriptions.status,
  }).from(schema.restaurants)
    .innerJoin(schema.restaurantAgents, and(eq(schema.restaurantAgents.restaurantId, schema.restaurants.id), eq(schema.restaurantAgents.kind, 'delivery-ops')))
    .leftJoin(schema.subscriptions, eq(schema.subscriptions.restaurantId, schema.restaurants.id))
    .where(and(eq(schema.restaurants.disputesEnabled, true), eq(schema.restaurants.serviceDisabled, false), eq(schema.restaurantAgents.agentStatus, 'ready')))
  let queued = 0
  for (const r of rows) {
    if (!billingOk(r.subStatus)) continue
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: r.timezone, hour: 'numeric', hour12: false }).format(now)) % 24
    if (hour < DISPUTE_CHECK_HOUR || hour >= DISPUTE_CHECK_LAST_HOUR) continue
    const today = localDate(now, r.timezone)
    const allConns = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.restaurantId, r.id))
    // Someone is connecting a platform right now: the browser is theirs. Try again next hour.
    if (allConns.some((c) => ['awaiting_login', 'verifying', 'select_store'].includes(c.status))) continue
    const conns = allConns.filter((c) => c.status === 'connected' && DISPUTE_PLATFORMS.includes(c.platform))
    for (const c of conns) {
      const [chk] = await db.select().from(schema.disputeChecks)
        .where(and(eq(schema.disputeChecks.restaurantId, r.id), eq(schema.disputeChecks.platform, c.platform), eq(schema.disputeChecks.date, today))).limit(1)
      // The day's first attempt happens in the 08:00 hour only (a store connected at 4 pm waits for tomorrow); later hours only retry failures.
      if (!chk && hour !== DISPUTE_CHECK_HOUR) continue
      if (chk && (chk.status !== 'failed' || chk.attempts >= MAX_ATTEMPTS_PER_DAY)) continue
      if (chk?.error === 'running' && Date.now() - chk.updatedAt.getTime() < RUN_BUDGET_MS) continue
      await enqueueDisputesCheck(r.id, c.platform, today)
      queued++
    }
  }
  return queued
}

/** Dashboard numbers. Month boundaries are the restaurant's local month; "all time" is every won dispute. */
export async function disputeStats(restaurantId: string, timezone: string) {
  const ym = localDate(new Date(), timezone).slice(0, 7)
  // Compare timestamps in the restaurant's zone via SQL so 23:30 local on the last day of the month stays in that month.
  const tzDate = (col: typeof schema.disputes.filedAt | typeof schema.disputes.resolvedAt) => sql<string>`to_char(${col} at time zone ${timezone}, 'YYYY-MM')`
  const [row] = await db.select({
    foundMonth: sql<number>`count(*) filter (where to_char(${schema.disputes.createdAt} at time zone ${timezone}, 'YYYY-MM') = ${ym})`,
    filedMonth: sql<number>`count(*) filter (where ${schema.disputes.filedAt} is not null and ${tzDate(schema.disputes.filedAt)} = ${ym} and coalesce(${schema.disputes.filedBy}, 'favie') <> 'owner')`,
    wonMonthCents: sql<number>`coalesce(sum(coalesce(${schema.disputes.recoveredCents}, ${schema.disputes.amountCents}, 0)) filter (where ${schema.disputes.status} = 'won' and ${tzDate(schema.disputes.resolvedAt)} = ${ym}), 0)`,
    wonAllCents: sql<number>`coalesce(sum(coalesce(${schema.disputes.recoveredCents}, ${schema.disputes.amountCents}, 0)) filter (where ${schema.disputes.status} = 'won'), 0)`,
    awaiting: sql<number>`count(*) filter (where ${schema.disputes.status} = 'filed')`,
  }).from(schema.disputes).where(eq(schema.disputes.restaurantId, restaurantId))
  return {
    foundMonth: Number(row?.foundMonth ?? 0), filedMonth: Number(row?.filedMonth ?? 0),
    wonMonthCents: Number(row?.wonMonthCents ?? 0), wonAllCents: Number(row?.wonAllCents ?? 0), awaiting: Number(row?.awaiting ?? 0),
  }
}

import { and, eq, inArray, lt } from 'drizzle-orm'
import { assistantText, isRunFinished, runOutcome, toolCall, type SessionEvent } from '@zoowork-ai/sdk'
import { db, schema } from '@/lib/db/client'
import { dictionaryFor, makeT } from '@/i18n'
import { isLocale } from '@/i18n/config'
import { zoowork, logged } from './client'
import { DAILY_SCHEDULE_ID } from './schedule'
import { parseFavieSummary, type FavieSummary } from './summary-schema'
import { applyConnectionReport } from '@/server/connections/transitions'
import { enqueueVerifyConnection, enqueueConfirmLogin } from '@/server/jobs/enqueue'

const TERMINAL = new Set(['succeeded', 'failed', 'aborted', 'completed', 'error', 'cancelled', 'canceled'])

/** Restaurant-local calendar date for a timestamp. */
export function localDate(d: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/**
 * Discover cron sessions for every ready agent, then collect + parse the finished ones.
 * listScheduleRuns cannot map a fire to its session; the session_key prefix walk is the only path.
 */
export async function collectRuns() {
  const agents = await db.select({
    agent: schema.restaurantAgents, timezone: schema.restaurants.timezone,
  }).from(schema.restaurantAgents)
    .innerJoin(schema.restaurants, eq(schema.restaurants.id, schema.restaurantAgents.restaurantId))
    .where(eq(schema.restaurantAgents.agentStatus, 'ready'))

  for (const { agent, timezone } of agents) {
    if (!agent.zooworkAgentId) continue
    try {
      await discoverCronSessions(agent, timezone)
      await collectPending(agent, timezone)
    } catch (e) {
      console.error('[collect] agent', agent.id, (e as Error).message)
    }
  }
}

async function discoverCronSessions(agent: typeof schema.restaurantAgents.$inferSelect, timezone: string) {
  const zc = zoowork()
  const prefix = `agent:${agent.zooworkAgentId}:cron:${DAILY_SCHEDULE_ID}:`
  const sessions = await zc.listSessions(agent.zooworkAgentId!, { page: 1 })
  for (const s of sessions) {
    if (s.channel !== 'cron' || !(s.session_key ?? '').startsWith(prefix)) continue
    const isTerminal = !!s.run_status && TERMINAL.has(s.run_status)
    await db.insert(schema.agentRuns).values({
      restaurantId: agent.restaurantId, restaurantAgentId: agent.id, zooworkAgentId: agent.zooworkAgentId!,
      zooworkSessionId: s.session_id, sessionKey: s.session_key ?? null, channel: 'cron', kind: 'daily',
      status: isTerminal ? 'finished' : 'running', runStatusRaw: s.run_status ?? null,
      runDate: localDate(s.updated_at ? new Date(s.updated_at) : new Date(), timezone),
    }).onConflictDoUpdate({
      target: schema.agentRuns.zooworkSessionId,
      set: { runStatusRaw: s.run_status ?? null, updatedAt: new Date() },
    })
    if (isTerminal) {
      await db.update(schema.agentRuns).set({ status: 'finished' })
        .where(and(eq(schema.agentRuns.zooworkSessionId, s.session_id), inArray(schema.agentRuns.status, ['discovered', 'running'])))
    }
  }
}

async function collectPending(agent: typeof schema.restaurantAgents.$inferSelect, timezone: string) {
  const pending = await db.select().from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.restaurantAgentId, agent.id), eq(schema.agentRuns.status, 'finished')))
  for (const run of pending) await collectRun(run, timezone)
}


/** System-generated calendar entries are written in the owner's language (users.locale), like the agent's own text. */
async function ownerT(restaurantId: string) {
  const [row] = await db.select({ locale: schema.users.locale }).from(schema.restaurants)
    .innerJoin(schema.users, eq(schema.users.id, schema.restaurants.ownerUserId)).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  const loc = row?.locale
  return makeT(dictionaryFor(isLocale(loc) ? loc : 'en'))
}

/** Reads the whole event log of one finished session and turns it into agent_actions. */
export async function collectRun(run: typeof schema.agentRuns.$inferSelect, timezone: string) {
  const zc = zoowork()
  const events = await zc.listAllEvents(run.zooworkAgentId, run.zooworkSessionId) // never listEvents (500-row silent cap)
  const finished = [...events].reverse().find((e) => isRunFinished(e))
  const outcome = finished ? runOutcome(finished) : undefined
  const lastRunId = finished?.runId
  const inRun = (e: SessionEvent) => !lastRunId || e.runId === lastRunId
  let text = ''
  let toolErrors = 0
  let usage: unknown = null
  let startedAt: Date | undefined
  // Text the agent tried to deliver through `message` / `sessions_yield` instead of replying. In cron
  // sessions there is no recipient, so the report would otherwise be lost; we read it from the tool args.
  const misdelivered: string[] = []
  for (const e of events) {
    if (!inRun(e)) continue
    if (e.eventType === 'run.started' && e.createdAt) startedAt = new Date(e.createdAt)
    text += assistantText(e)
    const call = toolCall(e)
    if (call?.phase === 'end' && call.isError) toolErrors += 1
    if (e.eventType === 'agent.tool') {
      const p = e.payload as { toolName?: string; args?: { message?: unknown } }
      if ((p.toolName === 'message' || p.toolName === 'sessions_yield') && typeof p.args?.message === 'string') misdelivered.push(p.args.message)
    }
    if (e.eventType === 'agent.assistant') {
      const u = (e.payload as { message?: { usage?: unknown } })?.message?.usage
      if (u) usage = u
    }
  }
  let parsed = parseFavieSummary(text)
  if ('error' in parsed && misdelivered.length) {
    const alt = misdelivered.join('\n\n')
    const altParsed = parseFavieSummary(alt)
    if (!('error' in altParsed)) { parsed = altParsed; text = text ? `${text}\n\n${alt}` : alt }
    else if (!text.trim()) text = alt // at least keep the agent's words for the run report
  }
  const runDate = run.runDate ?? localDate(finished?.createdAt ? new Date(finished.createdAt) : new Date(), timezone)
  const t = await ownerT(run.restaurantId)
  const base = {
    outcome: (outcome ?? null) as 'succeeded' | 'failed' | 'aborted' | null,
    finalText: text.slice(-20_000), toolErrorCount: toolErrors, eventCount: events.length,
    tokenUsage: usage as object | null, startedAt: startedAt ?? null,
    finishedAt: finished?.createdAt ? new Date(finished.createdAt) : new Date(), collectedAt: new Date(), runDate, updatedAt: new Date(),
  }

  if (outcome === 'aborted') {
    await db.update(schema.agentRuns).set({ ...base, status: 'interrupted' }).where(eq(schema.agentRuns.id, run.id))
    await insertAction(run, runDate, 'none', 'interrupted', t('sys.interrupted.t'), t('sys.interrupted.r'), true, { sysKey: 'interrupted', sysVars: {} })
    return
  }
  if ('error' in parsed) {
    // A daily run that succeeded but ended with no report (the model sometimes closes the browser and stops
    // with zero output — Jun Bistro 2026-09-17): ask once, in the same session, for the block. The session
    // goes back to `running`; the next collect pass reads the nudge turn's text.
    if (run.kind === 'daily' && outcome === 'succeeded' && !run.summaryParseError?.startsWith('nudged')) {
      try {
        await logged('postEvents.nudgeSummary', run.restaurantAgentId, { sessionId: run.zooworkSessionId }, () =>
          zc.postEvents(run.zooworkAgentId, run.zooworkSessionId, [{ type: 'user.message', idempotency_key: `nudge-${run.id}`, content:
            'Your run ended without the favie-summary block, so Favie could not record anything you did. Reply NOW with the report for the run you just completed: your findings in text, ending with exactly one ```favie-summary``` fenced JSON block (mode "daily", one platform entry per platform you worked on, every change as an action with a reason, `disputes` empty). Reply as plain text — never via the message tool — and do not open the browser again.' }]))
        await db.update(schema.agentRuns).set({ ...base, status: 'running', summaryParseError: `nudged: ${parsed.error}` }).where(eq(schema.agentRuns.id, run.id))
        return
      } catch (e) {
        console.warn('[collect] nudge failed', run.id, (e as Error).message)
      }
    }
    await db.update(schema.agentRuns).set({ ...base, status: 'parse_failed', summaryParseError: parsed.error }).where(eq(schema.agentRuns.id, run.id))
    await insertAction(run, runDate, 'none', 'run_unparsed', t('sys.run_unparsed.t'), t('sys.run_unparsed.r', { error: parsed.error }), true, { sysKey: 'run_unparsed', sysVars: { error: parsed.error } })
    if (run.kind === 'verify') await recoverUnparsedVerify(run.restaurantId)
    return
  }
  await db.update(schema.agentRuns).set({ ...base, status: 'collected', summaryJson: parsed.summary as object, summaryParseError: null, runDate }).where(eq(schema.agentRuns.id, run.id))
  await materializeSummary(run, parsed.summary)
}

/**
 * A verify / confirm-login turn whose report could not be parsed (observed 2026-09-12: a weak routed
 * model wrote the summary as markdown through the `message` tool) must not leave the connection on
 * "verifying" forever. The login itself is usually saved by then, so re-check once with the saved
 * profile (no owner action needed); after that, mark it broken so the owner sees a retry button.
 */
async function recoverUnparsedVerify(restaurantId: string) {
  const conns = await db.select().from(schema.platformConnections)
    .where(and(eq(schema.platformConnections.restaurantId, restaurantId), eq(schema.platformConnections.status, 'verifying')))
  for (const c of conns) {
    if ((c.verifyAttempts ?? 0) < 2) {
      await db.update(schema.platformConnections).set({ verifyAttempts: (c.verifyAttempts ?? 0) + 1, progressNote: null, updatedAt: new Date() }).where(eq(schema.platformConnections.id, c.id))
      // Confirm-login flow (handoff session still open with the owner's login): retry in that session.
      // A fresh verify session would restart the browser and hit "profile locked".
      const retry = c.handoffSessionId && c.handoffStartedAt && Date.now() - c.handoffStartedAt.getTime() < 3 * 3600_000
        ? enqueueConfirmLogin(restaurantId, c.platform) : enqueueVerifyConnection(restaurantId, c.platform)
      await retry.catch((e) => console.error('[collect] re-verify enqueue failed', e))
    } else {
      await db.update(schema.platformConnections)
        .set({ status: 'broken', verifyAttempts: 0, lastError: 'Favie could not read the result of the check. Please connect again.', brokenSince: new Date(), progressNote: null, updatedAt: new Date() })
        .where(eq(schema.platformConnections.id, c.id))
    }
  }
}

async function insertAction(run: typeof schema.agentRuns.$inferSelect, actionDate: string, platform: 'uber_eats' | 'doordash' | 'none',
  category: (typeof schema.actionCategoryEnum.enumValues)[number], title: string, reason: string, needsAttention: boolean,
  extra: Partial<typeof schema.agentActions.$inferInsert> = {}) {
  await db.insert(schema.agentActions).values({
    runId: run.id, restaurantId: run.restaurantId, restaurantAgentId: run.restaurantAgentId, platform, actionDate, category, title, reason, needsAttention,
    // Stamp the moment the run ended, not the moment we happened to collect it.
    occurredAt: run.finishedAt ?? run.startedAt ?? new Date(),
    // Purely technical outcomes are for sysadmins; owners only see what happened on their platforms.
    internal: category === 'run_unparsed' || category === 'interrupted',
    ...extra,
  })
}

export async function materializeSummary(run: typeof schema.agentRuns.$inferSelect, s: FavieSummary) {
  const t = await ownerT(run.restaurantId)
  // The agent's sandbox clock is UTC, so its run_date can be a day ahead of the restaurant. Trust ours.
  const date = run.runDate ?? s.run_date
  if (s.aborted_early) {
    await insertAction(run, date, 'none', 'no_action', t('sys.aborted.t'), t('sys.aborted.r', { reason: s.abort_reason ?? 'unspecified' }), false, { internal: true, sysKey: 'aborted', sysVars: { reason: s.abort_reason ?? 'unspecified' } })
    // A verify/confirm turn that never got going must not leave the connection spinning.
    if (run.kind === 'verify') {
      await db.update(schema.platformConnections)
        .set({ status: 'broken', lastError: `Favie could not complete the check (${s.abort_reason ?? 'aborted'}). Please try again.`, updatedAt: new Date() })
        .where(and(eq(schema.platformConnections.restaurantId, run.restaurantId), inArray(schema.platformConnections.status, ['verifying'])))
    }
    return
  }
  for (const p of s.platforms) {
    if (p.login === 'skipped') continue
    if (p.login === 'failed') {
      await insertAction(run, date, p.platform, 'login_failed', t('sys.login_failed.t'), t('sys.login_failed.r', { reason: p.login_failure_reason ?? 'unknown' }), true, { sysKey: 'login_failed', sysVars: { reason: p.login_failure_reason ?? 'unknown' } })
    } else if (p.store_visible === false && p.stores.length === 0) {
      await insertAction(run, date, p.platform, 'store_not_visible', t('sys.store_not_visible.t'), t('sys.store_not_visible.r', { store: p.store_name ?? '?' }), true, { sysKey: 'store_not_visible', sysVars: { store: p.store_name ?? '?' } })
    }
    for (const a of p.actions) {
      await insertAction(run, date, p.platform, a.category, a.title, a.reason, a.needs_attention, {
        before: (a.before ?? null) as object | null, after: (a.after ?? null) as object | null, amountCents: a.amount_cents ?? null,
      })
    }
    if (p.login === 'ok' && p.store_visible !== false && p.actions.length === 0) {
      await insertAction(run, date, p.platform, 'no_action', t('sys.no_action.t'), t('sys.no_action.r'), false, { sysKey: 'no_action', sysVars: {} })
    }
    await materializeDisputes(run, date, p)
    // Connection health + MTD ad spend (platform_ui source) fall out of the same report.
    await applyConnectionReport(run.restaurantId, p, run.id)
    if (p.ad_spend_mtd_cents != null || p.promo_spend_mtd_cents != null) {
      // Month-to-date snapshot as the portal reports it; the ctx endpoint reads the latest one for the budget guard.
      const values = {
        restaurantId: run.restaurantId, platform: p.platform, date, adSpendCents: p.ad_spend_mtd_cents ?? null, promoSpendCents: p.promo_spend_mtd_cents ?? null,
        source: 'platform_ui' as const, isMature: false, raw: { kind: 'mtd_from_portal', run_id: run.id, new_customer_share: p.new_customer_share ?? null }, fetchedAt: new Date(), updatedAt: new Date(),
      }
      await db.insert(schema.dailyMetrics).values(values)
        .onConflictDoUpdate({ target: [schema.dailyMetrics.restaurantId, schema.dailyMetrics.platform, schema.dailyMetrics.date], set: values })
        .catch(() => {}) // a Zoodata row for the same day wins; the unique index covers (restaurant, platform, date) regardless of source
    }
  }
}

/**
 * Disputes the agent reported: upsert one row per order and turn state changes into calendar actions
 * (`dispute_filed` when it appealed, `dispute_resolved` when the platform answered). `amount_cents` on
 * the resolved action is the money recovered, which the dashboard sums per month.
 */
async function materializeDisputes(run: typeof schema.agentRuns.$inferSelect, date: string, p: FavieSummary['platforms'][number]) {
  if (!p.disputes.length) return
  const t = await ownerT(run.restaurantId)
  const existing = await db.select().from(schema.disputes)
    .where(and(eq(schema.disputes.restaurantId, run.restaurantId), eq(schema.disputes.platform, p.platform), inArray(schema.disputes.orderExternalId, p.disputes.map((d) => d.order_id))))
  const money = (c: number | null | undefined) => c == null ? '' : `$${(c / 100).toFixed(2)}`
  for (let d of p.disputes) {
    const prev = existing.find((e) => e.orderExternalId === d.order_id)
    const now = new Date()
    // A read-only pass (or a confused re-report) must never undo a filed appeal or a decision.
    if (prev && ['filed', 'won', 'lost'].includes(prev.status) && (d.status === 'open' || d.status === 'skipped')) d = { ...d, status: prev.status as typeof d.status }
    const values = {
      restaurantId: run.restaurantId, platform: p.platform, orderExternalId: d.order_id, orderDate: d.order_date ?? prev?.orderDate ?? null,
      kind: d.kind, amountCents: d.amount_cents ?? prev?.amountCents ?? null, recoveredCents: d.recovered_cents ?? prev?.recoveredCents ?? null,
      status: d.status, reason: d.reason ?? prev?.reason ?? null, evidence: d.evidence ?? prev?.evidence ?? null, deadline: d.deadline ?? prev?.deadline ?? null,
      reasonCategory: d.reason_category ?? prev?.reasonCategory ?? null, submittedText: d.submitted_text ?? prev?.submittedText ?? null,
      customerNote: d.customer_note ?? prev?.customerNote ?? null, customerPhoto: d.customer_photo ?? prev?.customerPhoto ?? null,
      itemsTotal: d.items_total ?? prev?.itemsTotal ?? null, itemsDisputed: d.items_disputed ?? prev?.itemsDisputed ?? null,
      customerType: d.customer_type ?? prev?.customerType ?? null, decisionText: d.decision_text ?? prev?.decisionText ?? null,
      filedBy: d.filed_by ?? prev?.filedBy ?? (d.status === 'filed' && prev?.status !== 'filed' ? 'favie' : null),
      filedAt: d.status === 'filed' && prev?.status !== 'filed' ? now : prev?.filedAt ?? null,
      resolvedAt: (d.status === 'won' || d.status === 'lost') && prev?.status !== d.status ? now : prev?.resolvedAt ?? null,
      runId: run.id, raw: d as object, updatedAt: now,
    }
    await db.insert(schema.disputes).values(values)
      .onConflictDoUpdate({ target: [schema.disputes.restaurantId, schema.disputes.platform, schema.disputes.orderExternalId], set: values })
    // Calendar entries only on state changes, never on re-reports of the same state.
    if (d.status === 'filed' && prev?.status !== 'filed' && d.filed_by !== 'owner') {
      await insertAction(run, date, p.platform, 'dispute_filed', t('sys.dispute_filed.t', { order: d.order_id, amount: money(d.amount_cents) }), d.reason ?? t('sys.dispute_filed.r'), false,
        { amountCents: d.amount_cents ?? null, after: { order_id: d.order_id, kind: d.kind, deadline: d.deadline ?? null } })
    } else if ((d.status === 'won' || d.status === 'lost') && prev?.status !== d.status) {
      const won = d.status === 'won'
      await insertAction(run, date, p.platform, 'dispute_resolved', t(won ? 'sys.dispute_won.t' : 'sys.dispute_lost.t', { order: d.order_id, amount: money(won ? (d.recovered_cents ?? d.amount_cents) : d.amount_cents) }),
        d.reason ?? t(won ? 'sys.dispute_won.r' : 'sys.dispute_lost.r'), false, { amountCents: won ? (d.recovered_cents ?? d.amount_cents ?? null) : 0, after: { order_id: d.order_id, status: d.status } })
    }
  }
}

/** Runs stuck `running` for more than 3h get a user.interrupt and are marked timed_out. */
export async function staleRuns() {
  const cutoff = new Date(Date.now() - 3 * 3600_000)
  const stuck = await db.select().from(schema.agentRuns)
    .where(and(inArray(schema.agentRuns.status, ['discovered', 'running']), lt(schema.agentRuns.createdAt, cutoff)))
  for (const run of stuck) {
    try {
      await logged('postEvents.interrupt', run.restaurantAgentId, { sessionId: run.zooworkSessionId }, () =>
        zoowork().postEvents(run.zooworkAgentId, run.zooworkSessionId, [{ type: 'user.interrupt', idempotency_key: `stale-${run.id}` }]))
    } catch (e) {
      console.warn('[staleRuns] interrupt failed', run.id, (e as Error).message)
    }
    await db.update(schema.agentRuns).set({ status: 'timed_out', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run.id))
  }
}

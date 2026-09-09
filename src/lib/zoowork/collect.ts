import { and, eq, inArray, lt } from 'drizzle-orm'
import { assistantText, isRunFinished, runOutcome, toolCall, type SessionEvent } from '@zoowork-ai/sdk'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'
import { DAILY_SCHEDULE_ID } from './schedule'
import { parseFavieSummary, type FavieSummary } from './summary-schema'
import { applyConnectionReport } from '@/server/connections/transitions'

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
  const base = {
    outcome: (outcome ?? null) as 'succeeded' | 'failed' | 'aborted' | null,
    finalText: text.slice(-20_000), toolErrorCount: toolErrors, eventCount: events.length,
    tokenUsage: usage as object | null, startedAt: startedAt ?? null,
    finishedAt: finished?.createdAt ? new Date(finished.createdAt) : new Date(), collectedAt: new Date(), runDate, updatedAt: new Date(),
  }

  if (outcome === 'aborted') {
    await db.update(schema.agentRuns).set({ ...base, status: 'interrupted' }).where(eq(schema.agentRuns.id, run.id))
    await insertAction(run, runDate, 'none', 'interrupted', 'Run was interrupted', 'The run was stopped before it finished. Actions taken before the interruption may already be live on the platform.', true)
    return
  }
  if ('error' in parsed) {
    await db.update(schema.agentRuns).set({ ...base, status: 'parse_failed', summaryParseError: parsed.error }).where(eq(schema.agentRuns.id, run.id))
    await insertAction(run, runDate, 'none', 'run_unparsed', 'Run finished but its report could not be read',
      `Favie could not parse the agent's summary (${parsed.error}). Open the transcript to see what happened.`, true)
    return
  }
  await db.update(schema.agentRuns).set({ ...base, status: 'collected', summaryJson: parsed.summary as object, summaryParseError: null, runDate }).where(eq(schema.agentRuns.id, run.id))
  await materializeSummary(run, parsed.summary)
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
  // The agent's sandbox clock is UTC, so its run_date can be a day ahead of the restaurant. Trust ours.
  const date = run.runDate ?? s.run_date
  if (s.aborted_early) {
    await insertAction(run, date, 'none', 'no_action', 'Run ended early', `Reason: ${s.abort_reason ?? 'unspecified'}.`, false, { internal: true })
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
      await insertAction(run, date, p.platform, 'login_failed', 'Could not log in', `Login failed: ${p.login_failure_reason ?? 'unknown reason'}. Favie will retry on the next run; if it keeps failing, check that Favie's Manager access is still active.`, true)
    } else if (p.store_visible === false && p.stores.length === 0) {
      await insertAction(run, date, p.platform, 'store_not_visible', 'Store not visible in the account', `Favie logged in but could not find "${p.store_name ?? 'your store'}" in the account. The Manager invitation may target a different store or may have been revoked.`, true)
    }
    for (const a of p.actions) {
      await insertAction(run, date, p.platform, a.category, a.title, a.reason, a.needs_attention, {
        before: (a.before ?? null) as object | null, after: (a.after ?? null) as object | null, amountCents: a.amount_cents ?? null,
      })
    }
    if (p.login === 'ok' && p.store_visible !== false && p.actions.length === 0) {
      await insertAction(run, date, p.platform, 'no_action', 'Checked — nothing to change', 'Store online, budgets on target, no new issues.', false)
    }
    // Connection health + MTD ad spend (platform_ui source) fall out of the same report.
    await applyConnectionReport(run.restaurantId, p, run.id)
    if (p.ad_spend_mtd_cents != null) {
      await db.insert(schema.dailyMetrics).values({
        restaurantId: run.restaurantId, platform: p.platform, date, adSpendCents: p.ad_spend_mtd_cents, source: 'platform_ui', isMature: false,
        raw: { kind: 'mtd_from_portal', run_id: run.id },
      }).onConflictDoNothing()
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

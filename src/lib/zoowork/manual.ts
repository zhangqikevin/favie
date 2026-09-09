import { eq } from 'drizzle-orm'
import { toolCall, type SessionEvent } from '@zoowork-ai/sdk'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'
import { streamTurn } from './streamTurn'
import { collectRun, localDate } from './collect'

/**
 * Run a prompt on a restaurant's agent right now and record it as a `manual` run. Used by the admin
 * page ("Run now") and by scripts/run-prompt.ts. Returns the run id and the agent's final text.
 */
export async function runManualPrompt(restaurantId: string, prompt: string, opts: { onEvent?: (ev: SessionEvent) => void; budgetMs?: number } = {}) {
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!r) throw new Error('restaurant not found')
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.restaurantId, restaurantId)).limit(1)
  if (!agent?.zooworkAgentId || agent.agentStatus !== 'ready') throw new Error(`agent not ready (${agent?.agentStatus ?? 'missing'})`)
  const zc = zoowork()
  const session = await logged('createSession.manual', agent.id, { chars: prompt.length }, () =>
    zc.createSession(agent.zooworkAgentId!, {
      initial_events: [{ type: 'user.message', content: prompt }],
      metadata: { kind: 'manual', restaurant_id: restaurantId },
    }))
  const [run] = await db.insert(schema.agentRuns).values({
    restaurantId, restaurantAgentId: agent.id, zooworkAgentId: agent.zooworkAgentId, zooworkSessionId: session.session_id,
    channel: 'api', kind: 'manual', status: 'running', runDate: localDate(new Date(), r.timezone), startedAt: new Date(),
  }).returning()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), opts.budgetMs ?? 20 * 60_000)
  let res
  try {
    res = await streamTurn(zc, agent.zooworkAgentId, session.session_id, {
      signal: ctl.signal,
      onEvent: (ev) => {
        opts.onEvent?.(ev)
        const t = toolCall(ev)
        if (t?.phase === 'start') void db.update(schema.agentRuns).set({ finalText: `[running] ${t.toolName} ${JSON.stringify(t.args ?? {}).slice(0, 120)}` }).where(eq(schema.agentRuns.id, run!.id)).catch(() => {})
        if (ev.cursor) void db.update(schema.agentRuns).set({ lastCursor: ev.cursor }).where(eq(schema.agentRuns.id, run!.id)).catch(() => {})
      },
    })
  } finally { clearTimeout(timer) }
  if (!res.outcome) {
    await zc.postEvents(agent.zooworkAgentId, session.session_id, [{ type: 'user.interrupt' }]).catch(() => {})
    await db.update(schema.agentRuns).set({ status: 'timed_out', finalText: res.text.slice(-20_000), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    return { runId: run!.id, outcome: undefined, text: res.text }
  }
  await db.update(schema.agentRuns).set({ status: 'finished', updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
  const [fresh] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run!.id)).limit(1)
  await collectRun(fresh!, r.timezone) // parses a favie-summary block if present; otherwise marks parse_failed with the text kept
  return { runId: run!.id, outcome: res.outcome, text: res.text }
}

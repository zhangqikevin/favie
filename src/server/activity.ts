import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'

export type ActionRow = typeof schema.agentActions.$inferSelect

export function monthBounds(ym: string) {
  const [y, m] = ym.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}`, year: y, month: m, days: last }
}

export function currentMonth(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).format(new Date())
}

export function todayLocal(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export async function getActionsForMonth(restaurantId: string, ym: string) {
  const { start, end } = monthBounds(ym)
  return db.select().from(schema.agentActions)
    .where(and(eq(schema.agentActions.restaurantId, restaurantId), gte(schema.agentActions.actionDate, start), lte(schema.agentActions.actionDate, end)))
    .orderBy(desc(schema.agentActions.occurredAt))
}

export async function getRunsForMonth(restaurantId: string, ym: string) {
  const { start, end } = monthBounds(ym)
  return db.select({ id: schema.agentRuns.id, runDate: schema.agentRuns.runDate, status: schema.agentRuns.status, kind: schema.agentRuns.kind, outcome: schema.agentRuns.outcome, toolErrorCount: schema.agentRuns.toolErrorCount })
    .from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.restaurantId, restaurantId), gte(schema.agentRuns.runDate, start), lte(schema.agentRuns.runDate, end)))
}

export async function getRun(restaurantId: string, runId: string) {
  const [run] = await db.select().from(schema.agentRuns).where(and(eq(schema.agentRuns.id, runId), eq(schema.agentRuns.restaurantId, restaurantId))).limit(1)
  return run ?? null
}

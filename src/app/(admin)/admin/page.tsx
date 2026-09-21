import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { setAgentActionsEnabled, completeMenuOptimization } from './actions'

export default async function AdminCustomers() {
  const rows = await db.select({
    r: schema.restaurants,
    agentId: schema.restaurantAgents.zooworkAgentId,
    agentStatus: schema.restaurantAgents.agentStatus,
    owner: schema.users.email,
    connected: sql<number>`(select count(*) from platform_connections pc where pc.restaurant_id = ${schema.restaurants.id} and pc.status = 'connected')`,
    lastRun: sql<Date | null>`(select max(started_at) from agent_runs ar where ar.restaurant_id = ${schema.restaurants.id})`,
    // Open "Favie AI optimize my menu" request (owner is locked out of the Menu Clinic until we mark it done).
    menuOpt: sql<{ id: string; since: string } | null>`(select json_build_object('id', mo.id, 'since', mo.created_at) from menu_optimizations mo where mo.restaurant_id = ${schema.restaurants.id} and mo.status = 'requested' order by mo.created_at desc limit 1)`,
  })
    .from(schema.restaurants)
    .leftJoin(schema.restaurantAgents, eq(schema.restaurantAgents.restaurantId, schema.restaurants.id))
    .leftJoin(schema.users, eq(schema.users.id, schema.restaurants.ownerUserId))
    .orderBy(desc(schema.restaurants.createdAt))

  // Every agent run dies at its first model call when the ZooWork organization is out of credits; nothing else tells us.
  const [credit] = await db.select({
    n: sql<number>`count(*)`, since: sql<Date | null>`min(${schema.agentRuns.createdAt})`, last: sql<Date | null>`max(${schema.agentRuns.createdAt})`,
  }).from(schema.agentRuns).where(sql`${schema.agentRuns.createdAt} > now() - interval '48 hours' and ${schema.agentRuns.summaryParseError} like '%insufficient_credits%'`)
  const [okSince] = await db.select({ n: sql<number>`count(*)` }).from(schema.agentRuns)
    .where(sql`${schema.agentRuns.status} = 'collected' and ${schema.agentRuns.createdAt} > coalesce(${credit?.last ?? null}::timestamptz, now())`)
  const creditsOut = Number(credit?.n ?? 0) > 0 && Number(okSince?.n ?? 0) === 0

  return (
    <section>
      {creditsOut && (
        <div className="mb-5 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          <p className="font-semibold">ZooWork credits are exhausted — agents are not running.</p>
          <p className="mt-1">{Number(credit!.n)} runs failed with <code>402 insufficient_credits</code> in the last 48 hours (latest {credit!.last ? new Date(credit!.last).toLocaleString('en-US') : '—'}). Daily operations, dispute checks and Menu Clinic AI all stop until the organization balance is topped up in the ZooWork console. Dispute checks retry hourly (3 per day); daily runs resume at the next morning.</p>
        </div>
      )}
      <h1 className="font-display text-2xl font-bold tracking-tight">Customers</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-500">Each customer has one agent running the <Link href="/admin/prompt" className="text-brand-700 hover:underline">operating prompt</Link>. New restaurants start in <b>observe-only</b>: the agent reads, flags and recommends but changes nothing until you switch on "Agent changes" here. Open one to pause its daily cron, run the routine now, or read its recent runs.</p>
      <div className="card mt-5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr><th className="px-4 py-2.5">Restaurant</th><th className="px-4 py-2.5">Owner</th><th className="px-4 py-2.5">Agent</th><th className="px-4 py-2.5">Platforms</th><th className="px-4 py-2.5">Agent changes</th><th className="px-4 py-2.5">Daily cron</th><th className="px-4 py-2.5">Last run</th><th className="px-4 py-2.5">Menu optimization</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map(({ r, agentId, agentStatus, owner, connected, lastRun, menuOpt }) => (
              <tr key={r.id} className="hover:bg-ink-100/40">
                <td className="px-4 py-3"><Link href={`/admin/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link><div className="text-xs text-ink-400">{r.id}</div></td>
                <td className="px-4 py-3 text-ink-700">{owner}</td>
                <td className="px-4 py-3 font-mono text-xs">{agentId ?? '—'}<div className="font-sans text-ink-500">{agentStatus}</div></td>
                <td className="px-4 py-3">{Number(connected)} / 2 connected</td>
                <td className="px-4 py-3">
                  <form action={setAgentActionsEnabled} className="flex items-center gap-2">
                    <input type="hidden" name="restaurantId" value={r.id} />
                    <input type="hidden" name="enabled" value={r.agentActionsEnabled ? 'false' : 'true'} />
                    <button type="submit" role="switch" aria-checked={r.agentActionsEnabled} title={r.agentActionsEnabled ? 'Switch to observe-only' : 'Allow the agent to change ads and promotions'} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.agentActionsEnabled ? 'bg-emerald-500' : 'bg-ink-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${r.agentActionsEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-ink-500">{r.agentActionsEnabled ? 'on' : 'observe-only'}</span>
                  </form>
                </td>
                <td className="px-4 py-3">{r.dailySchedulePaused ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">paused</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">auto</span>}</td>
                <td className="px-4 py-3 text-ink-500">{lastRun ? new Date(lastRun).toLocaleString('en-US', { timeZone: r.timezone }) : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    {menuOpt && (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" /> owner requested {new Date(menuOpt.since).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} PT</span>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <a href={`/admin/${r.id}/portal`} title="Live browser on the owner's saved login, opened on the menu editor"
                        className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 text-xs font-medium text-white hover:bg-ink-700">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></svg>
                        Portal browser
                      </a>
                      <a href={`/admin/${r.id}/menu`} title="Their Menu Clinic, acting on their behalf (AI text/photos, sync)"
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2l1.8 5.7L19.5 9.5l-5.7 1.8L12 17l-1.8-5.7L4.5 9.5l5.7-1.8L12 2z" /><path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" opacity=".7" /></svg>
                        Menu Clinic
                      </a>
                    </div>
                    {menuOpt && (
                      <form action={completeMenuOptimization} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={menuOpt.id} />
                        <input name="note" placeholder="what was changed (optional)" className="input !w-52 !py-1 text-xs" />
                        <button type="submit" className="pill !py-1 text-xs">Mark done → unlock owner</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

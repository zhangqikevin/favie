import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { setAgentActionsEnabled } from './actions'

export default async function AdminCustomers() {
  const rows = await db.select({
    r: schema.restaurants,
    agentId: schema.restaurantAgents.zooworkAgentId,
    agentStatus: schema.restaurantAgents.agentStatus,
    owner: schema.users.email,
    connected: sql<number>`(select count(*) from platform_connections pc where pc.restaurant_id = ${schema.restaurants.id} and pc.status = 'connected')`,
    lastRun: sql<Date | null>`(select max(started_at) from agent_runs ar where ar.restaurant_id = ${schema.restaurants.id})`,
  })
    .from(schema.restaurants)
    .leftJoin(schema.restaurantAgents, eq(schema.restaurantAgents.restaurantId, schema.restaurants.id))
    .leftJoin(schema.users, eq(schema.users.id, schema.restaurants.ownerUserId))
    .orderBy(desc(schema.restaurants.createdAt))

  return (
    <section>
      <h1 className="font-display text-2xl font-bold tracking-tight">Customers</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-500">Each customer has one agent running the <Link href="/admin/prompt" className="text-brand-700 hover:underline">operating prompt</Link>. New restaurants start in <b>observe-only</b>: the agent reads, flags and recommends but changes nothing until you switch on "Agent changes" here. Open one to pause its daily cron, run the routine now, or read its recent runs.</p>
      <div className="card mt-5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr><th className="px-4 py-2.5">Restaurant</th><th className="px-4 py-2.5">Owner</th><th className="px-4 py-2.5">Agent</th><th className="px-4 py-2.5">Platforms</th><th className="px-4 py-2.5">Agent changes</th><th className="px-4 py-2.5">Daily cron</th><th className="px-4 py-2.5">Last run</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map(({ r, agentId, agentStatus, owner, connected, lastRun }) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

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

  return (
    <section>
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
                  {menuOpt ? (
                    <form action={completeMenuOptimization} className="flex flex-col gap-1.5">
                      <input type="hidden" name="id" value={menuOpt.id} />
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" /> requested {new Date(menuOpt.since).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} PT</span>
                      <p className="text-xs text-ink-500">Log into the owner's portals (their saved browser login), rewrite descriptions and photos, then:</p>
                      <input name="note" placeholder="what was changed (optional)" className="input !py-1 text-xs" />
                      <button type="submit" className="pill w-fit !py-1 text-xs">Mark done → unlock owner</button>
                    </form>
                  ) : <span className="text-xs text-ink-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

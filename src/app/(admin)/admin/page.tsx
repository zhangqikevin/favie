import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { activePrompt, promptHistory, defaultOperatingPrompt } from '@/lib/zoowork/skill-publish'
import { PromptEditor } from './PromptEditor'
import { rollbackPrompt } from './actions'
import { PlatformSettings } from './PlatformSettings'
import { getSetting, SETTING_KEYS } from '@/server/settings'
import { zoowork, currentZooworkKey } from '@/lib/zoowork/client'
import { isNotNull } from 'drizzle-orm'

export default async function AdminIndex() {
  const [active, history, rows] = await Promise.all([
    activePrompt(),
    promptHistory(15),
    db.select({
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
      .orderBy(desc(schema.restaurants.createdAt)),
  ])
  const [savedKey, defaultModel, models, agentCount] = await Promise.all([
    getSetting(SETTING_KEYS.zooworkApiKey),
    getSetting(SETTING_KEYS.zooworkDefaultModel),
    zoowork().listModels().catch(() => [] as { model: string; label?: string }[]),
    db.$count(schema.restaurantAgents, isNotNull(schema.restaurantAgents.zooworkAgentId)),
  ])
  const keyInUse = currentZooworkKey()
  const keyInfo = {
    source: savedKey ? ('database' as const) : keyInUse ? ('environment' as const) : ('none' as const),
    last4: keyInUse ? keyInUse.slice(-4) : null,
    updatedAt: savedKey?.updatedAt.toISOString() ?? null,
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">Agent operating prompt</h1>
        <p className="mt-1 text-sm text-ink-500">
          One prompt for every customer's agent. It is the daily-routine section of the <code>favie-ops</code> skill; publishing a new version pushes it to all agents at once.
          The connection protocol (handoff, login confirmation, store listing, summary format) stays fixed in code.
        </p>
        <div className="mt-5">
          <PromptEditor initial={active?.body ?? defaultOperatingPrompt()} activeVersion={active?.version ?? null} activeAt={active?.createdAt?.toISOString() ?? null} />
        </div>
        {history.length > 0 && (
          <div className="card mt-5 p-5">
            <h2 className="font-display text-sm font-bold">Version history</h2>
            <ul className="mt-3 divide-y divide-ink-100 text-sm">
              {history.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="font-mono text-xs">v{v.version}</span>
                  {v.isActive && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">active</span>}
                  <span className="text-ink-700">{v.note ?? '—'}</span>
                  <span className="text-xs text-ink-500">skill {v.skillVersion} · {v.createdAt.toLocaleString('en-US')} · {v.body.length} chars</span>
                  {!v.isActive && (
                    <form action={rollbackPrompt} className="ml-auto">
                      <input type="hidden" name="version" value={v.version} />
                      <button type="submit" className="text-xs font-medium text-brand-700 hover:underline">Roll back to this</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-bold tracking-tight">Platform settings</h2>
        <p className="mt-1 text-sm text-ink-500">Credentials and defaults for the ZooWork organization that hosts every customer agent.</p>
        <div className="mt-4">
          <PlatformSettings keyInfo={keyInfo} models={models.map((m) => ({ model: m.model, label: (m as { label?: string }).label }))} defaultModel={defaultModel?.value ?? null} agentCount={agentCount} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold tracking-tight">Customers</h2>
        <p className="mt-1 text-sm text-ink-500">Each customer has one agent running the prompt above. Open one to pause its daily cron, run the routine now, or read its recent runs.</p>
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-100/70 text-left text-xs uppercase tracking-wider text-ink-500">
              <tr><th className="px-4 py-2.5">Restaurant</th><th className="px-4 py-2.5">Owner</th><th className="px-4 py-2.5">Agent</th><th className="px-4 py-2.5">Platforms</th><th className="px-4 py-2.5">Daily cron</th><th className="px-4 py-2.5">Last run</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map(({ r, agentId, agentStatus, owner, connected, lastRun }) => (
                <tr key={r.id} className="hover:bg-ink-100/40">
                  <td className="px-4 py-3"><Link href={`/admin/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link><div className="text-xs text-ink-400">{r.id}</div></td>
                  <td className="px-4 py-3 text-ink-700">{owner}</td>
                  <td className="px-4 py-3 font-mono text-xs">{agentId ?? '—'}<div className="font-sans text-ink-500">{agentStatus}</div></td>
                  <td className="px-4 py-3">{Number(connected)} / 2 connected</td>
                  <td className="px-4 py-3">{r.dailySchedulePaused ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">paused</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">auto</span>}</td>
                  <td className="px-4 py-3 text-ink-500">{lastRun ? new Date(lastRun).toLocaleString('en-US', { timeZone: r.timezone }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

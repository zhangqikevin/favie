import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { getConnections, getPrimaryAgent, getAdCaps } from '@/server/restaurants'
import { RunNow } from './RunNow'
import { setDailyPaused } from '../actions'

const money = (c: number | null) => (c == null ? 'not set' : `$${(c / 100).toLocaleString('en-US')}`)

export default async function AdminRestaurant({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!r) notFound()
  const [agent, conns, caps, runs] = await Promise.all([
    getPrimaryAgent(r.id), getConnections(r.id), getAdCaps(r.id),
    db.select().from(schema.agentRuns).where(eq(schema.agentRuns.restaurantId, r.id)).orderBy(desc(schema.agentRuns.createdAt)).limit(12),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/admin" className="text-sm text-ink-500 hover:text-ink-900">← All restaurants</Link>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight">{r.name}</h1>
        </div>
        <form action={setDailyPaused}>
          <input type="hidden" name="restaurantId" value={r.id} />
          <input type="hidden" name="paused" value={r.dailySchedulePaused ? 'false' : 'true'} />
          <button type="submit" className={r.dailySchedulePaused ? 'btn-primary !py-2 text-sm' : 'btn-secondary !py-2 text-sm'}>
            {r.dailySchedulePaused ? 'Resume daily cron' : 'Pause daily cron'}
          </button>
        </form>
      </div>

      <div className="grid gap-4 text-sm md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-ink-500">Agent</p>
          <p className="mt-1 font-mono text-xs">{agent?.zooworkAgentId ?? '—'}</p>
          <p className="text-ink-500">{agent?.agentStatus} · cron {r.dailySchedulePaused ? 'paused' : 'auto'} · 06:{String(agent?.cronMinute ?? 0).padStart(2, '0')} {r.timezone}</p>
          <p className="mt-1 text-ink-500">login profile <span className="font-mono text-xs text-ink-700">{r.browserLoginLabel ?? '—'}</span></p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-ink-500">Platforms</p>
          {conns.map((c) => (
            <p key={c.platform} className="mt-1"><span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${c.platform === 'uber_eats' ? 'bg-uber' : 'bg-doordash'}`} />{c.platform === 'uber_eats' ? 'Uber Eats' : 'DoorDash'}: <b>{c.status}</b>{c.storeName ? ` · ${c.storeName}` : ''}{c.storeExternalId ? <span className="font-mono text-xs text-ink-500"> #{c.storeExternalId}</span> : null}</p>
          ))}
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-ink-500">Settings</p>
          <p className="mt-1">Goal: <b>{r.goal}</b></p>
          <p>Ad caps: UE {money(caps.uber_eats)} · DD {money(caps.doordash)}</p>
          <p className="text-ink-500">Owner accepted terms: {r.termsAcceptedAt ? 'yes' : 'no'}</p>
        </div>
      </div>

      <RunNow restaurantId={r.id} />

      <section className="card p-6">
        <h2 className="font-display text-base font-bold">Recent runs</h2>
        {runs.length === 0 ? <p className="mt-2 text-sm text-ink-500">No runs yet.</p> : (
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {runs.map((run) => (
              <li key={run.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium">{run.kind}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${run.status === 'collected' ? 'bg-emerald-50 text-emerald-700' : run.status === 'running' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-700'}`}>{run.status}</span>
                  {run.outcome && <span className="text-xs text-ink-500">{run.outcome}</span>}
                  <span className="text-xs text-ink-500">{run.startedAt?.toLocaleString('en-US', { timeZone: r.timezone })}</span>
                  {run.toolErrorCount > 0 && <span className="text-xs text-amber-700">{run.toolErrorCount} tool errors</span>}
                  <span className="ml-auto font-mono text-[11px] text-ink-400">{run.zooworkSessionId}</span>
                </div>
                {run.finalText && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-ink-500">agent output</summary>
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-900 p-3 text-xs text-white">{run.finalText}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

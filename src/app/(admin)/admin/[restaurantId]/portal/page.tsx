import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { getConnections } from '@/server/restaurants'
import { OpsBrowser } from './OpsBrowser'

/** Ops: live browser on the customer's saved platform login, straight on the menu editor. */
export default async function AdminPortal({ params, searchParams }: { params: Promise<{ restaurantId: string }>; searchParams: Promise<{ platform?: string }> }) {
  const { restaurantId } = await params
  const { platform } = await searchParams
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!r) notFound()
  const [conns, rows] = await Promise.all([
    getConnections(r.id),
    db.select().from(schema.opsHandoffs).where(and(eq(schema.opsHandoffs.restaurantId, r.id))).orderBy(desc(schema.opsHandoffs.createdAt)).limit(10),
  ])
  const latest = (p: 'uber_eats' | 'doordash') => { const x = rows.find((o) => o.platform === p); return x ? { id: x.id, status: x.status, note: x.note, error: x.error, targetUrl: x.targetUrl, readyAt: x.readyAt?.toISOString() ?? null, createdAt: x.createdAt.toISOString() } : null }
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-ink-500 hover:text-ink-900">← Customers</Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight">{r.name} · portal browser</h1>
          <Link href={`/admin/${r.id}/menu`} className="pill text-xs">Menu Clinic (ops) →</Link>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">The agent opens its browser on this restaurant's saved login and lands on the menu editor; you work in the live view below. The owner's connection state is untouched. One browser per restaurant: menu jobs wait while you hold it, so release it when you are done. The view expires after 60 minutes and the browser is then released automatically; open again if needed.</p>
      </div>
      <OpsBrowser restaurantId={r.id} initialPlatform={platform === 'doordash' ? 'doordash' : 'uber_eats'}
        connected={{ uber_eats: conns.some((c) => c.platform === 'uber_eats' && c.status === 'connected'), doordash: conns.some((c) => c.platform === 'doordash' && c.status === 'connected') }}
        initial={{ uber_eats: latest('uber_eats'), doordash: latest('doordash') }} />
    </div>
  )
}

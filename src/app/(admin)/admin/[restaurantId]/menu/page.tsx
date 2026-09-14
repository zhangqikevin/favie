import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { getConnections } from '@/server/restaurants'
import { menuState } from '@/lib/zoowork/menu'
import { MenuClinic } from '@/components/MenuClinic'

/** Ops view of a customer's Menu Clinic: same tool, acting on their behalf (drafts, AI text/photos, sync). */
export default async function AdminMenu({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  if (!r) notFound()
  const [conns, ue, dd] = await Promise.all([getConnections(r.id), menuState(r.id, 'uber_eats'), menuState(r.id, 'doordash')])
  const connected = { uber_eats: conns.some((c) => c.platform === 'uber_eats' && c.status === 'connected'), doordash: conns.some((c) => c.platform === 'doordash' && c.status === 'connected') }
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-ink-500 hover:text-ink-900">← Customers</Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight">{r.name} · Menu Clinic (ops)</h1>
          <Link href={`/admin/${r.id}/portal`} className="pill text-xs">Portal browser →</Link>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">You are acting on the owner's behalf: AI descriptions and photos, the save queue and Sync write to their Uber Eats / DoorDash exactly as they would. The owner's lock (Favie AI optimize) does not apply here.</p>
      </div>
      <MenuClinic restaurantId={r.id} connected={connected} initial={{ uber_eats: ue, doordash: dd }} ops />
    </div>
  )
}

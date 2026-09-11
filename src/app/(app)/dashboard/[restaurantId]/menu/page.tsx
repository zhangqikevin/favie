import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getRestaurantForUser, getConnections } from '@/server/restaurants'
import { menuState } from '@/lib/zoowork/menu'
import { MenuClinic } from '@/components/MenuClinic'

export default async function MenuPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const user = await requireUser()
  const r = await getRestaurantForUser(restaurantId, user.id)
  if (!r) notFound()
  const [conns, ue, dd] = await Promise.all([getConnections(r.id), menuState(r.id, 'uber_eats'), menuState(r.id, 'doordash')])
  const connected = { uber_eats: conns.find((c) => c.platform === 'uber_eats')?.status === 'connected', doordash: conns.find((c) => c.platform === 'doordash')?.status === 'connected' }
  return <MenuClinic restaurantId={r.id} connected={connected} initial={{ uber_eats: ue, doordash: dd }} />
}

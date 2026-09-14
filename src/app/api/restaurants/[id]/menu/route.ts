import { NextResponse } from 'next/server'
import { requireUser } from '@/server/auth'
import { getRestaurantForUserOrAdmin } from '@/server/restaurants'
import { menuState } from '@/lib/zoowork/menu'

export const dynamic = 'force-dynamic'

/** Polled by the Menu Clinic while jobs run. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const platform = new URL(req.url).searchParams.get('platform')
  if (platform !== 'uber_eats' && platform !== 'doordash') return NextResponse.json({ error: 'platform' }, { status: 400 })
  const user = await requireUser()
  const r = await getRestaurantForUserOrAdmin(id, user)
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(await menuState(r.id, platform), { headers: { 'cache-control': 'no-store' } })
}

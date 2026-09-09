import { NextResponse } from 'next/server'
import { getAuthUser } from '@/server/auth'
import { getRestaurantForUser, getConnections, getPrimaryAgent } from '@/server/restaurants'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const r = await getRestaurantForUser(id, user.id)
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const [conns, agent] = await Promise.all([getConnections(id), getPrimaryAgent(id)])
  return NextResponse.json({
    agentStatus: agent?.agentStatus ?? 'none',
    connections: conns.map((c) => ({ platform: c.platform, status: c.status, storeName: c.storeName, lastError: c.lastError, attempts: c.verifyAttempts, handoffUrl: c.handoffUrl, handoffStartedAt: c.handoffStartedAt?.toISOString() ?? null, storeCandidates: c.storeCandidates ?? null, storeAddress: c.storeAddress, progressNote: c.progressNote })),
  })
}

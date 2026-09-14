import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { requireAdmin } from '@/server/admin'

export const dynamic = 'force-dynamic'

/** Latest ops browser per platform for one restaurant; polled by the admin portal page. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await ctx.params
  const rows = await db.select().from(schema.opsHandoffs).where(and(eq(schema.opsHandoffs.restaurantId, id))).orderBy(desc(schema.opsHandoffs.createdAt)).limit(10)
  const latest = (p: 'uber_eats' | 'doordash') => rows.find((r) => r.platform === p) ?? null
  const pick = (r: typeof rows[number] | null) => r && ({ id: r.id, status: r.status, note: r.note, error: r.error, targetUrl: r.targetUrl, readyAt: r.readyAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() })
  return NextResponse.json({ uber_eats: pick(latest('uber_eats')), doordash: pick(latest('doordash')) }, { headers: { 'cache-control': 'no-store' } })
}

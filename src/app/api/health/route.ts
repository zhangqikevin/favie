import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

/** Liveness + how far the database is: three sequential `select 1` round trips, in milliseconds. No data. */
export async function GET(req: Request) {
  const ms: number[] = []
  try {
    for (let i = 0; i < 3; i++) { const t = Date.now(); await db.execute(sql`select 1`); ms.push(Date.now() - t) }
    // ?where=1: where does this server run? (city/region of its public address — to pick the database region)
    let where: unknown = null
    if (new URL(req.url).searchParams.get('where')) {
      where = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(4000) }).then((r) => r.json()).then((j: { city?: string; region?: string; country?: string; org?: string }) => ({ city: j.city, region: j.region, country: j.country, org: j.org })).catch(() => null)
    }
    return NextResponse.json({ ok: true, db_roundtrip_ms: ms, where })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 120), db_roundtrip_ms: ms }, { status: 503 })
  }
}

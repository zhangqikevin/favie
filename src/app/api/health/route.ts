import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

/** Liveness + how far the database is: three sequential `select 1` round trips, in milliseconds. No data. */
export async function GET() {
  const ms: number[] = []
  try {
    for (let i = 0; i < 3; i++) { const t = Date.now(); await db.execute(sql`select 1`); ms.push(Date.now() - t) }
    return NextResponse.json({ ok: true, db_roundtrip_ms: ms, region: process.env.REPLIT_DEPLOYMENT_REGION ?? process.env.REPL_REGION ?? null })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 120), db_roundtrip_ms: ms }, { status: 503 })
  }
}

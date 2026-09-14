'use client'
import { useEffect, useState } from 'react'
import { openOpsBrowser, releaseOpsBrowser } from '../../actions'

type Platform = 'uber_eats' | 'doordash'
type Row = { id: string; status: string; note: string | null; error: string | null; targetUrl: string | null; readyAt: string | null; createdAt: string } | null
const LABEL: Record<Platform, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash' }

export function OpsBrowser({ restaurantId, initialPlatform, connected, initial }: { restaurantId: string; initialPlatform: Platform; connected: Record<Platform, boolean>; initial: Record<Platform, Row> }) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform)
  const [rows, setRows] = useState(initial)
  const row = rows[platform]
  const live = row?.status === 'ready' && row.readyAt && Date.now() - new Date(row.readyAt).getTime() < 60 * 60_000
  const expired = row?.status === 'ready' && !live
  const working = row?.status === 'queued' || (row?.status === 'ready' && row.note === 'Releasing…')
  useEffect(() => {
    if (!working) return
    const id = setInterval(async () => {
      const res = await fetch(`/api/admin/restaurants/${restaurantId}/ops-handoff`, { cache: 'no-store' })
      if (res.ok) setRows(await res.json())
    }, 2500)
    return () => clearInterval(id)
  }, [working, restaurantId])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['uber_eats', 'doordash'] as Platform[]).map((p) => (
          <button key={p} type="button" onClick={() => setPlatform(p)} className={`pill !py-2 ${platform === p ? 'pill-active' : ''}`}>
            {LABEL[p]}{!connected[p] && <span className="opacity-60"> · not connected</span>}
            {rows[p]?.status === 'ready' && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {live && row && (
            <form action={releaseOpsBrowser}>
              <input type="hidden" name="id" value={row.id} /><input type="hidden" name="restaurantId" value={restaurantId} />
              <button type="submit" className="pill text-xs">Release browser</button>
            </form>
          )}
          <form action={openOpsBrowser}>
            <input type="hidden" name="restaurantId" value={restaurantId} /><input type="hidden" name="platform" value={platform} />
            <button type="submit" disabled={!connected[platform] || !!working} className="btn-primary !py-2 text-sm disabled:opacity-60">
              {live ? `Reopen ${LABEL[platform]} browser` : `Open ${LABEL[platform]} browser`}
            </button>
          </form>
        </div>
      </div>

      {working && (
        <div className="card flex items-center gap-3 p-5 text-sm">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
          <span>{row?.note ?? 'Working…'} <span className="text-ink-500">(usually 30–60 s)</span></span>
        </div>
      )}
      {row?.status === 'failed' && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">Could not open the browser: {row.error}</div>}
      {expired && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">This live view has expired (60 min). Open it again.</div>}
      {live && row && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-2 text-xs text-ink-500">
            <span className="truncate">{row.targetUrl}</span>
            <span>ready {new Date(row.readyAt!).toLocaleTimeString()}</span>
          </div>
          <iframe src={`/api/admin/handoff/${row.id}/embed`} title={`${LABEL[platform]} live browser`} className="h-[78vh] w-full bg-ink-900" allow="clipboard-read; clipboard-write" />
        </div>
      )}
      {!row && <div className="card p-8 text-center text-sm text-ink-500">No browser open for {LABEL[platform]} yet.</div>}
    </div>
  )
}

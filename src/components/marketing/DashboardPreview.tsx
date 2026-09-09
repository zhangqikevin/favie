// A static, CSS-only mock of the product dashboard used on the landing page.
const days = Array.from({ length: 35 }, (_, i) => i - 2) // Sep 2026 starts on a Tuesday
const marks: Record<number, ('ue' | 'dd')[]> = {
  1: ['dd'], 2: ['ue', 'dd'], 3: ['ue'], 4: ['dd'], 7: ['ue', 'dd'], 8: ['dd'], 9: ['ue'], 10: ['ue', 'dd'],
  11: ['dd'], 14: ['ue', 'dd'], 15: ['ue'], 16: ['dd'], 17: ['ue', 'dd'], 18: ['dd'], 21: ['ue'], 22: ['ue', 'dd'],
}
const bars = [42, 55, 48, 61, 70, 66, 74, 69, 78, 85, 80, 92, 88, 96]

export function DashboardPreview() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Golden Wok · Irvine
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">Uber Eats connected</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">DoorDash connected</span>
        </div>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-5">
        {/* Calendar */}
        <div className="md:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">September 2026</p>
            <p className="text-xs text-ink-500">Agent activity</p>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-ink-500">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
            {days.map((d, i) => (
              <div
                key={i}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs ${
                  d < 1 || d > 30 ? 'border-transparent text-ink-300/50' : d === 22 ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700' : 'border-ink-100 text-ink-700'
                }`}
              >
                {d >= 1 && d <= 30 ? d : ''}
                {marks[d] && (
                  <div className="mt-1 flex gap-0.5">
                    {marks[d].map((p) => (
                      <span key={p} className={`h-1.5 w-1.5 rounded-full ${p === 'ue' ? 'bg-uber' : 'bg-doordash'}`} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Detail */}
        <div className="flex flex-col gap-3 md:col-span-2">
          <div className="rounded-xl border border-ink-100 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-500">
              <span className="h-2 w-2 rounded-full bg-doordash" /> DoorDash · Sep 22
            </div>
            <p className="text-sm font-semibold">Lowered daily ad budget $40 → $31</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              <span className="font-medium text-ink-700">Why:</span> $612 of the $900 monthly cap already spent with 9 days left.
              Keeps you under cap while covering the Fri–Sun dinner peak.
            </p>
          </div>
          <div className="rounded-xl border border-ink-100 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-500">
              <span className="h-2 w-2 rounded-full bg-uber" /> Uber Eats · Sep 22
            </div>
            <p className="text-sm font-semibold">Flagged 3 items marked unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              <span className="font-medium text-ink-700">Why:</span> Mango Chicken Bowl is your #2 seller and has been off the menu since Saturday.
            </p>
          </div>
          <div className="rounded-xl bg-ink-900 p-4 text-white">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-xs font-medium text-white/70">Orders · last 14 days</p>
              <p className="text-xs font-semibold text-emerald-400">+18%</p>
            </div>
            <div className="flex h-14 items-end gap-1">
              {bars.map((b, i) => (
                <div key={i} className="flex-1 rounded-sm bg-brand-400/90" style={{ height: `${b}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

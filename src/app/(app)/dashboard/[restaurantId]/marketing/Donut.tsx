/** Small donut: ad-driven vs organic sales. Orange accent for the ad share, light gray for the rest. */
export function Donut({ adCents, totalCents, labelAd, labelOrganic, none }: { adCents: number | null; totalCents: number; labelAd: string; labelOrganic: string; none: string }) {
  const r = 34, c = 2 * Math.PI * r
  const share = adCents != null && totalCents > 0 ? Math.min(1, adCents / totalCents) : 0
  const pct = Math.round(share * 100)
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 88 88" className="h-24 w-24 shrink-0" aria-hidden="true">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-ink-100)" strokeWidth="11" />
        {share > 0 && (
          <circle cx="44" cy="44" r={r} fill="none" stroke="#FF7A1A" strokeWidth="11" strokeLinecap="round"
            strokeDasharray={`${(share * c).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 44 44)" />
        )}
        <text x="44" y="48" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-ink-900)">{adCents == null ? '—' : `${pct}%`}</text>
      </svg>
      <ul className="space-y-1.5 text-xs">
        <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#FF7A1A]" /><span className="text-ink-500">{labelAd}</span><span className="font-semibold">{adCents == null ? '—' : `$${Math.round(adCents / 100).toLocaleString('en-US')}`}</span></li>
        <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-ink-100 ring-1 ring-ink-300/40" /><span className="text-ink-500">{labelOrganic}</span><span className="font-semibold">{`$${Math.round(Math.max(0, totalCents - (adCents ?? 0)) / 100).toLocaleString('en-US')}`}</span></li>
        {adCents == null && <li className="max-w-[12rem] text-ink-500">{none}</li>}
      </ul>
    </div>
  )
}

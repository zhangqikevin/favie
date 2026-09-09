import type { Platform } from '@/lib/db/schema'

/** Brand-colored tile per delivery platform. `muted` renders the grey "not connected" variant. */
export function PlatformIcon({ platform, className = 'h-12 w-12', muted = false }: { platform: Platform; className?: string; muted?: boolean }) {
  if (platform === 'uber_eats') {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-label="Uber Eats" role="img">
        <rect width="48" height="48" rx="12" fill={muted ? '#cfd5e0' : '#0b0f19'} />
        <text x="24" y="22" textAnchor="middle" fontFamily="Hanken Grotesk, ui-sans-serif, system-ui" fontWeight="800" fontSize="12.5" fill="#fff" letterSpacing="-0.3">Uber</text>
        <text x="24" y="35" textAnchor="middle" fontFamily="Hanken Grotesk, ui-sans-serif, system-ui" fontWeight="800" fontSize="12.5" fill={muted ? '#fff' : '#06c167'} letterSpacing="-0.3">Eats</text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 48" className={className} aria-label="DoorDash" role="img">
      <rect width="48" height="48" rx="12" fill={muted ? '#cfd5e0' : '#ff3008'} />
      {/* stylised "D" with the DoorDash-like notch */}
      <path d="M13 15h13.5a9 9 0 0 1 0 18H20l3.2-4.6H26.5a4.4 4.4 0 0 0 0-8.8H16.2L13 15z" fill="#fff" />
      <path d="M11 24.6h13.4l-3.2 4.6H11z" fill="#fff" opacity="0.9" />
    </svg>
  )
}

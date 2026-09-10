import type { PlatformId } from '@/lib/platforms'

/**
 * Brand-colored tile per delivery platform. Corner radius comes from the className (rounded-2xl, rounded-full…).
 * `muted` renders the not-connected look: grayscale and dimmed.
 */
export function PlatformIcon({ platform, className = 'h-12 w-12 rounded-2xl', muted = false }: { platform: PlatformId; className?: string; muted?: boolean }) {
  const cls = `overflow-hidden ${className} ${muted ? 'grayscale opacity-50' : ''}`
  const font = 'Hanken Grotesk, Inter, ui-sans-serif, system-ui'
  switch (platform) {
    case 'uber_eats':
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-label="Uber Eats" role="img">
          <rect width="48" height="48" fill="#0b0f19" />
          <text x="24" y="22" textAnchor="middle" fontFamily={font} fontWeight="800" fontSize="12.5" fill="#fff" letterSpacing="-0.3">Uber</text>
          <text x="24" y="35" textAnchor="middle" fontFamily={font} fontWeight="800" fontSize="12.5" fill="#06c167" letterSpacing="-0.3">Eats</text>
        </svg>
      )
    case 'doordash':
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-label="DoorDash" role="img">
          <rect width="48" height="48" fill="#ff3008" />
          <path d="M13 15h13.5a9 9 0 0 1 0 18H20l3.2-4.6H26.5a4.4 4.4 0 0 0 0-8.8H16.2L13 15z" fill="#fff" />
          <path d="M11 24.6h13.4l-3.2 4.6H11z" fill="#fff" opacity="0.9" />
        </svg>
      )
    case 'hungrypanda':
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-label="HungryPanda" role="img">
          <rect width="48" height="48" fill="#ffb300" />
          {/* panda face */}
          <circle cx="15" cy="15" r="5.5" fill="#1a1a1a" />
          <circle cx="33" cy="15" r="5.5" fill="#1a1a1a" />
          <circle cx="24" cy="26" r="13" fill="#fff" />
          <ellipse cx="18.5" cy="24" rx="4" ry="4.8" fill="#1a1a1a" transform="rotate(-15 18.5 24)" />
          <ellipse cx="29.5" cy="24" rx="4" ry="4.8" fill="#1a1a1a" transform="rotate(15 29.5 24)" />
          <circle cx="19.3" cy="23.5" r="1.4" fill="#fff" />
          <circle cx="28.7" cy="23.5" r="1.4" fill="#fff" />
          <ellipse cx="24" cy="31" rx="2.6" ry="1.8" fill="#1a1a1a" />
        </svg>
      )
    case 'fantuan':
      return (
        <svg viewBox="0 0 48 48" className={cls} aria-label="Fantuan" role="img">
          <rect width="48" height="48" fill="#e8412f" />
          <text x="24" y="31" textAnchor="middle" fontFamily="'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif" fontWeight="700" fontSize="17" fill="#fff">饭团</text>
        </svg>
      )
  }
}

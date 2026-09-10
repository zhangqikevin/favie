/** Favie mark: blue rounded tile, white takeout bag with a slanted side panel, four-point spark. Vector redraw of the brand image. */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#2563EB"/>
      <path d="M192 214 L222 118 H298 L328 214" fill="none" stroke="#fff" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M170 172 H352 L400 386 H118 Z" fill="#fff" stroke="#fff" strokeWidth="22" strokeLinejoin="round"/>
      <path d="M170 172 H196 L158 386 H118 Z" fill="#2563EB" opacity="0.28"/>
      <path d="M290 232 C296 268 312 284 348 290 C312 296 296 312 290 348 C284 312 268 296 232 290 C268 284 284 268 290 232 Z" fill="#2563EB"/>
    </svg>
  )
}

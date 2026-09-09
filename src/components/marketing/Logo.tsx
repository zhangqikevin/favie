export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-brand-500" />
      {/* fork */}
      <path d="M10 7v7.5a3 3 0 0 0 3 3v7.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M13 7v7.5M16 7v7.5a3 3 0 0 1-3 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* spark */}
      <path d="M22 8.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" fill="white" />
      <path d="M21.5 17.5V25" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

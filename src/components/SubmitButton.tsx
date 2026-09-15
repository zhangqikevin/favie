'use client'
import { useFormStatus } from 'react-dom'

/**
 * Submit button for server-action forms: disables itself and shows a spinner the instant the form is
 * submitted, so a slow action + redirect never looks like a dead click.
 */
export function SubmitButton({ children, className = 'btn-primary', pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
      {pending && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}

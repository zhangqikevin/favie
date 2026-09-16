'use client'
import { useFormStatus } from 'react-dom'

/**
 * Submit button for server-action forms: disables itself and shows a spinner the instant the form is
 * submitted, so a slow action + redirect never looks like a dead click.
 */
export function SubmitButton({ children, className = 'btn-primary', pendingLabel, disabled = false, title }: { children: React.ReactNode; className?: string; pendingLabel?: React.ReactNode; disabled?: boolean; title?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} title={title} className={`${className} ${pending ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'} disabled:opacity-60`}>
      {pending && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}

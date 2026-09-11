import Link from 'next/link'
import { requireAdmin } from '@/server/admin'
import { Logo } from '@/components/marketing/Logo'
import { AdminNav } from './AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()
  return (
    <div className="flex min-h-screen bg-ink-100/60">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-ink-100/80 px-4 py-5">
        <Link href="/admin" className="flex items-center gap-2.5 px-2">
          <Logo className="h-9 w-9" />
          <span className="font-display text-base font-bold">Favie</span>
          <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">sysadmin</span>
        </Link>
        <div className="mt-6 flex-1"><AdminNav /></div>
        <div className="border-t border-ink-200 px-2 pt-4 text-xs text-ink-500">
          <p className="truncate" title={user.email ?? ''}>{user.email}</p>
          <Link href="/dashboard" className="mt-1 inline-block hover:text-ink-900 hover:underline">← Back to the app</Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}

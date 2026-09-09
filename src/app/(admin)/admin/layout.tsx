import Link from 'next/link'
import { requireAdmin } from '@/server/admin'
import { Logo } from '@/components/marketing/Logo'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()
  return (
    <div className="min-h-screen bg-ink-100/60">
      <header className="border-b border-ink-100 bg-white">
        <div className="container-x flex h-14 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Logo className="h-6 w-6" />
            <span className="font-display text-base font-bold">Favie</span>
            <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">sysadmin</span>
          </Link>
          <span className="text-xs text-ink-500">{user.email}</span>
        </div>
      </header>
      <div className="container-x py-8">{children}</div>
    </div>
  )
}

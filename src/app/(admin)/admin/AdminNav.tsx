'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS: { href: string; label: string; hint: string; match: (p: string) => boolean }[] = [
  { href: '/admin', label: 'Customers', hint: 'Restaurants, agents, switches', match: (p) => p === '/admin' || /^\/admin\/[0-9a-f-]{36}/.test(p) },
  { href: '/admin/prompt', label: 'Agent prompt', hint: 'Daily routine, versions', match: (p) => p.startsWith('/admin/prompt') },
  { href: '/admin/menu-prompts', label: 'Menu Clinic prompts', hint: 'Descriptions, dish photos', match: (p) => p.startsWith('/admin/menu-prompts') },
  { href: '/admin/dispute-prompts', label: 'Dispute prompts', hint: 'Uber Eats, DoorDash, text rules', match: (p) => p.startsWith('/admin/dispute-prompts') },
  { href: '/admin/settings', label: 'Platform settings', hint: 'ZooWork key, default model', match: (p) => p.startsWith('/admin/settings') },
]

export function AdminNav() {
  const pathname = usePathname() ?? '/admin'
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((it) => {
        const active = it.match(pathname)
        return (
          <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined}
            className={`rounded-xl px-3 py-2.5 transition-colors ${active ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-white'}`}>
            <span className="block text-sm font-semibold">{it.label}</span>
            <span className={`block text-[11px] ${active ? 'text-white/70' : 'text-ink-500'}`}>{it.hint}</span>
          </Link>
        )
      })}
    </nav>
  )
}

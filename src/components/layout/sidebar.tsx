'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Search, FileText, Folder, Hammer, Bell, BookOpen, Package, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'find',      href: '/find',      icon: Search },
  { key: 'tenders',   href: '/tenders',   icon: FileText },
  { key: 'documents', href: '/documents', icon: Folder },
  { key: 'bid',       href: '/bid',        icon: Hammer },
  { key: 'alerts',   href: '/alerts',    icon: Bell },
  { key: 'learn',    href: '/learn',     icon: BookOpen },
  { key: 'orders',   href: '/orders',    icon: Package },
  { key: 'settings', href: '/settings',  icon: Settings },
]

export function Sidebar({ locale }: { locale: string }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  return (
    <aside className="hidden desktop:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-200 z-40">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center">
          <span className="text-orange font-heading font-bold text-xs">TS</span>
        </div>
        <span className="font-heading font-semibold text-navy text-sm">TenderSarthi</span>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV.map(({ key, href, icon: Icon }) => {
          const full = `/${locale}${href}`
          const active = pathname.startsWith(full)
          return (
            <Link key={key} href={full} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors', active ? 'bg-orange/10 text-orange font-semibold' : 'text-gray-600 hover:bg-gray-100')}>
              <Icon size={18} aria-hidden="true" />
              <span>{t(key)}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

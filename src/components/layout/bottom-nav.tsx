'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, FileText, Hammer, MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const NAV = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'find',      href: '/find',      icon: Search },
  { key: 'tenders',   href: '/tenders',   icon: FileText },
  { key: 'bid',       href: '/bid',        icon: Hammer },
  { key: 'more',      href: '/settings',  icon: MoreHorizontal },
]

export function BottomNav({ locale }: { locale: string }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 desktop:hidden">
      <div className="flex items-center justify-around h-16">
        {NAV.map(({ key, href, icon: Icon }) => {
          const full = `/${locale}${href}`
          const active = pathname.startsWith(full)
          return (
            <Link key={key} href={full} aria-current={active ? 'page' : undefined} className={cn('flex flex-col items-center gap-0.5 px-3 py-2 min-w-[48px] min-h-[48px] justify-center', active ? 'text-orange' : 'text-muted')}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} aria-hidden="true" />
              <span className="text-[10px] font-medium">{t(key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// src/components/layout/bottom-nav.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, Hammer, Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { MenuSheet } from '@/components/layout/menu-sheet'
import type { UserProfile } from '@/lib/types'

const NAV = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'tenders',   href: '/tenders',   icon: FileText },
  { key: 'bid',       href: '/bid',        icon: Hammer },
] as const

interface BottomNavProps {
  locale: string
  profile: UserProfile | null
}

export function BottomNav({ locale, profile }: BottomNavProps) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 desktop:hidden shadow-[0_-1px_12px_rgba(26,55,102,0.06)]">
        <div className="flex items-center justify-around h-16">
          {NAV.map(({ key, href, icon: Icon }) => {
            const full = `/${locale}${href}`
            const active = pathname.startsWith(full)
            return (
              <Link
                key={key}
                href={full}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-2 min-w-[48px] min-h-[48px] justify-center transition-colors',
                  active ? 'text-orange' : 'text-muted hover:text-navy/60'
                )}
              >
                {/* Active indicator bar */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-orange" />
                )}
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} aria-hidden="true" />
                <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>{t(key)}</span>
              </Link>
            )
          })}

          {/* Tab 5: Menu button — never highlighted as "active" */}
          <button
            onClick={() => setSheetOpen(true)}
            aria-label={t('menu')}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className="relative flex flex-col items-center gap-0.5 px-3 py-2 min-w-[48px] min-h-[48px] justify-center text-muted hover:text-navy/60 transition-colors"
          >
            <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
            <span className="text-[10px] font-medium">{t('menu')}</span>
          </button>
        </div>
      </nav>

      <MenuSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        locale={locale}
        profile={profile}
      />
    </>
  )
}

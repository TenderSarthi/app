// src/components/layout/bottom-nav.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, FileText, Hammer, Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { MenuSheet } from '@/components/layout/menu-sheet'
import type { UserProfile } from '@/lib/types'

const NAV = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'find',      href: '/find',      icon: Search },
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 desktop:hidden">
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
                  'flex flex-col items-center gap-0.5 px-3 py-2 min-w-[48px] min-h-[48px] justify-center',
                  active ? 'text-orange' : 'text-muted'
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} aria-hidden="true" />
                <span className="text-[10px] font-medium">{t(key)}</span>
              </Link>
            )
          })}

          {/* Tab 5: Menu button — never highlighted as "active" */}
          <button
            onClick={() => setSheetOpen(true)}
            aria-label={t('menu')}
            className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[48px] min-h-[48px] justify-center text-muted"
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

// src/components/layout/menu-sheet.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell, BookOpen, Folder, Package, Settings, LogOut } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/firebase/auth'
import { getPlanBadge } from '@/lib/dashboard-utils'
import type { UserProfile } from '@/lib/types'

interface MenuSheetProps {
  open: boolean
  onClose: () => void
  locale: string
  profile: UserProfile | null
}

const NAV_ITEMS = [
  { key: 'alerts',    icon: Bell,     href: '/alerts'    },
  { key: 'learn',     icon: BookOpen, href: '/learn'     },
  { key: 'documents', icon: Folder,   href: '/documents' },
  { key: 'orders',    icon: Package,  href: '/orders'    },
  { key: 'settings',  icon: Settings, href: '/settings'  },
] as const

export function MenuSheet({ open, onClose, locale, profile }: MenuSheetProps) {
  const router = useRouter()
  const tNav = useTranslations('nav')
  const tSettings = useTranslations('settings')

  async function handleLogOut() {
    onClose()
    await signOut()
    router.replace(`/${locale}/auth`)
  }

  function navigate(href: string) {
    onClose()
    router.push(`/${locale}${href}`)
  }

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) onClose() }}>
      <SheetContent side="bottom" showCloseButton={false} className="px-4 pb-8 pt-3 rounded-t-2xl max-h-[85vh]">
        <SheetTitle className="sr-only">{tNav('menu')}</SheetTitle>

        {/* Drag handle — visual affordance only; close via tap-outside or X */}
        <div className="w-10 h-1 rounded bg-gray-200 mx-auto mb-4" />

        {/* User strip */}
        {profile && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-navy/5 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {profile.name ? profile.name.slice(0, 2).toUpperCase() : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy text-sm truncate">{profile.name}</p>
              <span
                className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full',
                  profile.plan === 'pro'
                    ? 'bg-orange/10 text-orange'
                    : 'bg-navy/10 text-navy/60'
                )}
              >
                {getPlanBadge(profile)}
              </span>
            </div>
          </div>
        )}

        {/* 2×3 nav grid */}
        <div className="grid grid-cols-3 gap-2">
          {NAV_ITEMS.map(({ key, icon: Icon, href }) => (
            <button
              key={key}
              onClick={() => navigate(href)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-navy/5 active:bg-navy/10 transition-colors"
            >
              <Icon size={22} className="text-navy" aria-hidden="true" />
              <span className="text-[11px] font-medium text-navy">{tNav(key)}</span>
            </button>
          ))}

          {/* Log Out — sixth cell, danger colour */}
          <button
            onClick={handleLogOut}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-danger/5 active:bg-danger/10 transition-colors"
          >
            <LogOut size={22} className="text-danger" aria-hidden="true" />
            <span className="text-[11px] font-medium text-danger">{tSettings('logout')}</span>
          </button>
        </div>

      </SheetContent>
    </Sheet>
  )
}

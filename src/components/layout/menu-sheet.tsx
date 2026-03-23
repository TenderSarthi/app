// src/components/layout/menu-sheet.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell, BookOpen, Folder, Bookmark, Settings, LogOut, ChevronRight } from 'lucide-react'
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
  { key: 'saved',     icon: Bookmark, href: '/saved'     },
  { key: 'alerts',    icon: Bell,     href: '/alerts'    },
  { key: 'learn',     icon: BookOpen, href: '/learn'     },
  { key: 'documents', icon: Folder,   href: '/documents' },
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

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) onClose() }}>
      <SheetContent side="bottom" showCloseButton={false} className="px-0 pb-8 pt-3 rounded-t-2xl max-h-[90vh]">
        <SheetTitle className="sr-only">{tNav('profile')}</SheetTitle>

        {/* Drag handle */}
        <div className="w-10 h-1 rounded bg-navy/10 mx-auto mb-5" />

        {/* Profile header */}
        {profile && (
          <div className="flex items-center gap-4 px-5 pb-5 border-b border-navy/10">
            <div className="w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-navy text-base truncate">{profile.name}</p>
              <p className="text-xs text-muted truncate mt-0.5">{profile.email || profile.businessName || ''}</p>
              <span className={cn(
                'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5',
                profile.plan === 'pro'
                  ? 'bg-orange/10 text-orange'
                  : 'bg-navy/8 text-navy/60'
              )}>
                {getPlanBadge(profile)}
              </span>
            </div>
          </div>
        )}

        {/* Nav items — full-width rows */}
        <div className="px-2 pt-3 space-y-0.5">
          {NAV_ITEMS.map(({ key, icon: Icon, href }) => (
            <button
              key={key}
              onClick={() => navigate(href)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-navy/5 active:bg-navy/10 transition-colors"
            >
              <Icon size={18} className="text-navy/70 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-navy">{tNav(key)}</span>
              <ChevronRight size={15} className="text-navy/30" />
            </button>
          ))}

          {/* Divider before logout */}
          <div className="mx-3 my-1 border-t border-navy/10" />

          <button
            onClick={handleLogOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-danger/5 active:bg-danger/10 transition-colors"
          >
            <LogOut size={18} className="text-danger shrink-0" aria-hidden="true" />
            <span className="flex-1 text-sm font-medium text-danger">{tSettings('logout')}</span>
          </button>
        </div>

      </SheetContent>
    </Sheet>
  )
}

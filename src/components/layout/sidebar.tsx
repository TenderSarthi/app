'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, FileText, Folder, Sparkles, Bell, BookOpen, Package, Bookmark, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { signOut } from '@/lib/firebase/auth'

const NAV = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'tenders',   href: '/tenders',   icon: FileText },
  { key: 'ai',        href: '/bid',        icon: Sparkles },
  { key: 'orders',    href: '/orders',     icon: Package },
  { key: 'saved',     href: '/saved',      icon: Bookmark },
  { key: 'alerts',    href: '/alerts',     icon: Bell },
  { key: 'learn',     href: '/learn',      icon: BookOpen },
  { key: 'documents', href: '/documents',  icon: Folder },
  { key: 'settings',  href: '/settings',   icon: Settings },
]

export function Sidebar({ locale }: { locale: string }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const { profile } = useUserProfile()
  const router = useRouter()

  async function handleLogout() {
    await signOut()
    router.replace(`/${locale}/auth`)
  }

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <aside className="hidden desktop:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-200 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center">
          <span className="text-orange font-heading font-bold text-xs">TS</span>
        </div>
        <span className="font-heading font-semibold text-navy text-sm">TenderSarthi</span>
      </div>

      {/* Nav links */}
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

      {/* User footer with logout */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
          <span className="text-navy font-bold text-xs">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-navy truncate">{profile?.name || '—'}</p>
          <p className="text-[10px] text-muted truncate">{profile?.businessName || profile?.email || ''}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-red-50 transition-colors"
        >
          <LogOut size={15} aria-label="Log out" />
        </button>
      </div>
    </aside>
  )
}

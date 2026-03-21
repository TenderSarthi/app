'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Bell, BookOpen, FileCheck, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/hooks/use-auth'

const NAV = [
  { href: '/admin',          label: 'Overview',  icon: LayoutDashboard },
  { href: '/admin/users',    label: 'Users',     icon: Users },
  { href: '/admin/alerts',   label: 'Alerts',    icon: Bell },
  { href: '/admin/learn',    label: 'Learn CMS', icon: BookOpen },
  { href: '/admin/tenders',  label: 'Tenders',   icon: FileCheck },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const params   = useParams<{ locale: string }>()
  const locale   = params.locale
  const pathname = usePathname()

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    if (loading) return
    if (!user || user.email !== adminEmail) {
      router.replace(`/${locale}/dashboard`)
    }
  }, [loading, user, adminEmail, locale, router])

  if (loading || !user || user.email !== adminEmail) return null

  return (
    <div className="min-h-screen bg-lightbg flex">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-navy text-white flex flex-col min-h-screen">
        <div className="px-4 py-5 border-b border-white/10">
          <p className="font-heading font-bold text-sm">TenderSarthi</p>
          <p className="text-xs text-white/50 mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const full    = `/${locale}${href}`
            const active  = pathname === full
            return (
              <Link
                key={href}
                href={full}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-orange text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <Link
            href={`/${locale}/dashboard`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}

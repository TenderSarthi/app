'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { OfflineBanner } from '@/components/layout/offline-banner'
import { InstallPrompt } from '@/components/layout/install-prompt'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading } = useUserProfile()
  const router = useRouter()
  const params = useParams<{ locale: string }>()
  const locale = params.locale

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/${locale}/auth`)
  }, [authLoading, user, locale, router])

  useEffect(() => {
    // Redirect to onboarding if: profile missing entirely (no Firestore doc)
    // or profile exists but name is empty (onboarding never completed).
    // Also guard on !authLoading: on locale switch FirebaseProvider remounts,
    // briefly resetting auth state. Without this guard, the window between
    // "auth resolved (user set)" and "profile snapshot arrived" causes a
    // false redirect because profileLoading is still false from the prior run.
    if (!authLoading && !profileLoading && user && (!profile || !profile.name)) {
      router.replace(`/${locale}/onboarding`)
    }
  }, [authLoading, profileLoading, profile, user, locale, router])

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightbg">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-lightbg">
      <OfflineBanner />
      <Sidebar locale={locale} />
      <main className="desktop:ml-60 pb-20 desktop:pb-0">
        <div className="p-4 desktop:p-6">{children}</div>
      </main>
      <BottomNav locale={locale} profile={profile} />
      <InstallPrompt />
    </div>
  )
}

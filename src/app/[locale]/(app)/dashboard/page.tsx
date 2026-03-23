// src/app/[locale]/(app)/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { touchLastActive } from '@/lib/firebase/firestore'
import { TrialBanner } from '@/components/dashboard/trial-banner'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { GettingStarted } from '@/components/dashboard/getting-started'
import { ActiveDashboard } from '@/components/dashboard/active-dashboard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { isPro } from '@/lib/plan-guard'

export default function DashboardPage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'hi'
  const t = useTranslations('dashboard')

  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders, loading: tendersLoading, error: tendersError } = useUserTenders(user?.uid ?? null)
  const { usage } = useAIUsage(user?.uid ?? null)
  const [upgradeOpen, setUpgradeOpen]       = useState(false)

  useEffect(() => {
    if (user?.uid) touchLastActive(user.uid).catch(() => {})
  }, [user?.uid])

  // Guard 1: profile must be loaded before we render anything that reads it
  if (!profile) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <p className="text-sm text-muted">Could not load your profile. Please refresh the page.</p>
    </div>
  )

  // Guard 2: wait for tenders snapshot to avoid flashing Getting Started
  if (tendersLoading) return (
    <div className="space-y-3 mt-4">
      <div className="h-20 bg-navy/5 rounded-xl animate-pulse" />
      <div className="h-20 bg-navy/5 rounded-xl animate-pulse" />
    </div>
  )

  const userIsPro     = isPro(profile)
  const activeTenders = tenders.filter(tender => tender.status === 'active')
  const isNewUser     = tenders.length === 0   // single source of truth

  return (
    <div className="space-y-5 pb-32 desktop:pb-6">
      {!userIsPro && (
        <TrialBanner
          trialEndsAt={profile.trialEndsAt}
          createdAt={profile.createdAt}
          onUpgrade={() => setUpgradeOpen(true)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-xl text-navy">
            {t('greeting', { name: profile.name || 'Vendor' })}
          </h1>
          {activeTenders.length > 0 && (
            <p className="text-sm text-muted mt-0.5">
              {t('activeTenders', { count: activeTenders.length })}
            </p>
          )}
        </div>
        <NotificationBell tenders={tenders} locale={locale} />
      </div>

      {tendersError && (
        <p className="text-sm text-danger">{tendersError}</p>
      )}

      {/* Adaptive section — replaces <FeatureCards> */}
      {isNewUser ? (
        <GettingStarted
          locale={locale}
          profile={profile}
          tenders={tenders}
          usage={usage}
        />
      ) : (
        <ActiveDashboard
          locale={locale}
          tenders={tenders}
          activeTenders={activeTenders}
          usage={usage}
        />
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="trial_cta"
      />
    </div>
  )
}

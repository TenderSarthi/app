'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { usePlatformStats } from '@/lib/hooks/use-platform-stats'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { TrustSignalBar } from '@/components/dashboard/trust-signal-bar'
import { TrialBanner } from '@/components/dashboard/trial-banner'
import { AIUsageCounter } from '@/components/dashboard/ai-usage-counter'
import { FeatureCards } from '@/components/dashboard/feature-cards'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { isPro } from '@/lib/plan-guard'

export default function DashboardPage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'hi'
  const t = useTranslations('dashboard')

  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { stats } = usePlatformStats()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage } = useAIUsage(user?.uid ?? null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  if (!profile) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <p className="text-sm text-muted">Could not load your profile. Please refresh the page.</p>
    </div>
  )

  const userIsPro = isPro(profile)

  const accountAgeDays = profile.createdAt
    ? Math.floor((Date.now() - profile.createdAt.toMillis()) / 86_400_000)
    : 0
  const isNewUser = accountAgeDays < 14 || tenders.length < 3

  const activeTenders = tenders.filter(tender => tender.status === 'active')
  const nextDeadline = activeTenders
    .filter(tender => tender.deadline)
    .sort((a, b) => (a.deadline!.toMillis() - b.deadline!.toMillis()))[0]

  const daysUntilDeadline = nextDeadline?.deadline
    ? Math.ceil((nextDeadline.deadline.toMillis() - Date.now()) / 86_400_000)
    : null

  return (
    <div className="space-y-5 pb-20 desktop:pb-6">
      <TrustSignalBar stats={stats} />

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
              {daysUntilDeadline !== null && (
                <span className={daysUntilDeadline <= 3 ? ' text-danger font-semibold' : ' text-muted'}>
                  {' '}• {t('nextDeadline', { days: daysUntilDeadline })}
                </span>
              )}
            </p>
          )}
        </div>
        <AIUsageCounter usage={usage} isPro={userIsPro} />
      </div>

      <FeatureCards isNewUser={isNewUser} locale={locale} />

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="trial_cta"
      />
    </div>
  )
}

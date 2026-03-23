// src/app/[locale]/(app)/bid/page.tsx
'use client'
import { useTranslations } from 'next-intl'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { UnifiedAIChat } from '@/components/bid/unified-ai-chat'

export default function BidPage() {
  const t = useTranslations('bid')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage, refresh: refreshUsage } = useAIUsage(user?.uid ?? null)

  if (!profile || !user || !usage) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-navy/5 rounded-xl animate-pulse" />
        <div className="h-64 bg-navy/5 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-48 desktop:pb-28">
      {/* Header — same pattern as Tenders / Orders */}
      <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>

      <UnifiedAIChat
        profile={profile}
        usage={usage}
        onUsageUpdate={refreshUsage}
        tenderCount={tenders.length}
        tenders={tenders}
      />
    </div>
  )
}

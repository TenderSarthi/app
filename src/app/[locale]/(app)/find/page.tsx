'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { StateFilter, CategoryFilter } from '@/components/finder/state-category-filters'
import { GemDeeplinkButton } from '@/components/finder/gem-deeplink-button'
import { AISummarizer } from '@/components/finder/ai-summarizer'
import { AlgoliaSearch } from '@/components/finder/algolia-search'

export default function FindPage() {
  const t = useTranslations('finder')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage, refresh: refreshUsage } = useAIUsage(user?.uid ?? null)

  const [selectedState, setSelectedState] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Initialize filters from profile (first render after profile loads)
  // We use a ref to only init once
  const [filtersInitialized, setFiltersInitialized] = useState(false)

  useEffect(() => {
    if (profile && !filtersInitialized) {
      setSelectedState(profile.state || 'all')
      setSelectedCategories(profile.categories)
      setFiltersInitialized(true)
    }
  }, [profile, filtersInitialized])

  if (!profile || !user) return null

  return (
    <div className="space-y-6 pb-20 desktop:pb-6">
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
        <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
      </div>

      {/* Saved tender search */}
      <AlgoliaSearch uid={user.uid} />

      {/* Filters */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-navy uppercase tracking-wide">{t('filtersTitle')}</h2>
        <StateFilter value={selectedState || 'all'} onChange={setSelectedState} />
        <CategoryFilter selected={selectedCategories} onChange={setSelectedCategories} />
        <GemDeeplinkButton state={selectedState || 'all'} categories={selectedCategories} />
      </div>

      {/* AI Summarizer */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-navy uppercase tracking-wide">{t('aiTitle')}</h2>
        <AISummarizer
          uid={user.uid}
          profile={profile}
          usage={usage}
          onUsageUpdate={refreshUsage}
          tenderCount={tenders.length}
          language={profile.language}
        />
      </div>
    </div>
  )
}

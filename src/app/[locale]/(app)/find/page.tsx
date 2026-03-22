// src/app/[locale]/(app)/find/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { StateFilter, CategoryFilter } from '@/components/finder/state-category-filters'
import { GemDeeplinkButton } from '@/components/finder/gem-deeplink-button'
import { AISummarizer } from '@/components/finder/ai-summarizer'
import { GemLiveFeed } from '@/components/finder/gem-live-feed'

export default function FindPage() {
  const t = useTranslations('finder')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage, refresh: refreshUsage } = useAIUsage(user?.uid ?? null)

  const [selectedState, setSelectedState]           = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  const [summarizerOpen, setSummarizerOpen]         = useState(false)

  // Seed filters from profile once on first load — do not remove
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

      {/* Compact filter rows — AlgoliaSearch removed (lives on Tenders page) */}
      <div className="space-y-2">
        {/* Row 1: state picker + GeM deeplink side by side */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <StateFilter value={selectedState || 'all'} onChange={setSelectedState} />
          </div>
          <GemDeeplinkButton state={selectedState || 'all'} categories={selectedCategories} />
        </div>

        {/* Row 2: category pills — show 8 of 20, rest as "+N more" badge */}
        <CategoryFilter
          selected={selectedCategories}
          onChange={setSelectedCategories}
          maxVisible={8}
        />
      </div>

      {/* Live government tenders feed — primary content */}
      <GemLiveFeed
        state={selectedState}
        categories={selectedCategories}
        profile={profile}
        tenderCount={tenders.length}
      />

      {/* AI Summarizer — collapsed by default */}
      <div className="border border-navy/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setSummarizerOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-navy/5 transition-colors"
          aria-expanded={summarizerOpen}
          aria-controls="ai-summarizer-panel"
        >
          <span className="text-sm font-semibold text-navy">
            🤖 {t('aiTitle')}
          </span>
          {summarizerOpen
            ? <ChevronUp size={16} className="text-muted" aria-hidden="true" />
            : <ChevronDown size={16} className="text-muted" aria-hidden="true" />
          }
        </button>

        <div
          id="ai-summarizer-panel"
          className={summarizerOpen ? 'px-4 pb-4 pt-2' : 'hidden'}
        >
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
    </div>
  )
}

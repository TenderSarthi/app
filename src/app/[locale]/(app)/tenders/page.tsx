// src/app/[locale]/(app)/tenders/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
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
import { AlgoliaSearch } from '@/components/finder/algolia-search'
import { TenderFilters, applyTenderFilters, DEFAULT_FILTERS } from '@/components/tenders/tender-filters'
import { TenderList } from '@/components/tenders/tender-list'
import { TenderFab } from '@/components/tenders/tender-fab'
import { isPro } from '@/lib/plan-guard'
import type { TenderFilterState } from '@/components/tenders/tender-filters'

type Segment = 'discover' | 'saved'

export default function TendersPage() {
  const tT = useTranslations('tenders')
  const tF = useTranslations('finder')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders, loading } = useUserTenders(user?.uid ?? null)
  const { usage, refresh: refreshUsage } = useAIUsage(user?.uid ?? null)

  // ── Segment ──────────────────────────────────────────────────────────────
  const [segment, setSegment] = useState<Segment>('discover')

  // ── Discover tab state ────────────────────────────────────────────────────
  const [selectedState, setSelectedState]           = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  const [summarizerOpen, setSummarizerOpen]         = useState(false)

  // ── Saved tab state ───────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TenderFilterState>(DEFAULT_FILTERS)

  const userIsPro = profile ? isPro(profile) : false

  // Seed discover filters from profile once on first load — do not remove
  useEffect(() => {
    if (profile && !filtersInitialized) {
      setSelectedState(profile.state || 'all')
      setSelectedCategories(profile.categories)
      setFiltersInitialized(true)
    }
  }, [profile, filtersInitialized])

  const availableCategories = useMemo(
    () => [...new Set(tenders.map(t => t.category).filter(Boolean))].sort() as string[],
    [tenders]
  )
  const availableStates = useMemo(
    () => [...new Set(tenders.map(t => t.state).filter(Boolean))].sort() as string[],
    [tenders]
  )
  const filteredTenders = useMemo(
    () => applyTenderFilters(tenders, filters),
    [tenders, filters]
  )

  if (!profile || !user) {
    return (
      <div className="space-y-4">
        <div className="h-11 bg-navy/5 rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-navy/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">

      {/* ── Segment control ──────────────────────────────────── */}
      <div className="flex gap-1 bg-navy/5 p-1 rounded-xl">
        {(['discover', 'saved'] as Segment[]).map(seg => (
          <button
            key={seg}
            onClick={() => setSegment(seg)}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              segment === seg ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy',
            ].join(' ')}
          >
            {seg === 'discover' ? tT('segDiscover') : tT('segSaved')}
          </button>
        ))}
      </div>

      {/* ── Discover tab ─────────────────────────────────────── */}
      {/* Kept mounted (hidden) to preserve GemLiveFeed data between tab switches */}
      <div className={segment === 'discover' ? 'space-y-4' : 'hidden'}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <StateFilter value={selectedState || 'all'} onChange={setSelectedState} />
            </div>
            <GemDeeplinkButton state={selectedState || 'all'} categories={selectedCategories} />
          </div>
          <CategoryFilter
            selected={selectedCategories}
            onChange={setSelectedCategories}
            maxVisible={8}
          />
        </div>

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
            <span className="text-sm font-semibold text-navy">🤖 {tF('aiTitle')}</span>
            {summarizerOpen
              ? <ChevronUp  size={16} className="text-muted" aria-hidden="true" />
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

      {/* ── Saved tab ────────────────────────────────────────── */}
      {/* Kept mounted (hidden) to preserve AlgoliaSearch state */}
      <div className={segment === 'saved' ? 'space-y-4' : 'hidden'}>
        <AlgoliaSearch uid={user.uid} />

        {tenders.length > 0 && (
          <TenderFilters
            filters={filters}
            onChange={setFilters}
            availableCategories={availableCategories}
            availableStates={availableStates}
          />
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-navy/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <TenderList
            tenders={filteredTenders}
            totalCount={tenders.length}
            isPro={userIsPro}
          />
        )}
      </div>

      {/* FAB — only meaningful on Saved tab */}
      {segment === 'saved' && (
        <TenderFab uid={user.uid} profile={profile} currentTenderCount={tenders.length} />
      )}

    </div>
  )
}

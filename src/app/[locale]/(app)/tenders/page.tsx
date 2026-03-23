// src/app/[locale]/(app)/tenders/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal, X } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { GemDeeplinkButton } from '@/components/finder/gem-deeplink-button'
import { GemLiveFeed } from '@/components/finder/gem-live-feed'
import { StateFilter, CategoryFilter } from '@/components/finder/state-category-filters'

export default function TendersPage() {
  const tT = useTranslations('tenders')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders } = useUserTenders(user?.uid ?? null)

  const [filterOpen, setFilterOpen]                   = useState(false)
  const [selectedState, setSelectedState]             = useState<string>('')
  const [selectedCategories, setSelectedCategories]   = useState<string[]>([])
  const [filtersInitialized, setFiltersInitialized]   = useState(false)

  // Seed from profile once — do not remove
  useEffect(() => {
    if (profile && !filtersInitialized) {
      setSelectedState(profile.state || 'all')
      setSelectedCategories(profile.categories)
      setFiltersInitialized(true)
    }
  }, [profile, filtersInitialized])

  const activeFilterCount =
    (selectedState && selectedState !== 'all' ? 1 : 0) + selectedCategories.length

  if (!profile || !user) {
    return (
      <div className="space-y-4">
        <div className="h-11 bg-navy/5 rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-navy/5 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-32 desktop:pb-6">

      {/* Filter + GeM row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterOpen(true)}
          aria-label="Open filters"
          className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-navy/20 bg-white text-navy text-sm font-medium hover:border-navy/40 transition-colors shrink-0"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          {activeFilterCount === 0
            ? tT('filters')
            : <span className="flex items-center gap-1">{tT('filters')} <span className="w-4 h-4 rounded-full bg-orange text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span></span>
          }
        </button>

        <div className="flex-1" />

        <GemDeeplinkButton state={selectedState || 'all'} categories={selectedCategories} />
      </div>

      {/* Live feed */}
      <GemLiveFeed
        state={selectedState}
        categories={selectedCategories}
        profile={profile}
        tenderCount={tenders.length}
      />

      {/* Filter sheet */}
      <Sheet open={filterOpen} onOpenChange={(v) => { if (!v) setFilterOpen(false) }}>
        <SheetContent side="bottom" showCloseButton={false} className="px-4 pb-8 pt-3 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetTitle className="sr-only">{tT('filters')}</SheetTitle>
          <div className="w-10 h-1 rounded bg-gray-200 mx-auto mb-5" />

          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-semibold text-navy text-base">{tT('filters')}</h2>
            <button onClick={() => setFilterOpen(false)} className="p-1.5 rounded-lg text-muted hover:text-navy hover:bg-navy/5 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">{tT('filterState')}</p>
              <StateFilter value={selectedState || 'all'} onChange={setSelectedState} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">{tT('filterCategory')}</p>
              <CategoryFilter selected={selectedCategories} onChange={setSelectedCategories} />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => { setSelectedState(profile.state || 'all'); setSelectedCategories(profile.categories) }}
              className="flex-1 py-2.5 rounded-xl border border-navy/20 text-navy text-sm font-medium hover:bg-navy/5 transition-colors"
            >
              {tT('resetFilters')}
            </button>
            <button
              onClick={() => setFilterOpen(false)}
              className="flex-1 py-2.5 rounded-xl bg-navy text-white text-sm font-semibold hover:bg-navy/90 transition-colors"
            >
              {tT('applyFilters')}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

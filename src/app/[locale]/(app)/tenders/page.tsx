// src/app/[locale]/(app)/tenders/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal, X } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { GemDeeplinkButton } from '@/components/finder/gem-deeplink-button'
import { GemLiveFeed } from '@/components/finder/gem-live-feed'
import { AlgoliaSearch } from '@/components/finder/algolia-search'
import { StateFilter, CategoryFilter } from '@/components/finder/state-category-filters'
import { applyTenderFilters, DEFAULT_FILTERS } from '@/components/tenders/tender-filters'
import { TenderList } from '@/components/tenders/tender-list'
import { TenderFab } from '@/components/tenders/tender-fab'
import { isPro } from '@/lib/plan-guard'
import type { TenderFilterState } from '@/components/tenders/tender-filters'
import type { TenderStatus } from '@/lib/types'

type Segment = 'discover' | 'saved'

const STATUS_OPTIONS: { value: TenderStatus | 'all'; label: string }[] = [
  { value: 'all',     label: 'All'     },
  { value: 'active',  label: 'Active'  },
  { value: 'won',     label: 'Won'     },
  { value: 'lost',    label: 'Lost'    },
  { value: 'expired', label: 'Expired' },
]

export default function TendersPage() {
  const tT = useTranslations('tenders')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders, loading } = useUserTenders(user?.uid ?? null)

  // ── Segment ──────────────────────────────────────────────────────────────
  const [segment, setSegment] = useState<Segment>('discover')

  // ── Filter sheet ─────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false)

  // ── Discover tab state ────────────────────────────────────────────────────
  const [selectedState, setSelectedState]           = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [filtersInitialized, setFiltersInitialized] = useState(false)

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

  // Active filter counts for badge
  const discoverActiveFilterCount =
    (selectedState && selectedState !== 'all' ? 1 : 0) + selectedCategories.length
  const savedActiveFilterCount =
    (filters.status !== 'all' ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.state ? 1 : 0)
  const activeFilterCount = segment === 'discover' ? discoverActiveFilterCount : savedActiveFilterCount

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
    <div className="space-y-3 pb-32 desktop:pb-6">

      {/* ── Search bar (always visible, searches saved tenders) ──────── */}
      <AlgoliaSearch uid={user.uid} />

      {/* ── Segment control + Filter button row ─────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1 bg-navy/5 p-1 rounded-xl">
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

        {/* Filter button */}
        <button
          onClick={() => setFilterOpen(true)}
          aria-label="Open filters"
          className="relative flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-navy/20 bg-white text-navy text-sm font-medium hover:border-navy/40 transition-colors shrink-0"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          {activeFilterCount === 0
            ? tT('filters')
            : <span className="flex items-center gap-1">{tT('filters')} <span className="w-4 h-4 rounded-full bg-orange text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span></span>
          }
        </button>

        {/* GeM deeplink — only visible on Discover segment */}
        {segment === 'discover' && (
          <GemDeeplinkButton state={selectedState || 'all'} categories={selectedCategories} />
        )}
      </div>

      {/* ── Discover tab ─────────────────────────────────────── */}
      {/* Kept mounted (hidden) to preserve GemLiveFeed data between tab switches */}
      <div className={segment === 'discover' ? 'space-y-4' : 'hidden'}>
        <GemLiveFeed
          state={selectedState}
          categories={selectedCategories}
          profile={profile}
          tenderCount={tenders.length}
        />
      </div>

      {/* ── Saved tab ────────────────────────────────────────── */}
      {/* Kept mounted (hidden) to preserve AlgoliaSearch state */}
      <div className={segment === 'saved' ? 'space-y-4' : 'hidden'}>
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

      {/* ── Filter sheet ─────────────────────────────────────── */}
      <Sheet open={filterOpen} onOpenChange={(v) => { if (!v) setFilterOpen(false) }}>
        <SheetContent side="bottom" showCloseButton={false} className="px-4 pb-8 pt-3 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetTitle className="sr-only">{tT('filters')}</SheetTitle>

          {/* Drag handle */}
          <div className="w-10 h-1 rounded bg-gray-200 mx-auto mb-5" />

          {/* Sheet header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-semibold text-navy text-base">{tT('filters')}</h2>
            <button
              onClick={() => setFilterOpen(false)}
              className="p-1.5 rounded-lg text-muted hover:text-navy hover:bg-navy/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Discover filters ─────────────────────────────── */}
          {segment === 'discover' && (
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
          )}

          {/* ── Saved filters ────────────────────────────────── */}
          {segment === 'saved' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">{tT('filterStatus')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilters(f => ({ ...f, status: opt.value }))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        filters.status === opt.value
                          ? 'bg-navy text-white border-navy'
                          : 'bg-white text-navy border-navy/20 hover:border-navy',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {availableCategories.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">{tT('filterCategory')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setFilters(f => ({ ...f, category: '' }))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        filters.category === ''
                          ? 'bg-navy text-white border-navy'
                          : 'bg-white text-navy border-navy/20 hover:border-navy',
                      ].join(' ')}
                    >
                      {tT('allCategories')}
                    </button>
                    {availableCategories.map(c => (
                      <button
                        key={c}
                        onClick={() => setFilters(f => ({ ...f, category: c }))}
                        className={[
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                          filters.category === c
                            ? 'bg-navy text-white border-navy'
                            : 'bg-white text-navy border-navy/20 hover:border-navy',
                        ].join(' ')}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableStates.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">{tT('filterState')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setFilters(f => ({ ...f, state: '' }))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        filters.state === ''
                          ? 'bg-navy text-white border-navy'
                          : 'bg-white text-navy border-navy/20 hover:border-navy',
                      ].join(' ')}
                    >
                      {tT('allStates')}
                    </button>
                    {availableStates.map(s => (
                      <button
                        key={s}
                        onClick={() => setFilters(f => ({ ...f, state: s }))}
                        className={[
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                          filters.state === s
                            ? 'bg-navy text-white border-navy'
                            : 'bg-white text-navy border-navy/20 hover:border-navy',
                        ].join(' ')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reset + Apply */}
          <div className="flex gap-3 mt-8">
            <button
              onClick={() => {
                if (segment === 'discover') {
                  setSelectedState(profile.state || 'all')
                  setSelectedCategories(profile.categories)
                } else {
                  setFilters(DEFAULT_FILTERS)
                }
              }}
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

// src/app/[locale]/(app)/saved/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal, X } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AlgoliaSearch } from '@/components/finder/algolia-search'
import { applyTenderFilters, DEFAULT_FILTERS } from '@/components/tenders/tender-filters'
import { TenderList } from '@/components/tenders/tender-list'
import { TenderFab } from '@/components/tenders/tender-fab'
import { isPro } from '@/lib/plan-guard'
import type { TenderFilterState } from '@/components/tenders/tender-filters'
import type { TenderStatus } from '@/lib/types'

type StatusOption = TenderStatus | 'all'

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: 'all',     label: 'All'     },
  { value: 'active',  label: 'Active'  },
  { value: 'won',     label: 'Won'     },
  { value: 'lost',    label: 'Lost'    },
  { value: 'expired', label: 'Expired' },
]

export default function SavedPage() {
  const tT = useTranslations('tenders')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders, loading } = useUserTenders(user?.uid ?? null)

  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters]       = useState<TenderFilterState>(DEFAULT_FILTERS)

  const userIsPro = profile ? isPro(profile) : false

  const availableCategories = useMemo(
    () => [...new Set(tenders.map(t => t.category).filter(Boolean))].sort() as string[],
    [tenders]
  )
  const availableStates = useMemo(
    () => [...new Set(tenders.map(t => t.state).filter(Boolean))].sort() as string[],
    [tenders]
  )
  const filteredTenders = useMemo(() => applyTenderFilters(tenders, filters), [tenders, filters])

  const activeFilterCount =
    (filters.status !== 'all' ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.state ? 1 : 0)

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

      {/* Search */}
      <AlgoliaSearch uid={user.uid} />

      {/* Filter button */}
      {tenders.length > 0 && (
        <button
          onClick={() => setFilterOpen(true)}
          aria-label="Open filters"
          className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-navy/20 bg-white text-navy text-sm font-medium hover:border-navy/40 transition-colors"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          {activeFilterCount === 0
            ? tT('filters')
            : <span className="flex items-center gap-1">{tT('filters')} <span className="w-4 h-4 rounded-full bg-orange text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span></span>
          }
        </button>
      )}

      {/* Tender list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-navy/5 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <TenderList tenders={filteredTenders} totalCount={tenders.length} isPro={userIsPro} />
      )}

      <TenderFab uid={user.uid} profile={profile} currentTenderCount={tenders.length} />

      {/* Filter sheet */}
      <Sheet open={filterOpen} onOpenChange={(v) => { if (!v) setFilterOpen(false) }}>
        <SheetContent side="bottom" showCloseButton={false} className="px-4 pb-8 pt-3 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetTitle className="sr-only">{tT('filters')}</SheetTitle>
          <div className="w-10 h-1 rounded bg-navy/10 mx-auto mb-5" />

          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-semibold text-navy text-base">{tT('filters')}</h2>
            <button onClick={() => setFilterOpen(false)} className="p-1.5 rounded-lg text-muted hover:text-navy hover:bg-navy/5 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-5">
            {/* Status */}
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

            {/* Category */}
            {availableCategories.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">{tT('filterCategory')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {['', ...availableCategories].map(c => (
                    <button
                      key={c || '__all'}
                      onClick={() => setFilters(f => ({ ...f, category: c }))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        filters.category === c
                          ? 'bg-navy text-white border-navy'
                          : 'bg-white text-navy border-navy/20 hover:border-navy',
                      ].join(' ')}
                    >
                      {c || tT('allCategories')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* State */}
            {availableStates.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">{tT('filterState')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {['', ...availableStates].map(s => (
                    <button
                      key={s || '__all'}
                      onClick={() => setFilters(f => ({ ...f, state: s }))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        filters.state === s
                          ? 'bg-navy text-white border-navy'
                          : 'bg-white text-navy border-navy/20 hover:border-navy',
                      ].join(' ')}
                    >
                      {s || tT('allStates')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
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

'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { AlgoliaSearch } from '@/components/finder/algolia-search'
import { TenderFilters, applyTenderFilters, DEFAULT_FILTERS } from '@/components/tenders/tender-filters'
import { TenderList } from '@/components/tenders/tender-list'
import { TenderFab } from '@/components/tenders/tender-fab'
import { isPro } from '@/lib/plan-guard'
import type { TenderFilterState } from '@/components/tenders/tender-filters'

export default function TendersPage() {
  const t = useTranslations('tenders')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders, loading } = useUserTenders(user?.uid ?? null)
  const [filters, setFilters] = useState<TenderFilterState>(DEFAULT_FILTERS)

  const userIsPro = profile ? isPro(profile) : false

  const availableCategories = useMemo(
    () => [...new Set(tenders.map(tender => tender.category).filter(Boolean))].sort() as string[],
    [tenders]
  )
  const availableStates = useMemo(
    () => [...new Set(tenders.map(tender => tender.state).filter(Boolean))].sort() as string[],
    [tenders]
  )
  const filteredTenders = useMemo(
    () => applyTenderFilters(tenders, filters),
    [tenders, filters]
  )

  if (!profile || !user) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-40 bg-navy/5 rounded-lg animate-pulse" />
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
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('subtitle')}</p>
      </div>

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

      <TenderFab uid={user.uid} profile={profile} currentTenderCount={tenders.length} />
    </div>
  )
}

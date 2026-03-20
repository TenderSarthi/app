'use client'

import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import type { TenderStatus, Tender } from '@/lib/types'

export interface TenderFilterState {
  status: TenderStatus | 'all'
  category: string
  state: string
}

export const DEFAULT_FILTERS: TenderFilterState = { status: 'all', category: '', state: '' }

interface TenderFiltersProps {
  filters: TenderFilterState
  onChange: (f: TenderFilterState) => void
  availableCategories: string[]
  availableStates: string[]
}

const STATUS_OPTIONS: { value: TenderStatus | 'all'; label: string }[] = [
  { value: 'all',     label: 'All'     },
  { value: 'active',  label: 'Active'  },
  { value: 'won',     label: 'Won'     },
  { value: 'lost',    label: 'Lost'    },
  { value: 'expired', label: 'Expired' },
]

export function TenderFilters({ filters, onChange, availableCategories, availableStates }: TenderFiltersProps) {
  const t = useTranslations('tenders')
  const isFiltered = filters.status !== 'all' || filters.category !== '' || filters.state !== ''

  return (
    <div className="space-y-2">
      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, status: opt.value })}
            className={[
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              filters.status === opt.value
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-navy border-navy/20 hover:border-navy',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {(availableCategories.length > 1 || availableStates.length > 1 || isFiltered) && (
        <div className="flex gap-2 flex-wrap items-center">
          {availableCategories.length > 1 && (
            <select
              value={filters.category}
              onChange={e => onChange({ ...filters, category: e.target.value })}
              className="text-sm border border-navy/20 rounded-lg px-2 py-1.5 text-navy bg-white"
            >
              <option value="">{t('allCategories')}</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {availableStates.length > 1 && (
            <select
              value={filters.state}
              onChange={e => onChange({ ...filters, state: e.target.value })}
              className="text-sm border border-navy/20 rounded-lg px-2 py-1.5 text-navy bg-white"
            >
              <option value="">{t('allStates')}</option>
              {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {isFiltered && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="flex items-center gap-1 text-sm text-muted hover:text-navy"
            >
              <X size={14} />{t('clearFilters')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Pure filter: apply filter state to a tender array. */
export function applyTenderFilters(tenders: Tender[], filters: TenderFilterState): Tender[] {
  return tenders.filter(tender => {
    if (filters.status !== 'all' && tender.status !== filters.status) return false
    if (filters.category && tender.category !== filters.category) return false
    if (filters.state && tender.state !== filters.state) return false
    return true
  })
}

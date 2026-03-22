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

      {availableCategories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => onChange({ ...filters, category: '' })}
            className={[
              'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              filters.category === ''
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-navy border-navy/20 hover:border-navy',
            ].join(' ')}
          >
            {t('allCategories')}
          </button>
          {availableCategories.map(c => (
            <button
              key={c}
              onClick={() => onChange({ ...filters, category: c })}
              className={[
                'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                filters.category === c
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-navy border-navy/20 hover:border-navy',
              ].join(' ')}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {availableStates.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => onChange({ ...filters, state: '' })}
            className={[
              'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              filters.state === ''
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-navy border-navy/20 hover:border-navy',
            ].join(' ')}
          >
            {t('allStates')}
          </button>
          {availableStates.map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, state: s })}
              className={[
                'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                filters.state === s
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-navy border-navy/20 hover:border-navy',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {isFiltered && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="flex items-center gap-1 text-xs text-muted hover:text-navy self-start"
        >
          <X size={13} />{t('clearFilters')}
        </button>
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

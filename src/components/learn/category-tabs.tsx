'use client'

import type { ArticleCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

// TODO: i18n — replace hardcoded strings once learn namespace is added (Task 6)

type FilterCategory = ArticleCategory | 'all'

interface CategoryTabsProps {
  active: FilterCategory
  onChange: (category: FilterCategory) => void
  counts: Record<FilterCategory, number>
}

const TABS: { value: FilterCategory; label: string }[] = [
  { value: 'all',                label: 'All' },
  { value: 'getting_started',    label: 'Getting Started' },
  { value: 'bidding_strategy',   label: 'Bidding Strategy' },
  { value: 'finance_compliance', label: 'Finance' },
  { value: 'post_win',           label: 'Post Win' },
]

export function CategoryTabs({ active, onChange, counts }: CategoryTabsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4"
      role="tablist"
      aria-label="Article categories"
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
            active === tab.value
              ? 'bg-navy text-white'
              : 'bg-white text-muted border border-navy/10 hover:border-navy/30'
          )}
        >
          {tab.label}{/* TODO: i18n */}
          {counts[tab.value] !== undefined && (
            <span className={cn(
              'ml-1',
              active === tab.value ? 'opacity-70' : 'opacity-50'
            )}>
              ({counts[tab.value]})
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

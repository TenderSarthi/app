'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { INDIAN_STATES, GEM_CATEGORIES } from '@/lib/constants'

interface StateFilterProps {
  value: string
  onChange: (state: string) => void
}

export function StateFilter({ value, onChange }: StateFilterProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-navy/20 rounded-full pl-3.5 pr-8 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 transition-colors"
      >
        <option value="all">All States</option>
        {INDIAN_STATES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  )
}

interface CategoryFilterProps {
  selected: string[]
  onChange: (cats: string[]) => void
  maxVisible?: number
}

export function CategoryFilter({ selected, onChange, maxVisible }: CategoryFilterProps) {
  const [expanded, setExpanded] = useState(false)

  const toggle = (cat: string) => {
    onChange(
      selected.includes(cat)
        ? selected.filter(c => c !== cat)
        : [...selected, cat]
    )
  }

  const limit = expanded ? GEM_CATEGORIES.length : (maxVisible ?? GEM_CATEGORIES.length)
  const visible = GEM_CATEGORIES.slice(0, limit)
  const hiddenCount = GEM_CATEGORIES.length - visible.length

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map(cat => {
        const active = selected.includes(cat)
        return (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            className={[
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              active
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-navy border-navy/25 hover:border-navy',
            ].join(' ')}
          >
            {cat}
          </button>
        )
      })}

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="px-2.5 py-1 bg-navy/8 text-navy/60 rounded-full text-xs font-medium border border-navy/15 hover:bg-navy/10 transition-colors"
        >
          +{hiddenCount} more
        </button>
      )}
      {expanded && maxVisible !== undefined && (
        <button
          onClick={() => setExpanded(false)}
          className="px-2.5 py-1 bg-navy/8 text-navy/60 rounded-full text-xs font-medium border border-navy/15 hover:bg-navy/10 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  )
}

'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { INDIAN_STATES, GEM_CATEGORIES } from '@/lib/constants'

interface StateFilterProps {
  value: string
  onChange: (state: string) => void
}

export function StateFilter({ value, onChange }: StateFilterProps) {
  return (
    <Select value={value} onValueChange={(v: string | null) => { if (v) onChange(v) }}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="State चुनें" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All States</SelectItem>
        {INDIAN_STATES.map(s => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface CategoryFilterProps {
  selected: string[]
  onChange: (cats: string[]) => void
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const toggle = (cat: string) => {
    onChange(
      selected.includes(cat)
        ? selected.filter(c => c !== cat)
        : [...selected, cat]
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {GEM_CATEGORIES.map(cat => {
        const active = selected.includes(cat)
        return (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            className={[
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors min-h-[36px]',
              active
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-navy border-navy/30 hover:border-navy',
            ].join(' ')}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}

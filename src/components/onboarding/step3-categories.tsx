'use client'
import { GEM_CATEGORIES, type GeMCategory } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props { selected: string[]; onChange: (cats: string[]) => void }

export function Step3Categories({ selected, onChange }: Props) {
  const toggle = (cat: GeMCategory) =>
    onChange(selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat])
  return (
    <div className="flex flex-wrap gap-2">
      {GEM_CATEGORIES.map((cat) => (
        <button key={cat} type="button" onClick={() => toggle(cat)}
          className={cn('px-3 py-2 rounded-full text-sm border transition-colors min-h-[44px]',
            selected.includes(cat) ? 'bg-orange text-white border-orange font-medium' : 'bg-white text-gray-700 border-gray-300 hover:border-orange')}>
          {cat}
        </button>
      ))}
    </div>
  )
}

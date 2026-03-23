'use client'

import { ExternalLink } from 'lucide-react'
import { buildGemUrl } from '@/lib/gem-links'

interface GemDeeplinkButtonProps {
  state: string
  categories: string[]
}

export function GemDeeplinkButton({ state, categories }: GemDeeplinkButtonProps) {
  const category = categories[0]
  const url = buildGemUrl({
    state: state !== 'all' ? state : undefined,
    category: category || undefined,
  })

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-orange/25 bg-orange/5 text-orange text-sm font-medium hover:border-orange/40 hover:bg-orange/10 transition-colors"
    >
      <ExternalLink size={13} aria-hidden="true" />
      GeM
    </a>
  )
}

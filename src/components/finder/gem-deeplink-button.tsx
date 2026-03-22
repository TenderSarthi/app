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
      className="shrink-0 flex items-center gap-1.5 bg-navy text-white rounded-full px-3.5 py-2 text-sm font-medium hover:bg-navy/90 transition-colors"
    >
      <ExternalLink size={13} aria-hidden="true" />
      GeM
    </a>
  )
}

'use client'

import { ExternalLink } from 'lucide-react'
import { buildGemUrl } from '@/lib/gem-links'
import { Button } from '@/components/ui/button'

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
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Button className="bg-navy text-white hover:bg-navy/90 flex items-center gap-2 w-full tablet:w-auto">
        <ExternalLink size={16} />
        GeM पर देखें
      </Button>
    </a>
  )
}

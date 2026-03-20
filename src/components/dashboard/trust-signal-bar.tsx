'use client'

import { Trophy } from 'lucide-react'
import type { PlatformStats } from '@/lib/types'

interface TrustSignalBarProps {
  stats: PlatformStats | null
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN')
}

export function TrustSignalBar({ stats }: TrustSignalBarProps) {
  const vendorCount  = stats ? fmt(stats.vendorCount)  : '—'
  const tendersFiled = stats ? fmt(stats.tendersFiled) : '—'
  const tendersWon   = stats ? fmt(stats.tendersWon)   : '—'

  return (
    <div className="bg-navy/5 border border-navy/10 rounded-xl px-4 py-3 flex items-center gap-2 text-sm flex-wrap">
      <Trophy className="text-gold shrink-0" size={16} />
      <span className="text-navy font-medium">
        {vendorCount}+ vendors
      </span>
      <span className="text-muted">•</span>
      <span className="text-navy font-medium">
        {tendersFiled} tenders filed
      </span>
      <span className="text-muted">•</span>
      <span className="text-navy font-medium">
        {tendersWon} won
      </span>
    </div>
  )
}

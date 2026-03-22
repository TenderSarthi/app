'use client'

import { Users, FileText, Trophy } from 'lucide-react'
import type { PlatformStats } from '@/lib/types'

interface TrustSignalBarProps {
  stats: PlatformStats | null
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('en-IN')
}

export function TrustSignalBar({ stats }: TrustSignalBarProps) {
  const items = [
    { icon: Users,    value: stats ? `${fmt(stats.vendorCount)}+` : '—', label: 'Vendors', color: 'text-navy',    bg: 'bg-navy/8'    },
    { icon: FileText, value: stats ? fmt(stats.tendersFiled)       : '—', label: 'Filed',   color: 'text-orange', bg: 'bg-orange/10' },
    { icon: Trophy,   value: stats ? fmt(stats.tendersWon)         : '—', label: 'Won',     color: 'text-gold',   bg: 'bg-gold/10'   },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ icon: Icon, value, label, color, bg }) => (
        <div key={label} className="bg-white border border-navy/10 rounded-xl p-3 text-center shadow-sm">
          <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1`}>
            <Icon size={14} className={color} aria-hidden="true" />
          </div>
          <p className="text-base font-bold text-navy leading-tight">{value}</p>
          <p className="text-[10px] text-muted mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  )
}

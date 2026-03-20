'use client'
import { Target } from 'lucide-react'
import type { WinScoreResult } from '@/lib/bid-utils'
import { useTranslations } from 'next-intl'

interface WinProbabilityCardProps {
  result: WinScoreResult
  reasoning?: string
  onGenerate: () => void
  generating: boolean
}

export function WinProbabilityCard({ result, reasoning, onGenerate, generating }: WinProbabilityCardProps) {
  const t = useTranslations('bid')
  const bgMap = { high: 'bg-success/5 border-success/20', medium: 'bg-orange/5 border-orange/20', low: 'bg-danger/5 border-danger/20' }

  return (
    <div className={`border rounded-xl p-5 space-y-4 ${bgMap[result.tier]}`}>
      <div className="flex items-center gap-3">
        <Target size={24} className={result.color} />
        <div>
          <p className="text-sm text-muted">{t('winProbability')}</p>
          <p className={`text-2xl font-bold ${result.color}`}>{result.score}% — {result.label}</p>
        </div>
      </div>
      {reasoning && <p className="text-xs text-muted">{reasoning}</p>}
      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full py-3 rounded-xl bg-navy text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generating ? t('generating') : t('generateBidDoc')}
      </button>
    </div>
  )
}

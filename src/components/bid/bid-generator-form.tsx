'use client'
import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { WinProbabilityCard } from './win-probability-card'
import { computeHeuristicScore } from '@/lib/bid-utils'
import type { Tender } from '@/lib/types'
import type { UserProfile } from '@/lib/types'

interface BidGeneratorFormProps {
  profile: UserProfile
  tenders: Tender[]
  onGenerate: (data: GenerateData) => void
  generating: boolean
}

export interface GenerateData {
  tender: Tender
  experienceYears: number
  pastContracts: string
  capacity: string
  quotedRate: string
}

export function BidGeneratorForm({ profile, tenders, onGenerate, generating }: BidGeneratorFormProps) {
  const t = useTranslations('bid')
  const [selectedTenderId, setSelectedTenderId] = useState('')
  const [experienceYears, setExperience]        = useState(String(profile.experienceYears ?? ''))
  const [pastContracts, setPastContracts]        = useState('')
  const [capacity, setCapacity]                  = useState('')
  const [quotedRate, setQuotedRate]              = useState('')
  const [showScore, setShowScore]                = useState(false)

  const selectedTender = tenders.find(t => t.id === selectedTenderId) ?? null

  const heuristicScore = useMemo(() => {
    if (!selectedTender) return null
    return computeHeuristicScore({
      experienceYears: Number(experienceYears) || null,
      tenderCategory: selectedTender.category,
      userCategories: profile.categories,
      userState: profile.state,
      tenderState: selectedTender.state,
    })
  }, [selectedTender, experienceYears, profile])

  const isValid = selectedTender && quotedRate.trim() && capacity.trim()

  const handleEstimate = () => setShowScore(true)
  const handleGenerate = () => {
    if (!selectedTender || !isValid) return
    onGenerate({ tender: selectedTender, experienceYears: Number(experienceYears) || 0,
      pastContracts, capacity, quotedRate })
  }

  const activeTenders = tenders.filter(t => t.status === 'active')

  return (
    <div className="space-y-4">
      {/* Tender select */}
      <div>
        <label className="block text-sm font-medium text-navy mb-1">{t('selectTender')}</label>
        {activeTenders.length === 0 ? (
          <p className="text-sm text-muted bg-navy/5 rounded-xl p-3">{t('noActiveTenders')}</p>
        ) : (
          <select value={selectedTenderId} onChange={e => { setSelectedTenderId(e.target.value); setShowScore(false) }}
            className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white">
            <option value="">{t('selectTenderPlaceholder')}</option>
            {activeTenders.map(tender => (
              <option key={tender.id} value={tender.id}>{tender.name}</option>
            ))}
          </select>
        )}
      </div>

      {selectedTender && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-navy mb-1">{t('experienceYears')}</label>
              <input type="number" min="0" max="50" value={experienceYears}
                onChange={e => { setExperience(e.target.value); setShowScore(false) }}
                className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white"
                placeholder="5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy mb-1">{t('quotedRate')}</label>
              <input type="text" value={quotedRate} onChange={e => setQuotedRate(e.target.value)}
                className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white"
                placeholder="₹ 45,000" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('capacity')}</label>
            <input type="text" value={capacity} onChange={e => setCapacity(e.target.value)}
              className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white"
              placeholder={t('capacityPlaceholder')} />
          </div>

          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('pastContracts')}</label>
            <textarea value={pastContracts} onChange={e => setPastContracts(e.target.value)}
              rows={3} placeholder={t('pastContractsPlaceholder')}
              className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white resize-none" />
          </div>

          {/* Show heuristic score or estimate button */}
          {!showScore ? (
            <button onClick={handleEstimate} disabled={!isValid}
              className="w-full py-2.5 rounded-xl border border-navy/20 text-navy text-sm font-medium hover:bg-navy/5 disabled:opacity-40">
              {t('estimateScore')}
            </button>
          ) : heuristicScore && (
            <WinProbabilityCard
              result={heuristicScore}
              onGenerate={handleGenerate}
              generating={generating}
            />
          )}
        </>
      )}
    </div>
  )
}

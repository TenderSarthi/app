'use client'
import { useRef, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useFirebase } from '@/components/providers/firebase-provider'
import { WinProbabilityCard } from './win-probability-card'
import { computeHeuristicScore } from '@/lib/bid-utils'
import { FileUp, Loader2 } from 'lucide-react'
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
  tenderDescription: string
}

export function BidGeneratorForm({ profile, tenders, onGenerate, generating }: BidGeneratorFormProps) {
  const t = useTranslations('bid')
  const { user } = useFirebase()

  const [selectedTenderId,   setSelectedTenderId]  = useState('')
  const [experienceYears,    setExperience]         = useState(String(profile.experienceYears ?? ''))
  const [pastContracts,      setPastContracts]      = useState('')
  const [capacity,           setCapacity]           = useState('')
  const [quotedRate,         setQuotedRate]         = useState('')
  const [tenderDescription,  setTenderDescription]  = useState('')
  const [showScore,          setShowScore]          = useState(false)
  const [extracting,         setExtracting]         = useState(false)
  const [extractError,       setExtractError]       = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

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
    onGenerate({
      tender: selectedTender,
      experienceYears: Number(experienceYears) || 0,
      pastContracts,
      capacity,
      quotedRate,
      tenderDescription,
    })
  }

  // ── PDF / Image → Gemini text extraction ─────────────────────────────
  async function handleFileExtract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!inputRef.current) inputRef.current = e.target
    e.target.value = ''          // reset so same file can be re-uploaded
    if (!file || !user) return

    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) { setExtractError(t('extractError')); return }
    if (file.size > 10 * 1024 * 1024) { setExtractError(t('extractError')); return }

    setExtracting(true)
    setExtractError(null)

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Strip "data:<mimeType>;base64," prefix
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const token = await user.getIdToken()
      const res = await fetch('/api/ai/extract-tender-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, mimeType: file.type }),
      })

      if (!res.ok) throw new Error('extract failed')
      const { text } = await res.json() as { text: string }
      setTenderDescription(text)
    } catch {
      setExtractError(t('extractError'))
    } finally {
      setExtracting(false)
    }
  }

  // fileInputRef passed to the hidden <input> for the upload button
  const inputRef = useRef<HTMLInputElement | null>(null)

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

      {/* Tender description + PDF extract */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-navy">
            {t('tenderDetails')}
            <span className="ml-1 text-xs font-normal text-muted">{t('tenderDetailsHint')}</span>
          </label>
          <button
            type="button"
            disabled={extracting}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs font-medium text-orange hover:text-orange/80 disabled:opacity-50 transition-colors"
          >
            {extracting ? (
              <><Loader2 size={12} className="animate-spin" />{t('extracting')}</>
            ) : (
              <><FileUp size={12} />{t('extractFromPdf')}</>
            )}
          </button>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileExtract}
          />
        </div>

        {extractError && (
          <p className="text-xs text-danger mb-1">{extractError}</p>
        )}

        <textarea
          value={tenderDescription}
          onChange={e => setTenderDescription(e.target.value)}
          rows={4}
          placeholder={t('tenderDetailsPlaceholder')}
          className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white resize-none focus:outline-none focus:ring-2 focus:ring-orange/30"
        />
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

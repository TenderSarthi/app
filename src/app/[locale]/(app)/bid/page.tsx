// src/app/[locale]/(app)/bid/page.tsx
'use client'
import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, Lock } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { isPro, canUseBidGenerator } from '@/lib/plan-guard'
import { UnifiedAIChat } from '@/components/bid/unified-ai-chat'
import { BidGeneratorForm } from '@/components/bid/bid-generator-form'
import { BidDocumentViewer } from '@/components/bid/bid-document-viewer'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { addBidDocument, incrementBidDocCount } from '@/lib/firebase/firestore'
import { getAuth } from 'firebase/auth'
import { track } from '@/lib/posthog'
import type { GenerateData } from '@/components/bid/bid-generator-form'

interface GeneratedResult {
  tenderName: string
  document: string
  winScore: number
  winLabel: string
  winReasoning: string
}

export default function BidPage() {
  const t = useTranslations('bid')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage, refresh: refreshUsage } = useAIUsage(user?.uid ?? null)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [result, setResult]             = useState<GeneratedResult | null>(null)
  const [upgradeOpen, setUpgradeOpen]   = useState(false)
  const [genError, setGenError]         = useState<string | null>(null)

  // Must be declared before any early return (Rules of Hooks)
  const handleGenerate = useCallback(async (data: GenerateData) => {
    if (!profile || !usage || !user) return
    if (!canUseBidGenerator(profile, usage)) { setGenerateOpen(false); setUpgradeOpen(true); return }
    setGenerating(true); setGenError(null); setResult(null)
    try {
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch('/api/ai/generate-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          tenderName: data.tender.name,
          tenderCategory: data.tender.category,
          tenderState: data.tender.state,
          experienceYears: data.experienceYears,
          pastContracts: data.pastContracts,
          capacity: data.capacity,
          quotedRate: data.quotedRate,
          tenderDescription: data.tenderDescription,
          language: profile.language,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? 'Generation failed')
      const { winScore, winLabel, winReasoning, generatedDocument } = await res.json()

      await addBidDocument(user.uid, {
        tenderId: data.tender.id,
        tenderName: data.tender.name,
        tenderCategory: data.tender.category,
        experienceYears: data.experienceYears,
        pastContracts: data.pastContracts,
        capacity: data.capacity,
        quotedRate: data.quotedRate,
        winScore, winLabel,
        generatedDocument,
      })
      await incrementBidDocCount(user.uid)
      refreshUsage()

      setResult({ tenderName: data.tender.name, document: generatedDocument, winScore, winLabel, winReasoning })
      track('bid_document_generated', { category: data.tender.category, winScore })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [profile, usage, user, refreshUsage])

  if (!profile || !user || !usage) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-navy/5 rounded-xl animate-pulse" />
        <div className="h-64 bg-navy/5 rounded-xl animate-pulse" />
      </div>
    )
  }

  const userIsPro = isPro(profile)

  return (
    <div className="flex flex-col pb-20 desktop:pb-0" style={{ height: 'calc(100vh - 80px)' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-0 pb-3 shrink-0">
        <Sparkles size={18} className="text-orange" aria-hidden="true" />
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
      </div>

      {/* Unified chat — fills remaining height */}
      <div className="flex-1 min-h-0">
        <UnifiedAIChat
          profile={profile}
          usage={usage}
          onUsageUpdate={refreshUsage}
          tenderCount={tenders.length}
          onRequestGenerate={() => setGenerateOpen(true)}
        />
      </div>

      {/* ── Bid Generator — bottom sheet ─────────────────────── */}
      <Sheet
        open={generateOpen}
        onOpenChange={(v) => {
          if (!v && !generating) { setGenerateOpen(false); setResult(null); setGenError(null) }
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="px-4 pb-8 pt-3 rounded-t-2xl max-h-[92vh] overflow-y-auto"
        >
          <SheetTitle className="sr-only">{t('generatorTab')}</SheetTitle>

          {/* Drag handle */}
          <div className="w-10 h-1 rounded bg-gray-200 mx-auto mb-4" />

          {/* Sheet header */}
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={16} className="text-orange" aria-hidden="true" />
            <h2 className="font-heading font-semibold text-navy">{t('generatorTab')}</h2>
          </div>

          {!userIsPro ? (
            /* Pro gate */
            <div className="bg-orange/5 border border-orange/20 rounded-xl p-5 text-center space-y-3">
              <Lock className="mx-auto text-orange" size={28} />
              <p className="font-semibold text-navy text-sm">{t('proOnly')}</p>
              <p className="text-sm text-muted">{t('proOnlySub')}</p>
              <button
                onClick={() => { setGenerateOpen(false); setUpgradeOpen(true) }}
                className="px-6 py-2.5 rounded-xl bg-orange text-white font-semibold text-sm"
              >
                {t('upgradeCta')}
              </button>
            </div>
          ) : result ? (
            /* Generated document viewer */
            <BidDocumentViewer
              tenderName={result.tenderName}
              document={result.document}
              winScore={result.winScore}
              winLabel={result.winLabel}
              winReasoning={result.winReasoning}
              onClose={() => { setResult(null); setGenerateOpen(false) }}
            />
          ) : (
            /* Generator form */
            <div className="space-y-4">
              {genError && (
                <p className="text-sm text-danger bg-danger/5 rounded-xl p-3">{genError}</p>
              )}
              <BidGeneratorForm
                profile={profile}
                tenders={tenders}
                onGenerate={handleGenerate}
                generating={generating}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
    </div>
  )
}

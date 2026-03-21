'use client'
import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { isPro, canUseBidGenerator } from '@/lib/plan-guard'
import { BidHelperChat } from '@/components/bid/bid-chat'
import { BidGeneratorForm } from '@/components/bid/bid-generator-form'
import { BidDocumentViewer } from '@/components/bid/bid-document-viewer'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { addBidDocument, incrementBidDocCount } from '@/lib/firebase/firestore'
import { getAuth } from 'firebase/auth'
import { track } from '@/lib/posthog'
import type { GenerateData } from '@/components/bid/bid-generator-form'

type Tab = 'chat' | 'generator'

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
  const [tab, setTab]                     = useState<Tab>('chat')
  const [generating, setGenerating]       = useState(false)
  const [result, setResult]               = useState<GeneratedResult | null>(null)
  const [upgradeOpen, setUpgradeOpen]     = useState(false)
  const [genError, setGenError]           = useState<string | null>(null)

  // Must be declared before any early return (Rules of Hooks)
  const handleGenerate = useCallback(async (data: GenerateData) => {
    if (!profile || !usage || !user) return
    if (!canUseBidGenerator(profile, usage)) { setUpgradeOpen(true); return }
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
          language: profile.language,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? 'Generation failed')
      const { winScore, winLabel, winReasoning, generatedDocument } = await res.json()

      // Save to bid history
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

  // Early return AFTER all hooks are declared
  if (!profile || !user || !usage) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-36 bg-navy/5 rounded-lg animate-pulse" />
        <div className="h-64 bg-navy/5 rounded-xl animate-pulse" />
      </div>
    )
  }

  const userIsPro = isPro(profile)

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy/5 p-1 rounded-xl">
        {(['chat', 'generator'] as Tab[]).map(tabKey => (
          <button key={tabKey}
            onClick={() => setTab(tabKey)}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === tabKey ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'
            ].join(' ')}>
            {t(tabKey === 'chat' ? 'chatTab' : 'generatorTab')}
          </button>
        ))}
      </div>

      {/* Chat tab */}
      {tab === 'chat' && (
        <div className="h-[calc(100vh-280px)] min-h-[400px] flex flex-col">
          <BidHelperChat profile={profile} usage={usage} onUsageUpdate={refreshUsage} />
        </div>
      )}

      {/* Generator tab */}
      {tab === 'generator' && (
        !userIsPro ? (
          <div className="bg-orange/5 border border-orange/20 rounded-xl p-5 text-center space-y-3">
            <Lock className="mx-auto text-orange" size={28} />
            <p className="font-semibold text-navy text-sm">{t('proOnly')}</p>
            <p className="text-sm text-muted">{t('proOnlySub')}</p>
            <button onClick={() => setUpgradeOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-orange text-white font-semibold text-sm">
              {t('upgradeCta')}
            </button>
          </div>
        ) : result ? (
          <BidDocumentViewer
            tenderName={result.tenderName}
            document={result.document}
            winScore={result.winScore}
            winLabel={result.winLabel}
            winReasoning={result.winReasoning}
            onClose={() => setResult(null)}
          />
        ) : (
          <div className="space-y-4">
            {genError && <p className="text-sm text-danger bg-danger/5 rounded-xl p-3">{genError}</p>}
            <BidGeneratorForm
              profile={profile}
              tenders={tenders}
              onGenerate={handleGenerate}
              generating={generating}
            />
          </div>
        )
      )}

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
    </div>
  )
}

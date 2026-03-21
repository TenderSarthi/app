'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, AlertCircle, Info, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { incrementAIQueryCount } from '@/lib/firebase/firestore'
import { track } from '@/lib/posthog'
import { canUseAI } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { SaveTenderDialog } from './save-tender-dialog'
import type { UserProfile } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'
import { getAuth } from 'firebase/auth'

interface AISummarizerProps {
  uid: string
  profile: UserProfile
  usage: AIUsageData
  onUsageUpdate: () => void
  tenderCount: number
  language: string
}

export function AISummarizer({ uid, profile, usage, onUsageUpdate, tenderCount, language }: AISummarizerProps) {
  const t = useTranslations('finder')
  const [text, setText] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const canSummarize = canUseAI(profile, usage)

  const handleSummarize = async () => {
    if (!canSummarize) { setUpgradeOpen(true); return }
    if (text.trim().length < 50) {
      setError('कम से कम 50 characters paste करें।')
      return
    }

    setLoading(true)
    setError(null)
    setSummary(null)

    try {
      const auth = getAuth()
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ text, language }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Unknown error')
      }

      const data = await res.json()
      setSummary(data.summary)

      if (uid) await incrementAIQueryCount(uid)
      onUsageUpdate()

      track('ai_summary_generated', { language, textLength: text.length })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : 'AI error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-navy mb-2">
          {t('pastePrompt')}
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('pastePlaceholder')}
          rows={6}
          className="w-full rounded-xl border border-navy/20 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
        />
        <p className="text-xs text-muted mt-1">{text.length} / 20,000 chars</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-danger bg-danger/5 rounded-xl p-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <Button
        onClick={handleSummarize}
        disabled={loading || text.trim().length < 50}
        className="bg-navy text-white w-full tablet:w-auto flex items-center gap-2"
      >
        <Sparkles size={16} />
        {loading ? t('summarizing') : t('summarize')}
      </Button>

      {summary && (
        <div className="space-y-3">
          <div className="bg-navy/5 rounded-xl p-4">
            <pre className="whitespace-pre-wrap text-sm text-navy font-sans leading-relaxed">
              {summary}
            </pre>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>ℹ️ AI Summary — Always verify on the official GeM portal before bidding.</span>
          </div>

          <Button
            variant="ghost"
            className="border border-navy/20 text-navy flex items-center gap-2"
            onClick={() => setSaveOpen(true)}
          >
            <Save size={16} />
            {t('saveTender')}
          </Button>
        </div>
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="ai_limit"
      />

      {saveOpen && (
        <SaveTenderDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          aiSummary={summary ?? undefined}
          uid={uid}
          profile={profile}
          currentTenderCount={tenderCount}
        />
      )}
    </div>
  )
}

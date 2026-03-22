'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Sparkles, Info, Clipboard, X, Save, AlertCircle } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { incrementAIQueryCount } from '@/lib/firebase/firestore'
import { canUseAI } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { SaveTenderDialog } from '@/components/finder/save-tender-dialog'
import type { ChatMessage } from '@/lib/types'
import type { UserProfile } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'
import { getAuth } from 'firebase/auth'
import { track } from '@/lib/posthog'

const QUICK_CHIPS = [
  'EMD कैसे भरें?',
  'Technical bid में क्या डालें?',
  'L1 rate कैसे decide करें?',
  'Documents checklist क्या है?',
  'Bid submit कैसे करें?',
]

interface BidHelperChatProps {
  profile: UserProfile
  usage: AIUsageData
  onUsageUpdate: () => void
  tenderCount: number
}

export function BidHelperChat({ profile, usage, onUsageUpdate, tenderCount }: BidHelperChatProps) {
  const t = useTranslations('bid')
  const { user } = useFirebase()
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [confirmId, setConfirmId]     = useState<string | null>(null)

  // Paste-to-summarize mode
  const [inputMode, setInputMode]     = useState<'text' | 'paste'>('text')
  const [pasteText, setPasteText]     = useState('')
  const [pasteError, setPasteError]   = useState<string | null>(null)

  // Track which message IDs are summaries — shows "Save Tender" button
  const [summaryMsgIds, setSummaryMsgIds] = useState<Set<string>>(new Set())
  const [saveOpen, setSaveOpen]           = useState(false)
  const [saveContext, setSaveContext]     = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Chat Q&A ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    if (!canUseAI(profile, usage)) { setUpgradeOpen(true); return }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setConfirmId(null)

    try {
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          language: profile.language,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? 'AI error')
      const { reply } = await res.json()

      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', content: reply }
      setMessages(prev => [...prev, assistantMsg])
      setConfirmId(assistantMsg.id)

      if (user && profile.plan === 'pro') {
        incrementAIQueryCount(user.uid).catch(e =>
          console.warn('[BidChat] Failed to increment AI query count:', e)
        )
      }
      onUsageUpdate()
      track('bid_chat_message', { language: profile.language })
    } catch {
      const errorMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', content: t('chatError') }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }, [messages, loading, profile, usage, user, onUsageUpdate, t])

  // ── Paste → Summarize ───────────────────────────────────────────────────
  const handlePasteSummarize = useCallback(async () => {
    if (!canUseAI(profile, usage)) { setUpgradeOpen(true); return }
    if (pasteText.trim().length < 50) { setPasteError('कम से कम 50 characters paste करें।'); return }

    const preview = pasteText.trim().slice(0, 120)
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `📋 Summarize this tender:\n"${preview}${pasteText.length > 120 ? '…' : ''}"`,
    }
    setMessages(prev => [...prev, userMsg])
    setPasteText('')
    setPasteError(null)
    setInputMode('text')
    setLoading(true)

    try {
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ text: pasteText, language: profile.language }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? 'Summarize failed')
      const { summary } = await res.json()

      const summaryId = (Date.now() + 1).toString()
      const summaryMsg: ChatMessage = { id: summaryId, role: 'model', content: summary }
      setMessages(prev => [...prev, summaryMsg])
      setSummaryMsgIds(prev => new Set(prev).add(summaryId))

      if (user) incrementAIQueryCount(user.uid).catch(() => {})
      onUsageUpdate()
      track('ai_summary_generated', { language: profile.language, source: 'chat' })
    } catch {
      const errorMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', content: t('chatError') }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }, [pasteText, profile, usage, user, onUsageUpdate, t])

  return (
    <div className="flex flex-col h-full">

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <Sparkles size={32} className="mx-auto text-navy/20 mb-3" />
            <p className="text-sm font-medium text-navy">{t('chatWelcome')}</p>
            <p className="text-xs text-muted mt-1">{t('chatWelcomeSub')}</p>
            <p className="text-xs text-muted/70 mt-2">
              💡 Tap <Clipboard size={11} className="inline" /> to paste and summarize a tender
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={[
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-navy text-white rounded-br-sm'
                  : 'bg-navy/5 text-navy rounded-bl-sm'
              ].join(' ')}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {msg.role === 'model' && (
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-navy/10">
                    <Info size={11} className="text-muted/60 shrink-0" />
                    <span className="text-xs text-muted/60">{t('aiDisclaimer')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Save Tender action — only on summary messages */}
            {summaryMsgIds.has(msg.id) && (
              <div className="flex justify-start mt-1.5 pl-2">
                <button
                  onClick={() => { setSaveContext(msg.content); setSaveOpen(true) }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-success/10 text-success font-medium border border-success/20 hover:bg-success/20 transition-colors"
                >
                  <Save size={12} aria-hidden="true" />
                  Save this tender
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Checklist confirmation chips */}
        {confirmId && !loading && !summaryMsgIds.has(confirmId) && (
          <div className="flex gap-2 justify-start pl-2">
            <button onClick={() => setConfirmId(null)}
              className="text-xs px-3 py-1.5 rounded-full bg-success/10 text-success font-medium border border-success/20">
              {t('confirmYes')}
            </button>
            <button onClick={() => { setConfirmId(null); sendMessage('और details चाहिए') }}
              className="text-xs px-3 py-1.5 rounded-full bg-navy/5 text-navy font-medium border border-navy/10">
              {t('confirmMore')}
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-navy/5 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-navy/30 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick chips (empty state only) ─────────────────────── */}
      {messages.length === 0 && inputMode === 'text' && (
        <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
          {QUICK_CHIPS.map(chip => (
            <button key={chip} onClick={() => sendMessage(chip)}
              className="shrink-0 text-xs px-3 py-2 rounded-full border border-navy/20 text-navy bg-white hover:bg-navy/5 transition-colors">
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── Paste-to-summarize mode ─────────────────────────────── */}
      {inputMode === 'paste' && (
        <div className="space-y-2 pt-3 border-t border-navy/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-navy flex items-center gap-1">
              <Sparkles size={11} /> Paste tender text to summarize
            </span>
            <button onClick={() => { setInputMode('text'); setPasteText(''); setPasteError(null) }}
              className="p-1 rounded-full hover:bg-navy/5 text-muted">
              <X size={14} aria-label="Cancel" />
            </button>
          </div>

          {pasteError && (
            <div className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle size={12} /> {pasteError}
            </div>
          )}

          <textarea
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); setPasteError(null) }}
            rows={5}
            placeholder="GeM portal से tender का text यहाँ paste करें…"
            autoFocus
            className="w-full rounded-xl border border-navy/20 px-3 py-2.5 text-sm text-navy bg-white resize-none focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
          <p className="text-xs text-muted">{pasteText.length} / 20,000 chars</p>

          <button
            onClick={handlePasteSummarize}
            disabled={loading || pasteText.trim().length < 50}
            className="w-full py-2.5 rounded-xl bg-navy text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          >
            <Sparkles size={14} aria-hidden="true" />
            {loading ? 'Summarizing…' : 'Summarize'}
          </button>
        </div>
      )}

      {/* ── Normal chat input ───────────────────────────────────── */}
      {inputMode === 'text' && (
        <div className="flex gap-2 pt-2 border-t border-navy/10">
          {/* Paste/summarize toggle button */}
          <button
            onClick={() => setInputMode('paste')}
            aria-label="Paste tender to summarize"
            title="Paste tender to summarize"
            className="w-10 h-10 rounded-xl border border-navy/20 text-muted hover:text-navy hover:border-navy/40 flex items-center justify-center shrink-0 transition-colors"
          >
            <Clipboard size={16} aria-hidden="true" />
          </button>

          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder={t('chatPlaceholder')}
            disabled={loading}
            className="flex-1 rounded-xl border border-navy/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            aria-label={t('sendMessage')}
            className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center disabled:opacity-40 shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      )}

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="ai_limit" />

      {saveOpen && (
        <SaveTenderDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          aiSummary={saveContext}
          uid={user?.uid ?? ''}
          profile={profile}
          currentTenderCount={tenderCount}
        />
      )}
    </div>
  )
}

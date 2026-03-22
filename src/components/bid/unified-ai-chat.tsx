'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Sparkles, Info, Paperclip, X, Save, FileText } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { incrementAIQueryCount } from '@/lib/firebase/firestore'
import { canUseAI } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { SaveTenderDialog } from '@/components/finder/save-tender-dialog'
import { BidGeneratorForm } from '@/components/bid/bid-generator-form'
import { BidDocumentViewer } from '@/components/bid/bid-document-viewer'
import type { ChatMessage, UserProfile } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'
import type { Tender } from '@/lib/types'
import type { GenerateData } from '@/components/bid/bid-generator-form'
import { getAuth } from 'firebase/auth'
import { track } from '@/lib/posthog'
import { addBidDocument, incrementBidDocCount } from '@/lib/firebase/firestore'
import { isPro, canUseBidGenerator } from '@/lib/plan-guard'

// Threshold: text longer than this is treated as tender content → summarize
const SUMMARIZE_THRESHOLD = 150

const QUICK_CHIPS = [
  'EMD कैसे भरें?',
  'Technical bid में क्या डालें?',
  'L1 rate कैसे decide करें?',
  'Documents checklist क्या है?',
]

interface BidResult {
  msgId: string
  tenderName: string
  document: string
  winScore: number
  winLabel: string
  winReasoning: string
}

interface UnifiedAIChatProps {
  profile: UserProfile
  usage: AIUsageData
  onUsageUpdate: () => void
  tenderCount: number
  tenders: Tender[]
}

export function UnifiedAIChat({ profile, usage, onUsageUpdate, tenderCount, tenders }: UnifiedAIChatProps) {
  const t = useTranslations('bid')
  const { user } = useFirebase()

  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [confirmId, setConfirmId]     = useState<string | null>(null)

  // Bid generator — shown inline in the thread
  const [showBidForm, setShowBidForm] = useState(false)
  const [generating, setGenerating]   = useState(false)
  const [genError, setGenError]       = useState<string | null>(null)
  const [bidResult, setBidResult]     = useState<BidResult | null>(null)
  const [viewerOpen, setViewerOpen]   = useState(false)

  // Summaries get a "Save Tender" button
  const [summaryMsgIds, setSummaryMsgIds] = useState<Set<string>>(new Set())
  const [saveOpen, setSaveOpen]           = useState(false)
  const [saveContext, setSaveContext]     = useState('')

  const bottomRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showBidForm])

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // ── Smart send: short text → chat, long text → summarize ─────────────
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    if (!canUseAI(profile, usage)) { setUpgradeOpen(true); return }

    setInput('')
    setConfirmId(null)

    if (text.length >= SUMMARIZE_THRESHOLD) {
      // Long text — treat as tender content to summarize
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: `📋 Summarize this tender:\n"${text.slice(0, 120)}${text.length > 120 ? '…' : ''}"`,
      }
      setMessages(prev => [...prev, userMsg])
      setLoading(true)

      try {
        const idToken = await getAuth().currentUser?.getIdToken()
        if (!idToken) throw new Error('Not authenticated')

        const res = await fetch('/api/ai/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ text, language: profile.language }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Summarize failed')
        const { summary } = await res.json()

        const summaryId = (Date.now() + 1).toString()
        setMessages(prev => [...prev, { id: summaryId, role: 'model', content: summary }])
        setSummaryMsgIds(prev => new Set(prev).add(summaryId))
        if (user) incrementAIQueryCount(user.uid).catch(() => {})
        onUsageUpdate()
        track('ai_summary_generated', { language: profile.language, source: 'chat' })
      } catch {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', content: t('chatError') }])
      } finally {
        setLoading(false)
      }
    } else {
      // Short text — regular Q&A chat
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text }
      const newMessages = [...messages, userMsg]
      setMessages(newMessages)
      setLoading(true)

      try {
        const idToken = await getAuth().currentUser?.getIdToken()
        if (!idToken) throw new Error('Not authenticated')

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
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
        if (user && profile.plan === 'pro') incrementAIQueryCount(user.uid).catch(() => {})
        onUsageUpdate()
        track('bid_chat_message', { language: profile.language })
      } catch {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', content: t('chatError') }])
      } finally {
        setLoading(false)
      }
    }
  }, [input, loading, messages, profile, usage, user, onUsageUpdate, t])

  // ── File upload → extract → summarize ────────────────────────────────
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (!canUseAI(profile, usage)) { setUpgradeOpen(true); return }

    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return
    if (file.size > 10 * 1024 * 1024) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: `📎 ${file.name}` }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const { text } = await fetch('/api/ai/extract-tender-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ base64, mimeType: file.type }),
      }).then(r => r.json()) as { text: string }

      const { summary } = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ text, language: profile.language }),
      }).then(r => r.json())

      const summaryId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, { id: summaryId, role: 'model', content: summary }])
      setSummaryMsgIds(prev => new Set(prev).add(summaryId))
      if (user) incrementAIQueryCount(user.uid).catch(() => {})
      onUsageUpdate()
      track('ai_summary_generated', { language: profile.language, source: 'file_upload' })
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', content: t('chatError') }])
    } finally {
      setLoading(false)
    }
  }, [profile, usage, user, onUsageUpdate, t])

  // ── Bid generation ────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (data: GenerateData) => {
    if (!profile || !usage || !user) return
    if (!canUseBidGenerator(profile, usage)) { setUpgradeOpen(true); return }
    setGenerating(true); setGenError(null)

    try {
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch('/api/ai/generate-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
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
        winScore, winLabel, generatedDocument,
      })
      await incrementBidDocCount(user.uid)
      refreshUsage()

      // Result appears as a message in the thread
      const msgId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, {
        id: msgId,
        role: 'model',
        content: `✅ Bid document generated for **${data.tender.name}**\n\nWin chance: ${winScore}% — ${winLabel}\n\n${winReasoning}`,
      }])
      setBidResult({ msgId, tenderName: data.tender.name, document: generatedDocument, winScore, winLabel, winReasoning })
      setShowBidForm(false)
      track('bid_document_generated', { category: data.tender.category, winScore })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }

    function refreshUsage() { onUsageUpdate() }
  }, [profile, usage, user, onUsageUpdate])

  const isLongInput = input.trim().length >= SUMMARIZE_THRESHOLD
  const userIsPro = isPro(profile)

  return (
    <div className="flex flex-col h-full">

      {/* ── Messages ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">

        {/* Empty state */}
        {messages.length === 0 && !showBidForm && (
          <div className="py-8 text-center">
            <Sparkles size={32} className="mx-auto text-navy/20 mb-3" />
            <p className="text-sm font-medium text-navy">{t('chatWelcome')}</p>
            <p className="text-xs text-muted mt-1">{t('chatWelcomeSub')}</p>
            <p className="text-xs text-muted/60 mt-2">
              Paste tender text to summarize &nbsp;·&nbsp; Upload a PDF &nbsp;·&nbsp; Generate a bid doc
            </p>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map(msg => (
          <div key={msg.id}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={[
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-navy text-white rounded-br-sm'
                  : 'bg-navy/5 text-navy rounded-bl-sm',
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

            {/* Save Tender — on summary messages */}
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

            {/* View Bid Document — on generated bid messages */}
            {bidResult?.msgId === msg.id && (
              <div className="flex justify-start mt-1.5 pl-2">
                <button
                  onClick={() => setViewerOpen(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-orange/10 text-orange font-medium border border-orange/20 hover:bg-orange/20 transition-colors"
                >
                  <FileText size={12} aria-hidden="true" />
                  View Document
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Confirmation chips */}
        {confirmId && !loading && !summaryMsgIds.has(confirmId) && (
          <div className="flex gap-2 justify-start pl-2">
            <button onClick={() => setConfirmId(null)}
              className="text-xs px-3 py-1.5 rounded-full bg-success/10 text-success font-medium border border-success/20">
              {t('confirmYes')}
            </button>
            <button onClick={() => { setConfirmId(null); setInput('और details चाहिए'); textareaRef.current?.focus() }}
              className="text-xs px-3 py-1.5 rounded-full bg-navy/5 text-navy font-medium border border-navy/10">
              {t('confirmMore')}
            </button>
          </div>
        )}

        {/* Typing indicator */}
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

        {/* ── Inline Bid Generator card ────────────────────────── */}
        {showBidForm && (
          <div className="bg-white border border-orange/20 rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 bg-orange/5 border-b border-orange/10">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-orange" aria-hidden="true" />
                <span className="text-sm font-semibold text-navy">{t('generatorTab')}</span>
              </div>
              <button
                onClick={() => { setShowBidForm(false); setGenError(null) }}
                className="p-1 rounded-lg text-muted hover:text-navy hover:bg-navy/5 transition-colors"
              >
                <X size={14} aria-label="Close" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {!userIsPro ? (
                <div className="text-center space-y-2 py-4">
                  <p className="text-sm font-semibold text-navy">{t('proOnly')}</p>
                  <p className="text-xs text-muted">{t('proOnlySub')}</p>
                  <button
                    onClick={() => { setShowBidForm(false); setUpgradeOpen(true) }}
                    className="px-5 py-2 rounded-xl bg-orange text-white font-semibold text-sm"
                  >
                    {t('upgradeCta')}
                  </button>
                </div>
              ) : (
                <>
                  {genError && (
                    <p className="text-sm text-danger bg-danger/5 rounded-xl p-3">{genError}</p>
                  )}
                  <BidGeneratorForm
                    profile={profile}
                    tenders={tenders}
                    onGenerate={handleGenerate}
                    generating={generating}
                  />
                </>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick chips ─────────────────────────────────────────── */}
      {messages.length === 0 && !showBidForm && (
        <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
          {QUICK_CHIPS.map(chip => (
            <button key={chip} onClick={() => { setInput(chip); textareaRef.current?.focus() }}
              className="shrink-0 text-xs px-3 py-2 rounded-full border border-navy/20 text-navy bg-white hover:bg-navy/5 transition-colors">
              {chip}
            </button>
          ))}
          <button
            onClick={() => setShowBidForm(true)}
            className="shrink-0 flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-orange/30 text-orange bg-orange/5 hover:bg-orange/10 transition-colors"
          >
            <Sparkles size={11} aria-hidden="true" />
            Generate Bid
          </button>
        </div>
      )}

      {/* ── Input bar ───────────────────────────────────────────── */}
      <div className="flex gap-2 pt-2 border-t border-navy/10 items-end">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFile}
        />

        {/* Attach — directly opens file picker */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          aria-label="Upload PDF or image"
          title="Upload PDF or image"
          className="w-10 h-10 rounded-xl border border-navy/20 text-muted hover:text-navy hover:border-navy/40 flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 mb-0.5"
        >
          <Paperclip size={16} aria-hidden="true" />
        </button>

        {/* Auto-growing textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder={isLongInput ? 'Paste tender text to summarize…' : t('chatPlaceholder')}
            disabled={loading}
            rows={1}
            className="w-full rounded-xl border border-navy/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:opacity-50 resize-none overflow-hidden leading-relaxed"
          />
          {/* Character hint when long text is pasted */}
          {isLongInput && (
            <span className="absolute right-2 bottom-1.5 text-[10px] text-muted/60 pointer-events-none">
              summarize
            </span>
          )}
        </div>

        {/* Generate Bid button */}
        <button
          onClick={() => setShowBidForm(v => !v)}
          aria-label="Generate Bid Document"
          title="Generate Bid Document"
          className={[
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors mb-0.5',
            showBidForm
              ? 'bg-orange text-white'
              : 'bg-orange/10 text-orange hover:bg-orange/20',
          ].join(' ')}
        >
          <Sparkles size={16} aria-hidden="true" />
        </button>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label={t('sendMessage')}
          className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center disabled:opacity-40 shrink-0 mb-0.5"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Dialogs */}
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

      {viewerOpen && bidResult && (
        <div className="fixed inset-0 z-50 bg-lightbg overflow-y-auto p-4">
          <BidDocumentViewer
            tenderName={bidResult.tenderName}
            document={bidResult.document}
            winScore={bidResult.winScore}
            winLabel={bidResult.winLabel}
            winReasoning={bidResult.winReasoning}
            onClose={() => setViewerOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

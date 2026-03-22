'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Sparkles, Info, Paperclip, FileUp, Clipboard, X, Save, AlertCircle } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { incrementAIQueryCount } from '@/lib/firebase/firestore'
import { canUseAI } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { SaveTenderDialog } from '@/components/finder/save-tender-dialog'
import type { ChatMessage, UserProfile } from '@/lib/types'
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

type InputMode = 'text' | 'attach-menu' | 'paste'

interface UnifiedAIChatProps {
  profile: UserProfile
  usage: AIUsageData
  onUsageUpdate: () => void
  tenderCount: number
  onRequestGenerate: () => void
}

export function UnifiedAIChat({ profile, usage, onUsageUpdate, tenderCount, onRequestGenerate }: UnifiedAIChatProps) {
  const t = useTranslations('bid')
  const { user } = useFirebase()

  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [confirmId, setConfirmId]     = useState<string | null>(null)

  const [inputMode, setInputMode]     = useState<InputMode>('text')
  const [pasteText, setPasteText]     = useState('')
  const [pasteError, setPasteError]   = useState<string | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [summaryMsgIds, setSummaryMsgIds] = useState<Set<string>>(new Set())
  const [saveOpen, setSaveOpen]           = useState(false)
  const [saveContext, setSaveContext]     = useState('')

  const bottomRef   = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Chat Q&A ───────────────────────────────────────────────────────────
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
          console.warn('[AIChat] Failed to increment AI query count:', e)
        )
      }
      onUsageUpdate()
      track('bid_chat_message', { language: profile.language })
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', content: t('chatError') }])
    } finally {
      setLoading(false)
    }
  }, [messages, loading, profile, usage, user, onUsageUpdate, t])

  // ── Paste → Summarize ─────────────────────────────────────────────────
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
  }, [pasteText, profile, usage, user, onUsageUpdate, t])

  // ── File upload → Extract → Summarize ────────────────────────────────
  const handleFileExtract = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (!canUseAI(profile, usage)) { setUpgradeOpen(true); return }

    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) { setUploadError('Only PDF, JPG, PNG supported'); return }
    if (file.size > 10 * 1024 * 1024) { setUploadError('File too large (max 10 MB)'); return }

    setInputMode('text')
    setUploadError(null)
    setUploading(true)

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `📎 ${file.name}`,
    }
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

      const extractRes = await fetch('/api/ai/extract-tender-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ base64, mimeType: file.type }),
      })
      if (!extractRes.ok) throw new Error('Extract failed')
      const { text } = await extractRes.json() as { text: string }

      const summRes = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ text, language: profile.language }),
      })
      if (!summRes.ok) throw new Error('Summarize failed')
      const { summary } = await summRes.json()

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
      setUploading(false)
    }
  }, [profile, usage, user, onUsageUpdate, t])

  return (
    <div className="flex flex-col h-full">

      {/* ── Messages ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <Sparkles size={32} className="mx-auto text-navy/20 mb-3" />
            <p className="text-sm font-medium text-navy">{t('chatWelcome')}</p>
            <p className="text-xs text-muted mt-1">{t('chatWelcomeSub')}</p>
            <p className="text-xs text-muted/70 mt-2">
              💡 Tap <Paperclip size={11} className="inline" /> to upload or paste a tender &nbsp;·&nbsp; <Sparkles size={11} className="inline text-orange" /> to generate a bid
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

        {/* Confirmation chips */}
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

        {/* Loading indicator */}
        {(loading || uploading) && (
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

      {/* ── Input area ──────────────────────────────────────────── */}
      <div className="pt-2 border-t border-navy/10 space-y-2">

        {/* Attach action menu */}
        {inputMode === 'attach-menu' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setInputMode('paste'); setPasteText(''); setPasteError(null) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-navy/20 text-navy text-xs font-medium hover:border-navy/40 transition-colors"
            >
              <Clipboard size={13} aria-hidden="true" />
              Paste text
            </button>
            <button
              onClick={() => { setInputMode('text'); fileInputRef.current?.click() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-navy/20 text-navy text-xs font-medium hover:border-navy/40 transition-colors"
            >
              <FileUp size={13} aria-hidden="true" />
              Upload PDF / Image
            </button>
            <button
              onClick={() => setInputMode('text')}
              className="ml-auto p-1.5 rounded-lg text-muted hover:text-navy hover:bg-navy/5 transition-colors"
            >
              <X size={14} aria-label="Cancel" />
            </button>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="flex items-center gap-1.5 text-xs text-danger">
            <AlertCircle size={12} /> {uploadError}
          </div>
        )}

        {/* Paste mode */}
        {inputMode === 'paste' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-navy flex items-center gap-1">
                <Sparkles size={11} /> Paste tender text to summarize
              </span>
              <button
                onClick={() => { setInputMode('text'); setPasteText(''); setPasteError(null) }}
                className="p-1 rounded-full hover:bg-navy/5 text-muted"
              >
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

        {/* Normal input row */}
        {inputMode !== 'paste' && (
          <div className="flex gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileExtract}
            />

            {/* Attach button */}
            <button
              onClick={() => setInputMode(inputMode === 'attach-menu' ? 'text' : 'attach-menu')}
              aria-label="Attach document"
              title="Attach document"
              className={[
                'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors',
                inputMode === 'attach-menu'
                  ? 'border-navy bg-navy text-white'
                  : 'border-navy/20 text-muted hover:text-navy hover:border-navy/40',
              ].join(' ')}
            >
              <Paperclip size={16} aria-hidden="true" />
            </button>

            {/* Text input */}
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder={t('chatPlaceholder')}
              disabled={loading}
              className="flex-1 rounded-xl border border-navy/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:opacity-50"
            />

            {/* Generate Bid button */}
            <button
              onClick={onRequestGenerate}
              aria-label="Generate Bid Document"
              title="Generate Bid Document"
              className="w-10 h-10 rounded-xl bg-orange/10 text-orange hover:bg-orange/20 flex items-center justify-center shrink-0 transition-colors"
            >
              <Sparkles size={16} aria-hidden="true" />
            </button>

            {/* Send button */}
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
      </div>

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

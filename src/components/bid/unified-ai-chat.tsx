'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Sparkles, Info, Paperclip, Save } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { incrementAIQueryCount } from '@/lib/firebase/firestore'
import { canUseAI } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { SaveTenderDialog } from '@/components/finder/save-tender-dialog'
import type { ChatMessage, UserProfile } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'
import type { Tender } from '@/lib/types'
import { getAuth } from 'firebase/auth'
import { track } from '@/lib/posthog'

// Threshold: text longer than this is treated as tender content → summarize
const SUMMARIZE_THRESHOLD = 150

const QUICK_CHIPS = [
  'EMD कैसे भरें?',
  'Technical bid में क्या डालें?',
  'L1 rate कैसे decide करें?',
  'Documents checklist क्या है?',
]

interface UnifiedAIChatProps {
  profile: UserProfile
  usage: AIUsageData
  onUsageUpdate: () => void
  tenderCount: number
  tenders: Tender[] // kept for future use
}

export function UnifiedAIChat({ profile, usage, onUsageUpdate, tenderCount }: UnifiedAIChatProps) {
  const t = useTranslations('bid')
  const { user } = useFirebase()

  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [confirmId, setConfirmId]     = useState<string | null>(null)

  // Summaries get a "Save Tender" button
  const [summaryMsgIds, setSummaryMsgIds] = useState<Set<string>>(new Set())
  const [saveOpen, setSaveOpen]           = useState(false)
  const [saveContext, setSaveContext]     = useState('')

  const bottomRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  const isLongInput = input.trim().length >= SUMMARIZE_THRESHOLD

  return (
    <>
      {/* ── Messages (normal document flow) ───────────────────── */}
      <div className="space-y-3">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[52vh] text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-orange/10 flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-orange" />
            </div>
            <p className="text-base font-semibold text-navy mb-1">{t('chatWelcome')}</p>
            <p className="text-sm text-muted mb-3">{t('chatWelcomeSub')}</p>
            <p className="text-xs text-muted/50">
              Paste tender text to summarize &nbsp;·&nbsp; Upload a PDF
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
                  : 'bg-white border border-navy/10 text-navy rounded-bl-sm shadow-sm',
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
            <div className="bg-white border border-navy/10 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-orange/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Floating bottom panel — fixed above bottom nav ────── */}
      {/* desktop:left-60 offsets past the fixed sidebar (w-60); desktop:bottom-0 since there's no bottom nav */}
      <div className="fixed bottom-20 left-0 right-0 desktop:bottom-6 desktop:left-60 px-4 desktop:px-6 pt-8 bg-gradient-to-t from-[#F0F4FB] via-[#F0F4FB]/98 to-transparent pointer-events-none">
        <div className="pointer-events-auto">

          {/* Quick chips */}
          {messages.length === 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
              {QUICK_CHIPS.map(chip => (
                <button key={chip} onClick={() => { setInput(chip); textareaRef.current?.focus() }}
                  className="shrink-0 text-xs px-3 py-2 rounded-full border border-orange/20 text-orange bg-orange/5 hover:bg-orange/10 hover:border-orange/30 transition-colors">
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFile}
          />

          {/* Input bar */}
          <div className="pb-1">
            <div className="flex gap-2 bg-white border border-navy/10 rounded-2xl px-2 py-1 items-center shadow-sm">

              {/* Attach */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label="Upload PDF or image"
                title="Upload PDF or image"
                className="w-9 h-9 rounded-xl text-muted hover:text-navy hover:bg-navy/5 flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
              >
                <Paperclip size={16} aria-hidden="true" />
              </button>

              {/* Textarea */}
              <div className="flex-1 relative flex items-center">
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
                  className="w-full bg-transparent px-1 py-0 text-sm focus:outline-none disabled:opacity-50 resize-none overflow-hidden leading-normal text-navy placeholder:text-muted"
                />
                {isLongInput && (
                  <span className="absolute right-1 bottom-2 text-[10px] text-orange/60 pointer-events-none font-medium">
                    summarize
                  </span>
                )}
              </div>

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                aria-label={t('sendMessage')}
                className="w-9 h-9 rounded-xl bg-orange text-white flex items-center justify-center disabled:opacity-30 shrink-0 transition-colors hover:bg-orange/90"
              >
                <Send size={15} />
              </button>
            </div>
          </div>

        </div>
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
    </>
  )
}

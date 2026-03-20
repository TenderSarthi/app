'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, MessageSquare, Mail, X, Plus, CheckCircle } from 'lucide-react'
import { GEM_CATEGORIES, INDIAN_STATES } from '@/lib/constants'
import type { AlertConfig } from '@/lib/types'

interface AlertConfigFormProps {
  initial: AlertConfig | null
  saving: boolean
  onSave: (config: Omit<AlertConfig, 'userId' | 'createdAt'>) => Promise<void>
}

export function AlertConfigForm({ initial, saving, onSave }: AlertConfigFormProps) {
  const t = useTranslations('alerts')

  const [categories, setCategories] = useState<string[]>(initial?.categories ?? [])
  const [states, setStates]         = useState<string[]>(initial?.states ?? [])
  const [keywords, setKeywords]     = useState<string[]>(initial?.keywords ?? [])
  const [newKeyword, setNewKeyword]  = useState('')
  const [channels, setChannels]     = useState(
    initial?.channels ?? { push: true, whatsapp: false, email: false }
  )
  const [saved, setSaved]           = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }
  }, [])

  // Re-initialize form state when `initial` loads from Firestore after mount
  // (useState ignores prop changes; this effect syncs when initial transitions null → real config)
  useEffect(() => {
    if (!initial) return
    setCategories(initial.categories)
    setStates(initial.states)
    setKeywords(initial.keywords)
    setChannels(initial.channels)
  }, [initial])

  const toggleCategory = (cat: string) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const toggleState = (state: string) =>
    setStates(prev => prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state])

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) { setKeywords(prev => [...prev, kw]); setNewKeyword('') }
  }

  const handleSave = async () => {
    await onSave({ categories, states, keywords, channels, active: true })
    setSaved(true)
    savedTimerRef.current = setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Categories */}
      <section>
        <p className="text-sm font-semibold text-navy mb-2">{t('categoriesLabel')}</p>
        <p className="text-xs text-muted mb-3">{t('categoriesHint')}</p>
        <div className="flex flex-wrap gap-2">
          {GEM_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => toggleCategory(cat)}
              className={[
                'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
                categories.includes(cat)
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-navy border-navy/20 hover:bg-navy/5'
              ].join(' ')}>
              {cat}
            </button>
          ))}
        </div>
        {categories.length === 0 && (
          <p className="text-xs text-muted/60 mt-2">{t('allCategoriesNote')}</p>
        )}
      </section>

      {/* States */}
      <section>
        <p className="text-sm font-semibold text-navy mb-2">{t('statesLabel')}</p>
        <p className="text-xs text-muted mb-3">{t('statesHint')}</p>
        <select
          multiple
          value={states}
          onChange={e => setStates(Array.from(e.target.selectedOptions, o => o.value))}
          className="w-full border border-navy/20 rounded-xl px-3 py-2 text-sm text-navy bg-white h-36"
        >
          {INDIAN_STATES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {states.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {states.map(s => (
              <span key={s} className="flex items-center gap-1 text-xs bg-navy/10 text-navy px-2 py-0.5 rounded-full">
                {s}
                <button onClick={() => toggleState(s)} aria-label={`Remove ${s}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        {states.length === 0 && (
          <p className="text-xs text-muted/60 mt-2">{t('allStatesNote')}</p>
        )}
      </section>

      {/* Keywords */}
      <section>
        <p className="text-sm font-semibold text-navy mb-2">{t('keywordsLabel')}</p>
        <p className="text-xs text-muted mb-3">{t('keywordsHint')}</p>
        <div className="flex gap-2">
          <input
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
            placeholder={t('keywordPlaceholder')}
            className="flex-1 border border-navy/20 rounded-xl px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
          <button onClick={addKeyword} aria-label={t('addKeyword')}
            className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center shrink-0">
            <Plus size={16} />
          </button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {keywords.map(kw => (
              <span key={kw} className="flex items-center gap-1 text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full">
                {kw}
                <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))} aria-label={`Remove ${kw}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Channels */}
      <section>
        <p className="text-sm font-semibold text-navy mb-3">{t('channelsLabel')}</p>
        <div className="space-y-3">
          {([
            { key: 'push',      icon: Bell,           label: t('channelPush'),      hint: t('channelPushHint') },
            { key: 'whatsapp',  icon: MessageSquare,  label: t('channelWhatsApp'),  hint: t('channelWhatsAppHint') },
            { key: 'email',     icon: Mail,           label: t('channelEmail'),     hint: t('channelEmailHint') },
          ] as const).map(({ key, icon: Icon, label, hint }) => (
            <label key={key}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setChannels(prev => ({ ...prev, [key]: !prev[key] }))}>
              <div className={[
                'w-10 h-6 rounded-full flex items-center transition-colors relative shrink-0',
                channels[key] ? 'bg-navy' : 'bg-navy/20'
              ].join(' ')}>
                <div className={[
                  'w-4 h-4 rounded-full bg-white absolute transition-transform',
                  channels[key] ? 'translate-x-5' : 'translate-x-1'
                ].join(' ')} />
              </div>
              <div className="flex items-center gap-2">
                <Icon size={16} className="text-muted" />
                <div>
                  <p className="text-sm font-medium text-navy">{label}</p>
                  <p className="text-xs text-muted">{hint}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-navy text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saved ? (
          <><CheckCircle size={16} /> {t('saved')}</>
        ) : saving ? t('saving') : t('saveAlerts')}
      </button>

      <p className="text-xs text-muted text-center">{t('scheduleNote')}</p>
    </div>
  )
}

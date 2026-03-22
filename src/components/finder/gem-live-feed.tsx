'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useFirebase } from '@/components/providers/firebase-provider'
import { ExternalLink, RefreshCw, Rss, Clock, AlertTriangle } from 'lucide-react'
import { SaveTenderDialog } from './save-tender-dialog'
import type { UserProfile } from '@/lib/types'

interface LiveTender {
  title: string
  link: string
  org: string
  pubDate: string
  closingDate: string
  categories: string[]
  states: string[]
}

interface GemLiveFeedProps {
  state: string
  categories: string[]
  profile: UserProfile
  tenderCount: number
}

function timeAgo(dateStr: string): string {
  const diffH = Math.floor((Date.now() - new Date(dateStr).getTime()) / 36e5)
  if (diffH < 1)  return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

function daysUntil(dateStr: string): number | null {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return Math.ceil((d.getTime() - Date.now()) / 864e5)
  } catch { return null }
}

export function GemLiveFeed({ state, categories, profile, tenderCount }: GemLiveFeedProps) {
  const t = useTranslations('finder')
  const { user } = useFirebase()

  const [tenders,         setTenders]         = useState<LiveTender[]>([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(false)
  const [selectedTender,  setSelectedTender]  = useState<LiveTender | null>(null)

  const fetchFeed = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(false)
    try {
      const token = await user.getIdToken()
      const params = new URLSearchParams()
      if (state && state !== 'all') params.set('state', state)
      if (categories.length > 0)   params.set('categories', categories.join(','))

      const res = await fetch(`/api/tenders/live-feed?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('feed failed')
      const { tenders: items } = await res.json() as { tenders: LiveTender[] }
      setTenders(items)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user, state, categories])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchFeed() }, [fetchFeed])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Rss size={13} className="text-orange" />
          <h2 className="text-sm font-semibold text-navy">{t('liveFeedTitle')}</h2>
        </div>
        <button
          onClick={fetchFeed}
          aria-label="Refresh"
          className="p-1.5 rounded-lg text-muted hover:text-navy hover:bg-navy/5 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-24 bg-navy/5 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-6 bg-danger/5 border border-danger/10 rounded-xl">
          <p className="text-sm text-danger">{t('liveFeedError')}</p>
          <button
            onClick={fetchFeed}
            className="mt-2 text-xs text-navy underline underline-offset-2"
          >
            {t('liveFeedRetry')}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tenders.length === 0 && (
        <div className="text-center py-8 bg-navy/5 rounded-xl">
          <p className="text-sm text-muted">{t('liveFeedEmpty')}</p>
        </div>
      )}

      {/* Tender cards */}
      {!loading && !error && tenders.length > 0 && (
        <div className="space-y-2">
          {tenders.map((tender, i) => {
            const days = tender.closingDate ? daysUntil(tender.closingDate) : null
            const urgent = days !== null && days <= 3 && days >= 0
            return (
              <div
                key={i}
                className="bg-white border border-navy/10 rounded-xl p-3 space-y-2 hover:border-navy/20 hover:shadow-sm transition-all"
              >
                {/* Title + time */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-navy leading-snug line-clamp-2 flex-1">
                    {tender.title}
                  </p>
                  <span className="text-[10px] text-muted whitespace-nowrap flex-shrink-0 mt-0.5">
                    {timeAgo(tender.pubDate)}
                  </span>
                </div>

                {/* Org */}
                {tender.org && (
                  <p className="text-[11px] text-muted truncate">{tender.org}</p>
                )}

                {/* Badges + closing date */}
                <div className="flex flex-wrap items-center gap-1">
                  {tender.categories.slice(0, 2).map(c => (
                    <span key={c} className="px-2 py-0.5 bg-navy/5 text-navy rounded-full text-[10px] font-medium">
                      {c}
                    </span>
                  ))}
                  {tender.states.slice(0, 1).map(s => (
                    <span key={s} className="px-2 py-0.5 bg-orange/10 text-orange rounded-full text-[10px] font-medium">
                      {s}
                    </span>
                  ))}
                  {tender.closingDate && (
                    <span className={[
                      'ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                      urgent
                        ? 'bg-danger/10 text-danger'
                        : 'bg-navy/5 text-muted',
                    ].join(' ')}>
                      {urgent ? <AlertTriangle size={9} /> : <Clock size={9} />}
                      {urgent ? `${days}d left` : tender.closingDate.replace(/\d{2}:\d{2} [AP]M$/, '').trim()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={() => setSelectedTender(tender)}
                    className="flex-1 py-2 rounded-xl bg-navy text-white text-xs font-semibold hover:bg-navy/90 transition-colors"
                  >
                    {t('saveTender')}
                  </button>
                  <a
                    href={tender.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl border border-navy/20 text-navy text-xs font-medium hover:bg-navy/5 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink size={11} />
                    {t('viewOn')}
                  </a>
                </div>
              </div>
            )
          })}

          <p className="text-center text-[10px] text-muted pt-1">
            {t('liveFeedSource')}
          </p>
        </div>
      )}

      {/* Save dialog — key forces remount on tender change so useState reinitialises */}
      {selectedTender && user && (
        <SaveTenderDialog
          key={selectedTender.link}
          open={true}
          onClose={() => setSelectedTender(null)}
          aiSummary={selectedTender.org ? `Organisation: ${selectedTender.org}\nClosing: ${selectedTender.closingDate}` : undefined}
          uid={user.uid}
          profile={profile}
          currentTenderCount={tenderCount}
          initialName={selectedTender.title}
          initialCategory={selectedTender.categories[0]}
        />
      )}
    </div>
  )
}

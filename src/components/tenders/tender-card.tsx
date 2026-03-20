'use client'

import { useState, useRef } from 'react'
import { MoreHorizontal, Trophy, XCircle, Archive, ExternalLink } from 'lucide-react'
import { getDeadlineUrgency, formatDeadlineLabel } from '@/lib/deadline-utils'
import { updateTenderStatus, deleteTender } from '@/lib/firebase/firestore'
import type { Tender, TenderStatus } from '@/lib/types'

interface TenderCardProps {
  tender: Tender
}

const STATUS_CONFIG: Record<TenderStatus, { label: string; className: string }> = {
  active:  { label: 'Active',  className: 'bg-navy/10 text-navy' },
  won:     { label: 'Won',     className: 'bg-success/10 text-success' },
  lost:    { label: 'Lost',    className: 'bg-danger/10 text-danger' },
  expired: { label: 'Expired', className: 'bg-muted/20 text-muted' },
}

const URGENCY_DOT: Record<string, string> = {
  red:   'bg-danger',
  amber: 'bg-orange',
  green: 'bg-success',
  none:  '',
}

const URGENCY_TEXT: Record<string, string> = {
  red:   'text-danger',
  amber: 'text-orange',
  green: 'text-success',
  none:  'text-muted',
}

const SWIPE_THRESHOLD = 80
const SWIPE_REVEAL    = 168

export function TenderCard({ tender }: TenderCardProps) {
  const [swipeX, setSwipeX]     = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy]         = useState(false)
  const startXRef               = useRef<number>(0)
  const dragging                = useRef(false)

  const urgency       = getDeadlineUrgency(tender.deadline)
  const deadlineLabel = formatDeadlineLabel(tender.deadline)
  const statusCfg     = STATUS_CONFIG[tender.status]

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    dragging.current  = true
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const delta = startXRef.current - e.touches[0].clientX
    if (delta > 0) setSwipeX(Math.min(delta, SWIPE_REVEAL))
  }
  const handleTouchEnd = () => {
    dragging.current = false
    if (swipeX >= SWIPE_THRESHOLD) { setSwipeX(SWIPE_REVEAL); setRevealed(true) }
    else { setSwipeX(0); setRevealed(false) }
  }
  const closeSwipe = () => { setSwipeX(0); setRevealed(false) }

  const doStatus = async (status: TenderStatus) => {
    setBusy(true)
    try { await updateTenderStatus(tender.id, status) } catch { /* hook reconciles */ }
    finally { setBusy(false); closeSwipe(); setMenuOpen(false) }
  }
  const doDelete = async () => {
    if (!confirm('इस tender को delete करें?')) return
    setBusy(true)
    try { await deleteTender(tender.id) } catch { /* silent */ }
    finally { setBusy(false); closeSwipe(); setMenuOpen(false) }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action panel behind card */}
      <div className="absolute right-0 top-0 bottom-0 flex" style={{ width: SWIPE_REVEAL }}>
        <button onClick={() => doStatus('won')}  disabled={busy} className="flex-1 h-full flex flex-col items-center justify-center gap-1 bg-success text-white text-xs font-medium">
          <Trophy size={16} /> Won
        </button>
        <button onClick={() => doStatus('lost')} disabled={busy} className="flex-1 h-full flex flex-col items-center justify-center gap-1 bg-danger text-white text-xs font-medium">
          <XCircle size={16} /> Lost
        </button>
        <button onClick={doDelete}               disabled={busy} className="flex-1 h-full flex flex-col items-center justify-center gap-1 bg-navy/20 text-navy text-xs font-medium">
          <Archive size={16} /> Delete
        </button>
      </div>

      {/* Main card */}
      <div
        className="relative bg-white border border-navy/10 rounded-xl p-4 transition-transform duration-150"
        style={{ transform: `translateX(-${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={revealed ? closeSwipe : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {urgency !== 'none' && (
              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${URGENCY_DOT[urgency]}`} />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-navy text-sm leading-snug truncate">{tender.name}</p>
              <p className="text-xs text-muted mt-0.5">{tender.category} · {tender.state}</p>
              {tender.gemId && <p className="text-xs text-muted/60 mt-0.5 font-mono">{tender.gemId}</p>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
            {deadlineLabel && (
              <span className={`text-xs font-medium ${URGENCY_TEXT[urgency]}`}>{deadlineLabel}</span>
            )}
            {/* Desktop context menu */}
            <div className="hidden desktop:block relative">
              <button onClick={() => setMenuOpen(v => !v)} className="p-1 text-muted hover:text-navy rounded">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-6 bg-white border border-navy/10 rounded-xl shadow-lg z-10 w-40 overflow-hidden">
                  {(['won','lost','expired'] as TenderStatus[]).map(s => (
                    <button key={s} onClick={() => doStatus(s)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy/5 capitalize">
                      Mark {s}
                    </button>
                  ))}
                  {tender.gemUrl && (
                    <a href={tender.gemUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-navy/5 border-t border-navy/5 text-navy">
                      <ExternalLink size={14} /> Open on GeM
                    </a>
                  )}
                  <button onClick={doDelete} className="w-full text-left px-4 py-2.5 text-sm hover:bg-danger/5 text-danger border-t border-navy/5">
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

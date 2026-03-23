'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { Tender } from '@/lib/types'

interface NotificationBellProps {
  tenders: Tender[]
  locale: string
}

function daysUntil(tender: Tender): number | null {
  if (!tender.deadline) return null
  const ms = tender.deadline.toDate().getTime() - Date.now()
  return Math.ceil(ms / 864e5)
}

export function NotificationBell({ tenders, locale }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const activeTenders = tenders.filter(t => t.status === 'active')

  // Notifications: active tenders with deadline within 14 days
  const upcoming = activeTenders
    .map(t => ({ tender: t, days: daysUntil(t) }))
    .filter(({ days }) => days !== null && days <= 14 && days >= 0)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  const unreadCount = upcoming.length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        className="relative p-2 rounded-xl text-navy/60 hover:text-navy hover:bg-navy/5 transition-colors"
      >
        <Bell size={22} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={v => { if (!v) setOpen(false) }}>
        <SheetContent side="bottom" showCloseButton={false} className="px-4 pb-8 pt-3 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetTitle className="sr-only">Notifications</SheetTitle>
          <div className="w-10 h-1 rounded bg-navy/10 mx-auto mb-4" />

          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-navy" />
            <h2 className="font-heading font-semibold text-navy text-base">Notifications</h2>
          </div>

          {upcoming.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 size={32} className="mx-auto text-navy/20 mb-3" />
              <p className="text-sm font-medium text-navy">All caught up!</p>
              <p className="text-xs text-muted mt-1">No upcoming deadlines in the next 14 days.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(({ tender, days }) => {
                const urgent = (days ?? 0) <= 3
                return (
                  <button
                    key={tender.id}
                    onClick={() => { setOpen(false); router.push(`/${locale}/saved`) }}
                    className="w-full flex items-start gap-3 p-3 rounded-xl bg-white border border-navy/10 hover:border-navy/20 hover:bg-navy/5 transition-colors text-left"
                  >
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${urgent ? 'bg-danger/10' : 'bg-orange/10'}`}>
                      {urgent
                        ? <AlertTriangle size={14} className="text-danger" />
                        : <Clock size={14} className="text-orange" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{tender.name}</p>
                      <p className={`text-xs mt-0.5 font-medium ${urgent ? 'text-danger' : 'text-orange'}`}>
                        {days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`}
                      </p>
                      {tender.category && (
                        <p className="text-[10px] text-muted mt-0.5 truncate">{tender.category}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

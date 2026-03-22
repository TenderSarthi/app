// src/components/dashboard/active-dashboard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, FileText, Bell, BookOpen } from 'lucide-react'
import { deriveDeadlineInfo } from '@/lib/dashboard-utils'
import type { Tender } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'

function formatDeadlineDate(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

interface ActiveDashboardProps {
  locale: string
  tenders: Tender[]
  activeTenders: Tender[]
  usage: AIUsageData
}

export function ActiveDashboard({ locale, tenders, activeTenders, usage }: ActiveDashboardProps) {
  const router   = useRouter()
  const t        = useTranslations('dashboard')
  const tNav     = useTranslations('nav')

  const { nextDeadlineTender, fallbackTender, daysUntilDeadline } = deriveDeadlineInfo(activeTenders)

  const wonCount  = tenders.filter(tender => tender.status === 'won').length
  const bidsCount = usage.bidDocs ?? 0

  const QUICK_ACTIONS = [
    { labelKey: 'find'   as const, icon: Search,   href: '/find'   },
    { labelKey: 'bid'    as const, icon: FileText,  href: '/bid'    },
    { labelKey: 'alerts' as const, icon: Bell,      href: '/alerts' },
    { labelKey: 'learn'  as const, icon: BookOpen,  href: '/learn'  },
  ]

  return (
    <div className="space-y-4">

      {/* ── Deadline card ──────────────────────────────── */}
      <div className="bg-navy rounded-2xl p-4 text-white">
        {activeTenders.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-white/70">{t('noActiveTenders')}</p>
            <button
              onClick={() => router.push(`/${locale}/find`)}
              className="mt-2 text-sm font-semibold text-orange underline underline-offset-2"
            >
              {t('findNewTender')}
            </button>
          </div>
        ) : nextDeadlineTender ? (
          <>
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">{t('nextDeadlineLabel')}</p>
            <p className="font-semibold text-base leading-snug line-clamp-2 mb-2">
              {nextDeadlineTender.name}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/70">
                {formatDeadlineDate(nextDeadlineTender.deadline.toMillis())}
              </p>
              {daysUntilDeadline !== null && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  daysUntilDeadline <= 3 ? 'bg-danger text-white' : 'bg-white/20 text-white'
                }`}>
                  {daysUntilDeadline}d left
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">{t('latestActiveLabel')}</p>
            <p className="font-semibold text-base leading-snug line-clamp-2">
              {fallbackTender?.name}
            </p>
          </>
        )}
      </div>

      {/* ── Stats row ──────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: t('statsActive'), value: activeTenders.length },
          { label: t('statsWon'),    value: wonCount },
          { label: t('statsBids'),   value: bidsCount },
        ] as const).map(({ label, value }) => (
          <div key={label} className="bg-white border border-navy/10 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-navy">{value}</p>
            <p className="text-[10px] text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ──────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-navy uppercase tracking-wide mb-2">
          {t('quickActions')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map(({ labelKey, icon: Icon, href }) => (
            <button
              key={href}
              onClick={() => router.push(`/${locale}${href}`)}
              className="flex items-center gap-2 p-3 bg-white border border-navy/10 rounded-xl hover:bg-navy/5 transition-colors"
            >
              <Icon size={18} className="text-navy flex-shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-navy">{tNav(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}

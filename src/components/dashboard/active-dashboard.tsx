// src/components/dashboard/active-dashboard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, Sparkles, Bell, BookOpen, TrendingUp, Trophy, Zap } from 'lucide-react'
import { deriveDeadlineInfo } from '@/lib/dashboard-utils'
import type { Tender } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'

function formatDeadlineDate(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

const QUICK_ACTIONS = [
  { labelKey: 'tenders' as const, icon: Search,   href: '/tenders', accentBg: 'bg-navy/8',    accentText: 'text-navy'   },
  { labelKey: 'ai'     as const, icon: Sparkles,  href: '/bid',    accentBg: 'bg-orange/10', accentText: 'text-orange' },
  { labelKey: 'alerts' as const, icon: Bell,      href: '/alerts', accentBg: 'bg-gold/10',   accentText: 'text-gold'   },
  { labelKey: 'learn'  as const, icon: BookOpen,  href: '/learn',  accentBg: 'bg-success/10',accentText: 'text-success'},
] as const

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

  return (
    <div className="space-y-4">

      {/* ── Deadline card ──────────────────────────────── */}
      <div className={`rounded-2xl p-4 text-white ${
        daysUntilDeadline !== null && daysUntilDeadline <= 3
          ? 'bg-gradient-to-br from-danger via-danger to-danger/80'
          : 'bg-gradient-to-br from-navy via-navy to-navy/90'
      }`}>
        {activeTenders.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-white/70">{t('noActiveTenders')}</p>
            <button
              onClick={() => router.push(`/${locale}/tenders`)}
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
          { label: t('statsActive'), value: activeTenders.length, icon: TrendingUp, color: 'text-navy',   bg: 'bg-navy/8'    },
          { label: t('statsWon'),    value: wonCount,             icon: Trophy,     color: 'text-gold',   bg: 'bg-gold/10'   },
          { label: t('statsBids'),   value: bidsCount,            icon: Zap,        color: 'text-orange', bg: 'bg-orange/10' },
        ] as const).map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-navy/10 rounded-xl p-3 text-center shadow-sm">
            <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1`}>
              <Icon size={14} className={color} aria-hidden="true" />
            </div>
            <p className="text-xl font-bold text-navy leading-tight">{value}</p>
            <p className="text-[10px] text-muted mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ──────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
          {t('quickActions')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map(({ labelKey, icon: Icon, href, accentBg, accentText }) => (
            <button
              key={href}
              onClick={() => router.push(`/${locale}${href}`)}
              className="flex items-center gap-3 p-3 bg-white border border-navy/10 rounded-xl hover:border-navy/30 hover:shadow-sm active:scale-[0.98] transition-all"
            >
              <div className={`w-8 h-8 rounded-lg ${accentBg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={accentText} aria-hidden="true" />
              </div>
              <span className="text-sm font-medium text-navy">{tNav(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}

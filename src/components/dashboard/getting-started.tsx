// src/components/dashboard/getting-started.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, ArrowRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserProfile, Tender } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'

interface GettingStartedProps {
  locale: string
  profile: UserProfile
  tenders: Tender[]
  usage: AIUsageData
}

interface StepItemProps {
  num: 1 | 2 | 3
  state: 'done' | 'active' | 'locked'
  label: string
  sub?: string
  onClick?: () => void
}

function StepItem({ num, state, label, sub, onClick }: StepItemProps) {
  return (
    <button
      onClick={state === 'active' ? onClick : undefined}
      aria-disabled={state !== 'active'}
      tabIndex={state !== 'active' ? -1 : undefined}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all',
        state === 'active' && 'bg-white border-2 border-navy shadow-sm active:scale-[0.99]',
        state === 'done'   && 'bg-white border border-navy/10',
        state === 'locked' && 'bg-white border border-navy/10 opacity-40 pointer-events-none'
      )}
    >
      {/* Numbered badge */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors',
        state === 'done'   && 'bg-success text-white',
        state === 'active' && 'bg-navy text-white',
        state === 'locked' && 'bg-navy/15 text-navy/40'
      )}>
        {state === 'done' ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : num}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', state === 'done' ? 'text-navy/50 line-through' : 'text-navy')}>
          {label}
        </p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>

      {state === 'active' && (
        <ArrowRight size={18} className="text-navy flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      {state === 'locked' && (
        <Lock size={14} className="text-muted/60 flex-shrink-0 mt-1" aria-hidden="true" />
      )}
    </button>
  )
}

export function GettingStarted({ locale, profile, tenders, usage }: GettingStartedProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')

  const step2Complete = tenders.length > 0
  const step3Complete = (usage.bidDocs ?? 0) > 0

  const showTip = !!profile.categories[0] && !!profile.state

  const completedCount = [true, step2Complete, step3Complete].filter(Boolean).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-lg text-navy">{t('gettingStartedTitle')}</h2>
        <span className="text-xs text-muted font-medium">{completedCount}/3</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-navy/10 rounded-full overflow-hidden -mt-2">
        <div
          className="h-full bg-success rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / 3) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {/* Step 1: always done */}
        <StepItem num={1} state="done" label={t('step1Done')} />

        {/* Step 2: active CTA — navigates to /find */}
        <StepItem
          num={2}
          state={step2Complete ? 'done' : 'active'}
          label={t('step2')}
          sub={step2Complete ? undefined : t('step2Sub')}
          onClick={() => router.push(`/${locale}/find`)}
        />

        {/* Step 3: locked until step 2 complete */}
        <StepItem
          num={3}
          state={step3Complete ? 'done' : 'locked'}
          label={t('step3')}
          sub={t('step3Sub')}
        />
      </div>

      {/* Tip card */}
      {showTip && (
        <div className="bg-orange/5 border border-orange/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-orange mb-1">{t('tipLabel')}</p>
          <p className="text-sm text-navy/80 leading-relaxed">
            {t('tipBody', { category: profile.categories[0], state: profile.state })}
          </p>
        </div>
      )}
    </div>
  )
}

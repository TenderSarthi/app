// src/components/dashboard/getting-started.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle, ArrowRight, Lock } from 'lucide-react'
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
  state: 'done' | 'active' | 'locked'
  label: string
  sub?: string
  onClick?: () => void
}

function StepItem({ state, label, sub, onClick }: StepItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={state !== 'active'}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors',
        state === 'active' && 'bg-white border-2 border-navy shadow-sm',
        state === 'done'   && 'bg-white border border-navy/10',
        state === 'locked' && 'bg-white border border-navy/10 opacity-50 pointer-events-none'
      )}
    >
      {state === 'done' && (
        <CheckCircle2 size={20} className="text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      {state === 'locked' && (
        <Lock size={20} className="text-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      {state === 'active' && (
        <Circle size={20} className="text-navy flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', state === 'done' ? 'text-navy/60 line-through' : 'text-navy')}>
          {label}
        </p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>

      {state === 'active' && (
        <ArrowRight size={18} className="text-navy flex-shrink-0 mt-0.5" aria-hidden="true" />
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

  return (
    <div className="space-y-4">
      <h2 className="font-heading font-bold text-lg text-navy">{t('gettingStartedTitle')}</h2>

      <div className="space-y-2">
        {/* Step 1: always done */}
        <StepItem state="done" label={t('step1Done')} />

        {/* Step 2: active CTA — navigates to /find */}
        <StepItem
          state={step2Complete ? 'done' : 'active'}
          label={t('step2')}
          sub={step2Complete ? undefined : t('step2Sub')}
          onClick={() => router.push(`/${locale}/find`)}
        />

        {/* Step 3: locked until step 2 complete (on this view always locked) */}
        <StepItem
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

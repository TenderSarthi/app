'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import type { Timestamp } from 'firebase/firestore'

interface TrialBannerProps {
  trialEndsAt: Timestamp | null
  createdAt: Timestamp
  onUpgrade: () => void
}

export function TrialBanner({ trialEndsAt, createdAt, onUpgrade }: TrialBannerProps) {
  const t = useTranslations('dashboard')

  const now = Date.now()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  if (now - createdAt.toMillis() > sevenDaysMs) return null
  if (!trialEndsAt) return null

  const daysLeft = Math.max(
    0,
    Math.ceil((trialEndsAt.toMillis() - now) / (24 * 60 * 60 * 1000))
  )

  return (
    <div className="bg-gradient-to-r from-orange/10 to-gold/10 border border-orange/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="font-semibold text-navy text-sm">
          {t('trialBannerTitle', { days: daysLeft })}
        </p>
        <p className="text-muted text-xs mt-0.5">{t('trialBannerSubtitle')}</p>
      </div>
      <Button
        size="sm"
        className="bg-orange text-white hover:bg-orange/90 shrink-0"
        onClick={onUpgrade}
      >
        {t('trialBannerCta')}
      </Button>
    </div>
  )
}

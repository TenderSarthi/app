'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText } from 'lucide-react'
import { TenderCard } from './tender-card'
import { TenderStatusDialog } from './tender-status-dialog'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import type { Tender } from '@/lib/types'

const FREE_LIMIT = 5

interface TenderListProps {
  tenders: Tender[]
  totalCount: number
  isPro: boolean
}

export function TenderList({ tenders, totalCount, isPro }: TenderListProps) {
  const t = useTranslations('tenders')
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const showWarning = !isPro && totalCount >= FREE_LIMIT - 1

  if (tenders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-navy/5 rounded-2xl flex items-center justify-center mb-4">
          <FileText className="text-navy/30" size={28} />
        </div>
        <p className="font-semibold text-navy">{t('emptyTitle')}</p>
        <p className="text-sm text-muted mt-1 max-w-xs">{t('emptySubtitle')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showWarning && (
        <div className="bg-orange/5 border border-orange/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-orange">
            {t('limitWarning', { used: totalCount, limit: FREE_LIMIT })}
          </p>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="text-sm font-semibold text-orange underline shrink-0"
          >
            {t('upgrade')}
          </button>
        </div>
      )}

      {tenders.map(tender => (
        <TenderCard key={tender.id} tender={tender} />
      ))}

      <TenderStatusDialog tender={selectedTender} onClose={() => setSelectedTender(null)} />
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="tender_limit" />
    </div>
  )
}

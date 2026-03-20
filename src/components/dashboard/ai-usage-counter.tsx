'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { UpgradeDialog } from './upgrade-dialog'
import type { AIUsageData } from '@/lib/firebase/firestore'

const FREE_LIMIT = 10

interface AIUsageCounterProps {
  usage: AIUsageData
  isPro: boolean
}

export function AIUsageCounter({ usage, isPro }: AIUsageCounterProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const isNearLimit = !isPro && usage.queries >= FREE_LIMIT - 2
  const isAtLimit   = !isPro && usage.queries >= FREE_LIMIT

  if (isPro) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-gold/10 text-gold px-3 py-1.5 rounded-full text-sm font-medium">
        <Sparkles size={14} />
        AI: Pro ✦
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className={[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
          isAtLimit
            ? 'bg-danger/10 text-danger'
            : isNearLimit
              ? 'bg-orange/10 text-orange'
              : 'bg-navy/5 text-navy',
        ].join(' ')}
      >
        <Sparkles size={14} />
        AI: {usage.queries}/{FREE_LIMIT} ✦
      </button>
      <UpgradeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        trigger="ai_limit"
      />
    </>
  )
}

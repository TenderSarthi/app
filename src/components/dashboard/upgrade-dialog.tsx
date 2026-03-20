'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Zap, CheckCircle } from 'lucide-react'
import { track } from '@/lib/posthog'

interface UpgradeDialogProps {
  open: boolean
  onClose: () => void
  trigger?: 'ai_limit' | 'tender_limit' | 'feature_gate' | 'trial_cta'
}

const PRO_FEATURES = [
  'Unlimited AI queries',
  'Unlimited tender saves',
  'Bid Document Generator',
  'Document Vault',
  'WhatsApp alerts',
  'Orders Tracker',
  'Priority support',
]

export function UpgradeDialog({ open, onClose, trigger }: UpgradeDialogProps) {
  const t = useTranslations('planGate')

  useEffect(() => {
    if (open) track('upgrade_prompt_seen', { trigger: trigger ?? 'unknown' })
  }, [open, trigger])

  const handleUpgrade = (plan: 'monthly' | 'annual') => {
    window.location.href = '/settings?upgrade=' + plan
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-navy">
            <Zap className="text-orange" size={20} />
            Pro में Upgrade करें
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-2">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-navy">
                <CheckCircle className="text-success shrink-0" size={16} />
                {f}
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleUpgrade('monthly')}
              className="border-2 border-orange rounded-xl p-3 text-center hover:bg-orange/5 transition-colors"
            >
              <div className="font-bold text-navy">{t('upgradeMonthly')}</div>
              <div className="text-xs text-muted mt-0.5">per month</div>
            </button>
            <button
              onClick={() => handleUpgrade('annual')}
              className="border-2 border-gold bg-gold/5 rounded-xl p-3 text-center hover:bg-gold/10 transition-colors relative"
            >
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gold text-white text-xs px-2">
                Best Value
              </Badge>
              <div className="font-bold text-navy">{t('upgradeAnnual')}</div>
              <div className="text-xs text-muted mt-0.5">per year</div>
            </button>
          </div>

          <Button variant="ghost" className="w-full text-muted" onClick={onClose}>
            अभी नहीं
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'
import { useTranslations } from 'next-intl'
import { Bell, Lock } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useAlertConfig } from '@/lib/hooks/use-alert-config'
import { isPro } from '@/lib/plan-guard'
import { AlertConfigForm } from '@/components/alerts/alert-config-form'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { useState } from 'react'

export default function AlertsPage() {
  const t = useTranslations('alerts')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { config, loading, saving, save } = useAlertConfig(user?.uid ?? null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  if (!profile || !user || loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-36 bg-navy/5 rounded-lg animate-pulse" />
        <div className="h-64 bg-navy/5 rounded-xl animate-pulse" />
      </div>
    )
  }

  const userIsPro = isPro(profile)

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-navy" />
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
      </div>
      <p className="text-sm text-muted">{t('subtitle')}</p>

      {!userIsPro ? (
        <div className="bg-orange/5 border border-orange/20 rounded-xl p-5 text-center space-y-3">
          <Lock className="mx-auto text-orange" size={28} />
          <p className="font-semibold text-navy text-sm">{t('proOnly')}</p>
          <p className="text-sm text-muted">{t('proOnlySub')}</p>
          <button onClick={() => setUpgradeOpen(true)}
            className="px-6 py-2.5 rounded-xl bg-orange text-white font-semibold text-sm">
            {t('upgradeCta')}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-xl p-4">
          <AlertConfigForm initial={config} saving={saving} onSave={save} />
        </div>
      )}

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useVaultDocuments } from '@/lib/hooks/use-vault-documents'
import { isPro } from '@/lib/plan-guard'
import { VaultChecklist } from '@/components/documents/vault-checklist'
import { DocumentCard } from '@/components/documents/document-card'
import { VaultFab } from '@/components/documents/vault-fab'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'

export default function DocumentsPage() {
  const t = useTranslations('documents')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { documents, loading } = useVaultDocuments(user?.uid ?? null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  if (!profile || !user) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 bg-navy/5 rounded-lg animate-pulse" />
        <div className="h-32 bg-navy/5 rounded-xl animate-pulse" />
      </div>
    )
  }

  const userIsPro = isPro(profile)

  // Free users: show checklist + upgrade prompt, no documents
  if (!userIsPro) {
    return (
      <div className="space-y-4 pb-6">
        <div>
          <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('subtitle')}</p>
        </div>

        <VaultChecklist documents={[]} categories={profile.categories} />

        <div className="bg-orange/5 border border-orange/20 rounded-xl p-5 text-center space-y-3">
          <Lock className="mx-auto text-orange" size={28} />
          <p className="font-semibold text-navy text-sm">{t('proOnly')}</p>
          <p className="text-sm text-muted">{t('proOnlySubtitle')}</p>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="mt-1 px-6 py-2.5 rounded-xl bg-orange text-white font-semibold text-sm"
          >
            {t('upgradeBtn')}
          </button>
        </div>
        <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('subtitle')}</p>
      </div>

      <VaultChecklist documents={documents} categories={profile.categories} />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-navy/5 rounded-xl animate-pulse" />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="font-semibold text-navy">{t('noDocuments')}</p>
          <p className="text-sm text-muted mt-1 max-w-xs">{t('noDocumentsSubtitle')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => <DocumentCard key={doc.id} document={doc} />)}
        </div>
      )}

      <VaultFab uid={user.uid} profile={profile} />
    </div>
  )
}

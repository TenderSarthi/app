'use client'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react'
import { DocumentTypeIcon } from './document-type-icon'
import { getRequiredDocTypes, getVaultProgress, isDocumentExpiringSoon, isDocumentExpired } from '@/lib/vault-utils'
import type { VaultDocument } from '@/lib/types'

interface VaultChecklistProps {
  documents: VaultDocument[]
  categories: string[]
}

export function VaultChecklist({ documents, categories }: VaultChecklistProps) {
  const t             = useTranslations('documents')
  const requiredTypes = getRequiredDocTypes(categories)
  const { uploaded, required, percent } = getVaultProgress(documents, categories)
  const docByType     = new Map(documents.map(d => [d.type, d]))

  return (
    <div className="bg-white border border-navy/10 rounded-xl overflow-hidden">
      {/* Progress header */}
      <div className="px-4 py-3 border-b border-navy/10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-navy">{t('checklistTitle')}</p>
          <span className="text-sm font-bold text-navy">{uploaded}/{required}</span>
        </div>
        <div className="w-full h-2 bg-navy/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Checklist rows */}
      <div className="divide-y divide-navy/5">
        {requiredTypes.map(type => {
          const doc        = docByType.get(type as any)
          const isUploaded = !!doc
          const expiring   = doc ? isDocumentExpiringSoon(doc) : false
          const expired    = doc ? isDocumentExpired(doc)      : false

          return (
            <div key={type} className="flex items-center gap-3 px-4 py-3">
              {isUploaded ? (
                expired   ? <AlertTriangle size={18} className="text-danger shrink-0" /> :
                expiring  ? <AlertTriangle size={18} className="text-orange shrink-0" /> :
                            <CheckCircle2 size={18} className="text-success shrink-0" />
              ) : (
                <Circle size={18} className="text-navy/20 shrink-0" />
              )}
              <DocumentTypeIcon type={type as any} showLabel size={16} />
              {expired   && <span className="ml-auto text-xs font-medium text-danger">{t('expired')}</span>}
              {!expired && expiring && <span className="ml-auto text-xs font-medium text-orange">{t('expiringSoon')}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'
import { useState, useCallback } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { DocumentTypeIcon, getDocTypeLabel } from './document-type-icon'
import { deleteVaultDocument } from '@/lib/firebase/firestore'
import { deleteVaultFile } from '@/lib/firebase/storage'
import { isDocumentExpiringSoon, isDocumentExpired } from '@/lib/vault-utils'
import type { VaultDocument } from '@/lib/types'

interface DocumentCardProps { document: VaultDocument }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentCard({ document: doc }: DocumentCardProps) {
  const t = useTranslations('documents')
  const locale = useLocale()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy]                   = useState(false)

  const expiringSoon = isDocumentExpiringSoon(doc)
  const expired      = isDocumentExpired(doc)
  const expiryLabel = doc.expiresAt
    ? doc.expiresAt.toDate().toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const handleDelete = useCallback(async () => {
    setBusy(true)
    try {
      await deleteVaultFile(doc.storagePath)
      await deleteVaultDocument(doc.id)
    } catch { /* silent — Firestore onSnapshot will reconcile */ }
    finally { setBusy(false); setConfirmDelete(false) }
  }, [doc.id, doc.storagePath])

  return (
    <div className={[
      'bg-white border rounded-xl p-4 flex items-start gap-3',
      expired      ? 'border-danger/30'  :
      expiringSoon ? 'border-orange/30'  : 'border-navy/10',
    ].join(' ')}>
      <DocumentTypeIcon type={doc.type} size={22} />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-navy text-sm truncate">{doc.fileName}</p>
        <p className="text-xs text-muted mt-0.5">{getDocTypeLabel(doc.type)} · {formatBytes(doc.fileSize)}</p>

        {expiryLabel && (
          <p className={`text-xs mt-1 font-medium ${expired ? 'text-danger' : expiringSoon ? 'text-orange' : 'text-muted'}`}>
            {expired ? t('expired') : expiringSoon ? t('expiringSoon') : t('expires')} {expiryLabel}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <a
          href={doc.storageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-navy/50 hover:text-navy rounded-lg hover:bg-navy/5"
          aria-label={t('preview')}
        >
          <ExternalLink size={16} />
        </a>

        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={handleDelete} disabled={busy}
              className="text-xs font-semibold text-danger px-2 py-1 rounded-lg hover:bg-danger/5">
              {t('confirm')}
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted px-2 py-1 rounded-lg hover:bg-navy/5">
              {t('cancel')}
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-navy/50 hover:text-danger rounded-lg hover:bg-danger/5"
            aria-label={t('delete')}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Upload, File as FileIcon } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { uploadVaultFile } from '@/lib/firebase/storage'
import { addVaultDocument } from '@/lib/firebase/firestore'
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants'
import type { DocumentType } from '@/lib/types'
import { Timestamp } from 'firebase/firestore'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

interface UploadDocumentDialogProps {
  open: boolean
  onClose: () => void
  uid: string
}

export function UploadDocumentDialog({ open, onClose, uid }: UploadDocumentDialogProps) {
  const t            = useTranslations('documents')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile]           = useState<File | null>(null)
  const [docType, setDocType]     = useState<DocumentType | ''>('')
  const [expiryDate, setExpiry]   = useState('')
  const [progress, setProgress]   = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const reset = () => {
    setFile(null); setDocType(''); setExpiry(''); setProgress(0)
    setUploading(false); setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => { reset(); onClose() }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setError(null)
    if (!f) { setFile(null); return }
    if (!ACCEPTED_TYPES.includes(f.type)) { setError(t('errorFileType')); return }
    if (f.size > MAX_FILE_SIZE) { setError(t('errorFileSize')); return }
    setFile(f)
  }

  const handleUpload = async () => {
    if (!file || !docType) return
    setUploading(true); setError(null)
    try {
      const { storagePath, storageUrl } = await uploadVaultFile(uid, file, setProgress)
      await addVaultDocument(uid, {
        type: docType,
        fileName: file.name,
        fileSize: file.size,
        storagePath,
        storageUrl,
        expiresAt: expiryDate ? Timestamp.fromDate(new Date(expiryDate)) : null,
        expiryAlertSent: false,
      })
      handleClose()
    } catch {
      setError(t('errorUpload'))
      setUploading(false)
    }
  }

  const canUpload = !!file && !!docType && !uploading

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-navy text-left">{t('uploadTitle')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-navy/20 rounded-xl p-6 text-center cursor-pointer hover:border-navy/40 transition-colors"
          >
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileIcon size={20} className="text-navy" />
                <span className="text-sm font-medium text-navy truncate max-w-[200px]">{file.name}</span>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-muted mb-2" />
                <p className="text-sm text-muted">{t('filePicker')}</p>
                <p className="text-xs text-muted/60 mt-1">{t('filePickerHint')}</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Document type */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1">{t('docType')}</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as DocumentType)}
              className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white"
            >
              <option value="">{t('selectDocType')}</option>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Expiry date (optional) */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              {t('expiryDate')} <span className="text-muted font-normal">({t('optional')})</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiry(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white"
            />
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-xs text-muted text-center">{progress}%</p>
            </div>
          )}

          {/* Error */}
          {error && <p className="text-sm text-danger">{error}</p>}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className="w-full py-3 rounded-xl bg-navy text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? t('uploading') : t('upload')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

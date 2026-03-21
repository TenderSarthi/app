# Subsystem 4 — Document Vault Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Pro-only Document Vault at `/documents` where GeM vendors can upload, tag, and track expiry of compliance documents (RC, GST, Insurance, ITR, MSME, PAN, Udyam), with a category-based checklist showing upload progress.

**Architecture:** Pure utility layer first (vault-utils: checklist logic, expiry detection) → Firestore/Storage data layer → display components (DocumentCard, UploadDocumentDialog) → VaultChecklist with progress bar → page assembly. Firebase Storage handles file bytes; Firestore stores metadata only. Free users see the checklist read-only; upload is Pro-gated.

> **Scope note:** PRD 7.4 specifies "Expiry alerts: WhatsApp + push 30 days before expiry." This plan implements the **in-app visual warning** only (`isDocumentExpiringSoon` → orange badge in VaultChecklist and DocumentCard). The notification delivery (Cloud Functions scheduled job that sends WhatsApp/FCM when `expiresAt` is within 30 days) is **deferred to Subsystem 6 — Alert System**, which owns all notification infrastructure. The `expiresAt` Firestore field stored here is what Subsystem 6 will query.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · shadcn/ui · Firebase Storage (uploadBytesResumable) · Firebase Firestore · next-intl v4 · Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | Add `DocumentType`, `VaultDocument` interface |
| `src/lib/constants.ts` | Modify | Add `DOCUMENT_TYPES`, `DOCUMENT_TYPE_LABELS`, `CATEGORY_DOCUMENT_REQUIREMENTS`, `BASE_REQUIRED_DOCS` |
| `src/lib/vault-utils.ts` | Create | Pure: `getRequiredDocTypes`, `getVaultProgress`, `isDocumentExpiringSoon`, `isDocumentExpired` |
| `tests/unit/vault-utils.test.ts` | Create | ~13 unit tests for vault-utils |
| `src/lib/firebase/firestore.ts` | Modify | Add `addVaultDocument`, `subscribeUserDocuments`, `deleteVaultDocument` |
| `src/lib/firebase/storage.ts` | Create | `uploadVaultFile` (with progress callback), `deleteVaultFile` |
| `src/lib/hooks/use-vault-documents.ts` | Create | Real-time listener for user's documents |
| `firestore.rules` | Modify | Add documents collection rules |
| `storage.rules` | Create | Storage rules scoped by uid |
| `src/components/documents/document-type-icon.tsx` | Create | Icon + label map for all 8 doc types |
| `src/components/documents/document-card.tsx` | Create | Card: type icon, name, expiry badge, preview link, delete action |
| `src/components/documents/upload-document-dialog.tsx` | Create | Sheet: file picker, type select, expiry date, upload progress |
| `src/components/documents/vault-checklist.tsx` | Create | Category checklist with progress bar, expiry warnings |
| `src/components/documents/vault-fab.tsx` | Create | FAB: opens UploadDocumentDialog (Pro) or UpgradeDialog (free) |
| `src/app/[locale]/(app)/documents/page.tsx` | Replace | Page assembly |
| `messages/*.json` (11 files) | Modify | Add `documents.*` namespace |

---

## Chunk 1: Utilities

### Task 1: Types + Constants + vault-utils + Tests

#### Steps

- [ ] **Step 1.1 — Write failing tests first**

  Create `tests/unit/vault-utils.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest'
  import { Timestamp } from 'firebase/firestore'
  import {
    getRequiredDocTypes,
    getVaultProgress,
    isDocumentExpiringSoon,
    isDocumentExpired,
  } from '@/lib/vault-utils'
  import type { VaultDocument } from '@/lib/types'

  function makeDoc(type: string, expiresAt: Timestamp | null = null): VaultDocument {
    return {
      id: '1', userId: 'u1', type: type as any, fileName: 'test.pdf',
      fileSize: 1000, storagePath: 'docs/u1/test.pdf', storageUrl: 'https://example.com',
      expiresAt, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }
  }

  function daysFromNow(n: number): Timestamp {
    const d = new Date(); d.setDate(d.getDate() + n); return Timestamp.fromDate(d)
  }

  describe('getRequiredDocTypes', () => {
    it('returns gst and pan for empty categories', () => {
      expect(getRequiredDocTypes([])).toEqual(expect.arrayContaining(['gst', 'pan']))
    })
    it('always includes gst and pan regardless of category', () => {
      const types = getRequiredDocTypes(['IT & Electronics'])
      expect(types).toContain('gst')
      expect(types).toContain('pan')
    })
    it('includes rc and insurance for Transport & Vehicles', () => {
      const types = getRequiredDocTypes(['Transport & Vehicles'])
      expect(types).toContain('rc')
      expect(types).toContain('insurance')
    })
    it('takes union across multiple categories', () => {
      const types = getRequiredDocTypes(['Transport & Vehicles', 'IT & Electronics'])
      expect(types).toContain('rc')
      expect(types).toContain('msme')
    })
  })

  describe('getVaultProgress', () => {
    it('returns 100% when no categories (no requirements)', () => {
      expect(getVaultProgress([], []).percent).toBe(100)
    })
    it('returns 0% when no docs uploaded', () => {
      const { percent } = getVaultProgress([], ['IT & Electronics'])
      expect(percent).toBe(0)
    })
    it('returns 100% when all required docs uploaded', () => {
      const docs = ['gst', 'pan', 'msme'].map(t => makeDoc(t))
      expect(getVaultProgress(docs, ['IT & Electronics']).percent).toBe(100)
    })
    it('counts uploaded/required correctly', () => {
      const docs = [makeDoc('gst')]
      const { uploaded, required } = getVaultProgress(docs, ['IT & Electronics'])
      expect(uploaded).toBe(1)
      expect(required).toBe(3) // gst, pan, msme
    })
  })

  describe('isDocumentExpiringSoon', () => {
    it('returns false for null expiresAt', () => {
      expect(isDocumentExpiringSoon(makeDoc('gst', null))).toBe(false)
    })
    it('returns true for doc expiring in 15 days', () => {
      expect(isDocumentExpiringSoon(makeDoc('gst', daysFromNow(15)))).toBe(true)
    })
    it('returns false for doc expiring in 31 days', () => {
      expect(isDocumentExpiringSoon(makeDoc('gst', daysFromNow(31)))).toBe(false)
    })
  })

  describe('isDocumentExpired', () => {
    it('returns false for null expiresAt', () => {
      expect(isDocumentExpired(makeDoc('gst', null))).toBe(false)
    })
    it('returns true for past expiry', () => {
      expect(isDocumentExpired(makeDoc('gst', daysFromNow(-1)))).toBe(true)
    })
    it('returns false for future expiry', () => {
      expect(isDocumentExpired(makeDoc('gst', daysFromNow(5)))).toBe(false)
    })
  })
  ```

- [ ] **Step 1.2 — Run tests; expect failure (module not found)**

  ```bash
  cd app && npx vitest run tests/unit/vault-utils.test.ts
  ```

  Expected: `Cannot find module '@/lib/vault-utils'`

- [ ] **Step 1.3 — Add `DocumentType`, `VaultDocument`, and `isValidDocumentType` to `src/lib/types.ts`**

  Append to the existing exports in `src/lib/types.ts`:

  ```typescript
  export type DocumentType = 'rc' | 'gst' | 'insurance' | 'itr' | 'msme' | 'pan' | 'udyam' | 'other'

  export interface VaultDocument {
    id: string
    userId: string
    type: DocumentType
    fileName: string
    fileSize: number          // bytes
    storagePath: string       // Firebase Storage path, e.g. documents/{uid}/{timestamp}_{name}
    storageUrl: string        // Firebase Storage download URL
    expiresAt: Timestamp | null
    createdAt: Timestamp
    updatedAt: Timestamp
  }

  export function isValidDocumentType(s: unknown): s is DocumentType {
    return ['rc','gst','insurance','itr','msme','pan','udyam','other'].includes(s as string)
  }
  ```

  Note: `Timestamp` is already imported from `firebase/firestore` in `types.ts`; add that import if not present.

- [ ] **Step 1.4 — Add constants to `src/lib/constants.ts`**

  Append to the existing exports in `src/lib/constants.ts`:

  ```typescript
  export const DOCUMENT_TYPES = ['rc', 'gst', 'insurance', 'itr', 'msme', 'pan', 'udyam', 'other'] as const

  export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    rc:        'RC (Registration Certificate)',
    gst:       'GST Certificate',
    insurance: 'Insurance',
    itr:       'ITR (Income Tax Return)',
    msme:      'MSME Certificate',
    pan:       'PAN Card',
    udyam:     'Udyam Certificate',
    other:     'Other',
  }

  // Minimum docs required per GeM category. Union of user's categories determines checklist.
  export const CATEGORY_DOCUMENT_REQUIREMENTS: Record<string, string[]> = {
    'Transport & Vehicles':          ['rc', 'insurance', 'gst', 'pan'],
    'IT & Electronics':              ['gst', 'pan', 'msme'],
    'Medical & Healthcare':          ['gst', 'pan', 'msme', 'udyam'],
    'Construction & Infrastructure': ['gst', 'pan', 'msme', 'itr'],
    'Stationery & Office Supplies':  ['gst', 'pan'],
    'Furniture & Fixtures':          ['gst', 'pan', 'msme'],
    'Uniforms & Clothing':           ['gst', 'pan', 'msme'],
    'Agriculture & Food':            ['gst', 'pan', 'msme'],
    'Security Services':             ['gst', 'pan', 'msme', 'itr'],
    'Printing & Publishing':         ['gst', 'pan', 'msme'],
    'Electrical & Lighting':         ['gst', 'pan', 'msme'],
    'Plumbing & Sanitation':         ['gst', 'pan', 'msme'],
    'Cleaning & Housekeeping':       ['gst', 'pan', 'msme'],
    'Other':                         ['gst', 'pan'],
  }

  // Always required regardless of category
  export const BASE_REQUIRED_DOCS = ['gst', 'pan'] as const
  ```

- [ ] **Step 1.5 — Create `src/lib/vault-utils.ts`**

  ```typescript
  import type { VaultDocument } from './types'

  export function getRequiredDocTypes(categories: string[]): string[] {
    const required = new Set<string>(['gst', 'pan'])
    const REQS: Record<string, string[]> = {
      'Transport & Vehicles':          ['rc', 'insurance', 'gst', 'pan'],
      'IT & Electronics':              ['gst', 'pan', 'msme'],
      'Medical & Healthcare':          ['gst', 'pan', 'msme', 'udyam'],
      'Construction & Infrastructure': ['gst', 'pan', 'msme', 'itr'],
      'Stationery & Office Supplies':  ['gst', 'pan'],
      'Furniture & Fixtures':          ['gst', 'pan', 'msme'],
      'Uniforms & Clothing':           ['gst', 'pan', 'msme'],
      'Agriculture & Food':            ['gst', 'pan', 'msme'],
      'Security Services':             ['gst', 'pan', 'msme', 'itr'],
      'Printing & Publishing':         ['gst', 'pan', 'msme'],
      'Electrical & Lighting':         ['gst', 'pan', 'msme'],
      'Plumbing & Sanitation':         ['gst', 'pan', 'msme'],
      'Cleaning & Housekeeping':       ['gst', 'pan', 'msme'],
      'Other':                         ['gst', 'pan'],
    }
    for (const cat of categories) {
      for (const type of REQS[cat] ?? []) required.add(type)
    }
    return [...required]
  }

  export interface VaultProgress { uploaded: number; required: number; percent: number }

  export function getVaultProgress(docs: VaultDocument[], categories: string[]): VaultProgress {
    const requiredTypes = getRequiredDocTypes(categories)
    const uploadedTypes = new Set(docs.map(d => d.type))
    const uploaded = requiredTypes.filter(t => uploadedTypes.has(t)).length
    const required = requiredTypes.length
    return { uploaded, required, percent: required === 0 ? 100 : Math.round((uploaded / required) * 100) }
  }

  export function isDocumentExpiringSoon(doc: VaultDocument): boolean {
    if (!doc.expiresAt) return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const expireDay = doc.expiresAt.toDate(); expireDay.setHours(0, 0, 0, 0)
    const daysLeft = Math.round((expireDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysLeft >= 0 && daysLeft <= 30
  }

  export function isDocumentExpired(doc: VaultDocument): boolean {
    if (!doc.expiresAt) return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const expireDay = doc.expiresAt.toDate(); expireDay.setHours(0, 0, 0, 0)
    return expireDay.getTime() < today.getTime()
  }
  ```

- [ ] **Step 1.6 — Run tests; expect 13 passed**

  ```bash
  cd app && npx vitest run tests/unit/vault-utils.test.ts
  ```

  Expected output: `13 passed`

- [ ] **Step 1.7 — TypeScript check**

  ```bash
  cd app && npx tsc --noEmit
  ```

  Expected: 0 errors.

- [ ] **Step 1.8 — Commit**

  ```bash
  cd app && git add src/lib/types.ts src/lib/constants.ts src/lib/vault-utils.ts tests/unit/vault-utils.test.ts
  git commit -m "feat(vault): add VaultDocument types, constants, and vault-utils with 13 tests"
  ```

---

## Chunk 2: Data Layer

### Task 2: Firestore + Storage + Hook + Rules

#### Steps

- [ ] **Step 2.1 — Add vault functions to `src/lib/firebase/firestore.ts`**

  > **Note:** The imports `addDoc`, `deleteDoc`, `onSnapshot`, `orderBy`, `query`, `where`, `QuerySnapshot`, `DocumentData` already exist in `firestore.ts` from Subsystem 3. Do NOT re-add them. Only add `type VaultDocument` to the existing type import line.

  The type import line to update is:
  ```typescript
  import type { UserProfile, OnboardingData, LanguageCode, Tender, TenderStatus, PlatformStats, VaultDocument } from '../types'
  ```
  (add `VaultDocument` to the existing import, don't create a new one)

  Then append these three functions to the bottom of the file:

  ```typescript
  // ---------- Document Vault ----------

  /** Saves new vault document metadata. Returns the new Firestore document ID. */
  export async function addVaultDocument(
    uid: string,
    data: Omit<VaultDocument, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const ref = await addDoc(collection(db, 'documents'), {
      ...data,
      userId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  /** Real-time listener on user's vault documents, ordered by createdAt desc. */
  export function subscribeUserDocuments(
    uid: string,
    onData: (docs: VaultDocument[]) => void,
    onError: (err: Error) => void
  ): () => void {
    const q = query(
      collection(db, 'documents'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as VaultDocument)))
      },
      onError
    )
  }

  /** Deletes vault document metadata from Firestore (caller deletes Storage file separately). */
  export async function deleteVaultDocument(documentId: string): Promise<void> {
    await deleteDoc(doc(db, 'documents', documentId))
  }
  ```

- [ ] **Step 2.2 — Create `src/lib/firebase/storage.ts`**

  ```typescript
  import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
  import { storage } from './config'

  export interface UploadResult { storagePath: string; storageUrl: string }

  /**
   * Uploads a file to Firebase Storage under documents/{uid}/{timestamp}_{filename}.
   * Calls onProgress(0-100) during upload.
   */
  export function uploadVaultFile(
    uid: string,
    file: File,
    onProgress: (percent: number) => void
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const storagePath = `documents/${uid}/${Date.now()}_${file.name}`
      const task = uploadBytesResumable(ref(storage, storagePath), file)
      task.on(
        'state_changed',
        (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => {
          const storageUrl = await getDownloadURL(task.snapshot.ref)
          resolve({ storagePath, storageUrl })
        }
      )
    })
  }

  /** Deletes a file from Firebase Storage by its storagePath. */
  export async function deleteVaultFile(storagePath: string): Promise<void> {
    await deleteObject(ref(storage, storagePath))
  }
  ```

- [ ] **Step 2.3 — Create `src/lib/hooks/use-vault-documents.ts`**

  ```typescript
  'use client'
  import { useEffect, useState } from 'react'
  import { subscribeUserDocuments } from '@/lib/firebase/firestore'
  import type { VaultDocument } from '@/lib/types'

  export function useVaultDocuments(uid: string | null) {
    const [documents, setDocuments] = useState<VaultDocument[]>([])
    const [loading, setLoading]     = useState(true)

    useEffect(() => {
      if (!uid) {
        setDocuments([])
        setLoading(false)
        return
      }
      setLoading(true)
      return subscribeUserDocuments(
        uid,
        (docs) => { setDocuments(docs); setLoading(false) },
        () => setLoading(false)
      )
    }, [uid])

    return { documents, loading }
  }
  ```

- [ ] **Step 2.4 — Add documents collection rules to `firestore.rules`**

  Open `app/firestore.rules` and add inside the existing `match /databases/{database}/documents { ... }` block:

  ```
  match /documents/{docId} {
    allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
  }
  ```

- [ ] **Step 2.5 — Create `storage.rules` at `app/storage.rules`**

  ```
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /documents/{uid}/{allPaths=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
  ```

- [ ] **Step 2.5b — Verify/update `firebase.json`**

  Read `firebase.json` at the project root (one level above `app/`). If there is no `"storage"` key, add it:
  ```json
  "storage": {
    "rules": "app/storage.rules"
  }
  ```
  If `firebase.json` is inside `app/`, the path would just be `"storage.rules"`. Check which directory `firebase.json` is in before editing. Run: `ls /Users/adityaraj0421/Cool\ Projects/Tender/` to find it.

- [ ] **Step 2.6 — TypeScript check**

  ```bash
  cd app && npx tsc --noEmit
  ```

  Expected: 0 errors.

- [ ] **Step 2.7 — Commit**

  ```bash
  cd app && git add src/lib/firebase/firestore.ts src/lib/firebase/storage.ts src/lib/hooks/use-vault-documents.ts firestore.rules storage.rules
  git commit -m "feat(vault): add document Firestore/Storage ops and useVaultDocuments hook"
  ```

---

## Chunk 3: Components

### Task 3: DocumentTypeIcon + DocumentCard

#### Steps

- [ ] **Step 3.1 — Create `src/components/documents/document-type-icon.tsx`**

  ```tsx
  import { FileText, ShieldCheck, Car, Receipt, Award, CreditCard, Building, File } from 'lucide-react'
  import type { DocumentType } from '@/lib/types'

  const TYPE_CONFIG: Record<DocumentType, { label: string; Icon: React.ElementType; color: string }> = {
    rc:        { label: 'RC',         Icon: Car,         color: 'text-blue-600'   },
    gst:       { label: 'GST',        Icon: Receipt,     color: 'text-green-600'  },
    insurance: { label: 'Insurance',  Icon: ShieldCheck, color: 'text-purple-600' },
    itr:       { label: 'ITR',        Icon: FileText,    color: 'text-orange-600' },
    msme:      { label: 'MSME',       Icon: Award,       color: 'text-yellow-600' },
    pan:       { label: 'PAN',        Icon: CreditCard,  color: 'text-navy'       },
    udyam:     { label: 'Udyam',      Icon: Building,    color: 'text-teal-600'   },
    other:     { label: 'Other',      Icon: File,        color: 'text-muted'      },
  }

  interface DocumentTypeIconProps {
    type: DocumentType
    size?: number
    showLabel?: boolean
  }

  export function DocumentTypeIcon({ type, size = 20, showLabel = false }: DocumentTypeIconProps) {
    const { Icon, color, label } = TYPE_CONFIG[type]
    return (
      <div className="flex items-center gap-1.5">
        <Icon size={size} className={color} />
        {showLabel && <span className="text-sm font-medium text-navy">{label}</span>}
      </div>
    )
  }

  export function getDocTypeLabel(type: DocumentType): string {
    return TYPE_CONFIG[type].label
  }
  ```

- [ ] **Step 3.2 — Create `src/components/documents/document-card.tsx`**

  ```tsx
  'use client'
  import { useState, useCallback } from 'react'
  import { ExternalLink, Trash2 } from 'lucide-react'
  import { useTranslations } from 'next-intl'
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

  function formatExpiry(doc: VaultDocument): string | null {
    if (!doc.expiresAt) return null
    return doc.expiresAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  export function DocumentCard({ document: doc }: DocumentCardProps) {
    const t = useTranslations('documents')
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [busy, setBusy]                   = useState(false)

    const expiringSoon = isDocumentExpiringSoon(doc)
    const expired      = isDocumentExpired(doc)
    const expiryLabel  = formatExpiry(doc)

    const handleDelete = useCallback(async () => {
      setBusy(true)
      try {
        await deleteVaultDocument(doc.id)
        await deleteVaultFile(doc.storagePath)
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
  ```

- [ ] **Step 3.3 — TypeScript check**

  ```bash
  cd app && npx tsc --noEmit
  ```

  Expected: 0 errors.

- [ ] **Step 3.4 — Commit**

  ```bash
  cd app && git add src/components/documents/document-type-icon.tsx src/components/documents/document-card.tsx
  git commit -m "feat(vault): add DocumentTypeIcon and DocumentCard components"
  ```

---

### Task 4: UploadDocumentDialog

#### Steps

- [ ] **Step 4.1 — Ensure Progress component exists**

  ```bash
  ls app/src/components/ui/progress.tsx
  ```

  If the file does not exist:

  ```bash
  cd app && npx shadcn@latest add progress --yes
  ```

- [ ] **Step 4.2 — Create `src/components/documents/upload-document-dialog.tsx`**

  ```tsx
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
        })
        handleClose()
      } catch (err) {
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
                <Progress value={progress} className="h-2" />
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
  ```

- [ ] **Step 4.3 — TypeScript check**

  ```bash
  cd app && npx tsc --noEmit
  ```

  Expected: 0 errors.

- [ ] **Step 4.4 — Commit**

  ```bash
  cd app && git add src/components/documents/upload-document-dialog.tsx
  git commit -m "feat(vault): add UploadDocumentDialog with upload progress"
  ```

---

## Chunk 4: Page Assembly

### Task 5: VaultChecklist + VaultFab

#### Steps

- [ ] **Step 5.1 — Create `src/components/documents/vault-checklist.tsx`**

  ```tsx
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
                  expired  ? <AlertTriangle size={18} className="text-danger shrink-0" /> :
                  expiring ? <AlertTriangle size={18} className="text-orange shrink-0" /> :
                             <CheckCircle2 size={18} className="text-success shrink-0" />
                ) : (
                  <Circle size={18} className="text-navy/20 shrink-0" />
                )}
                <DocumentTypeIcon type={type as any} showLabel size={16} />
                {expired          && <span className="ml-auto text-xs font-medium text-danger">{t('expired')}</span>}
                {!expired && expiring && <span className="ml-auto text-xs font-medium text-orange">{t('expiringSoon')}</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 5.2 — Create `src/components/documents/vault-fab.tsx`**

  ```tsx
  'use client'
  import { useState } from 'react'
  import { Plus } from 'lucide-react'
  import { UploadDocumentDialog } from './upload-document-dialog'
  import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
  import { isPro } from '@/lib/plan-guard'
  import type { UserProfile } from '@/lib/types'

  interface VaultFabProps { uid: string; profile: UserProfile }

  export function VaultFab({ uid, profile }: VaultFabProps) {
    const [uploadOpen,  setUploadOpen]  = useState(false)
    const [upgradeOpen, setUpgradeOpen] = useState(false)

    const handleTap = () => {
      if (!isPro(profile)) { setUpgradeOpen(true); return }
      setUploadOpen(true)
    }

    return (
      <>
        <button
          onClick={handleTap}
          aria-label="Upload document"
          className="fixed bottom-24 right-4 desktop:bottom-6 desktop:right-6 z-50 w-14 h-14 bg-navy text-white rounded-full shadow-lg flex items-center justify-center hover:bg-navy/90 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
        <UploadDocumentDialog open={uploadOpen} onClose={() => setUploadOpen(false)} uid={uid} />
        <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
      </>
    )
  }
  ```

- [ ] **Step 5.3 — TypeScript check**

  ```bash
  cd app && npx tsc --noEmit
  ```

  Expected: 0 errors.

- [ ] **Step 5.4 — Commit**

  ```bash
  cd app && git add src/components/documents/vault-checklist.tsx src/components/documents/vault-fab.tsx
  git commit -m "feat(vault): add VaultChecklist with progress bar and VaultFab"
  ```

---

### Task 6: i18n + Page Assembly

#### Steps

- [ ] **Step 6.1 — Add `documents` namespace to `messages/en.json`**

  Merge the following into the root JSON object of `messages/en.json`:

  ```json
  "documents": {
    "title": "Document Vault",
    "subtitle": "Upload and track your compliance documents",
    "proOnly": "Document Vault is a Pro feature",
    "proOnlySubtitle": "Upgrade to Pro to upload and manage your documents.",
    "checklistTitle": "Document Checklist",
    "uploadTitle": "Upload Document",
    "filePicker": "Tap to choose file",
    "filePickerHint": "PDF, JPG or PNG — max 10MB",
    "docType": "Document type",
    "selectDocType": "Select type",
    "expiryDate": "Expiry date",
    "optional": "optional",
    "upload": "Upload",
    "uploading": "Uploading...",
    "errorFileType": "Only PDF, JPG, and PNG files are allowed.",
    "errorFileSize": "File must be under 10MB.",
    "errorUpload": "Upload failed. Please try again.",
    "expired": "Expired",
    "expiringSoon": "Expiring soon",
    "expires": "Expires",
    "preview": "Preview",
    "delete": "Delete",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "noDocuments": "No documents uploaded yet",
    "noDocumentsSubtitle": "Upload your compliance documents to track them here."
  }
  ```

- [ ] **Step 6.2 — Add Hindi translations to `messages/hi.json`**

  Merge the following into `messages/hi.json`:

  ```json
  "documents": {
    "title": "Document Vault",
    "subtitle": "Compliance documents upload aur track karen",
    "proOnly": "Document Vault Pro feature hai",
    "proOnlySubtitle": "Documents upload aur manage karne ke liye Pro mein upgrade karen.",
    "checklistTitle": "Document Checklist",
    "uploadTitle": "Document Upload Karen",
    "filePicker": "File choose karne ke liye tap karen",
    "filePickerHint": "PDF, JPG ya PNG — max 10MB",
    "docType": "Document type",
    "selectDocType": "Type chunen",
    "expiryDate": "Expiry date",
    "optional": "optional",
    "upload": "Upload Karen",
    "uploading": "Upload ho raha hai...",
    "errorFileType": "Keval PDF, JPG, aur PNG files allowed hain.",
    "errorFileSize": "File 10MB se kam honi chahiye.",
    "errorUpload": "Upload failed. Dobara try karen.",
    "expired": "Expired",
    "expiringSoon": "Jald expire hoga",
    "expires": "Expire:",
    "preview": "Preview",
    "delete": "Delete",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "noDocuments": "Abhi koi document nahi hai",
    "noDocumentsSubtitle": "Compliance documents upload karen."
  }
  ```

  Note: Raw Hindi Devanagari text is intentionally avoided in these JSON values for compatibility with the PDF generation pipeline (per `feedback_pdf_font_rule.md`). The romanised transliteration above is safe for use as UI strings and avoids the ArialUnicode U() wrapper requirement in `generate_pdf.py`.

- [ ] **Step 6.3 — Add English fallback translations to remaining 9 locale files**

  First, verify none of these 9 files already has a `documents` key:
  ```bash
  grep -l '"documents"' messages/bn.json messages/mr.json messages/ta.json messages/te.json messages/gu.json messages/kn.json messages/pa.json messages/or.json messages/ml.json
  ```
  If any file appears in the output, read it first before editing to avoid duplicate keys.

  For each of `messages/bn.json`, `messages/mr.json`, `messages/ta.json`, `messages/te.json`, `messages/gu.json`, `messages/kn.json`, `messages/pa.json`, `messages/or.json`, `messages/ml.json` — merge the same English `documents` object from Step 6.1. This ensures next-intl falls back gracefully until native translations are added.

  Add the following `documents` object to each file (identical English content for all 9):

  ```json
  "documents": {
    "title": "Document Vault",
    "subtitle": "Upload and track your compliance documents",
    "proOnly": "Document Vault is a Pro feature",
    "proOnlySubtitle": "Upgrade to Pro to upload and manage your documents.",
    "checklistTitle": "Document Checklist",
    "uploadTitle": "Upload Document",
    "filePicker": "Tap to choose file",
    "filePickerHint": "PDF, JPG or PNG — max 10MB",
    "docType": "Document type",
    "selectDocType": "Select type",
    "expiryDate": "Expiry date",
    "optional": "optional",
    "upload": "Upload",
    "uploading": "Uploading...",
    "errorFileType": "Only PDF, JPG, and PNG files are allowed.",
    "errorFileSize": "File must be under 10MB.",
    "errorUpload": "Upload failed. Please try again.",
    "expired": "Expired",
    "expiringSoon": "Expiring soon",
    "expires": "Expires",
    "preview": "Preview",
    "delete": "Delete",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "noDocuments": "No documents uploaded yet",
    "noDocumentsSubtitle": "Upload your compliance documents to track them here."
  }
  ```

- [ ] **Step 6.4 — Replace `src/app/[locale]/(app)/documents/page.tsx`**

  Replace the existing placeholder stub with:

  ```tsx
  'use client'
  import { useState } from 'react'
  import { useTranslations } from 'next-intl'
  import { useFirebase } from '@/components/providers/firebase-provider'
  import { useUserProfile } from '@/lib/hooks/use-user-profile'
  import { useVaultDocuments } from '@/lib/hooks/use-vault-documents'
  import { isPro } from '@/lib/plan-guard'
  import { VaultChecklist } from '@/components/documents/vault-checklist'
  import { DocumentCard } from '@/components/documents/document-card'
  import { VaultFab } from '@/components/documents/vault-fab'
  import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
  import { Lock } from 'lucide-react'

  export default function DocumentsPage() {
    const t = useTranslations('documents')
    const { user } = useFirebase()
    const { profile } = useUserProfile()
    const { documents, loading } = useVaultDocuments(user?.uid ?? null)
    const [upgradeOpen, setUpgradeOpen] = useState(false)

    // Loading skeleton — profile not yet available
    if (!profile || !user) {
      return (
        <div className="space-y-4">
          <div className="h-7 w-48 bg-navy/5 rounded-lg animate-pulse" />
          <div className="h-32 bg-navy/5 rounded-xl animate-pulse" />
        </div>
      )
    }

    const userIsPro = isPro(profile)

    // Free users: read-only checklist + upgrade prompt
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
              Upgrade to Pro
            </button>
          </div>
          <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
        </div>
      )
    }

    // Pro users: full vault
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
  ```

- [ ] **Step 6.5 — TypeScript check**

  ```bash
  cd app && npx tsc --noEmit
  ```

  Expected: 0 errors.

- [ ] **Step 6.6 — Run full test suite**

  ```bash
  cd app && npx vitest run
  ```

  Expected: 68+ tests passing (55 existing + 13 new vault-utils tests).

- [ ] **Step 6.7 — Commit**

  ```bash
  cd app && git add \
    src/app/[locale]/\(app\)/documents/page.tsx \
    src/components/documents/vault-checklist.tsx \
    src/components/documents/vault-fab.tsx \
    messages/en.json messages/hi.json \
    messages/bn.json messages/mr.json messages/ta.json messages/te.json \
    messages/gu.json messages/kn.json messages/pa.json messages/or.json messages/ml.json
  git commit -m "feat(vault): complete Document Vault page with i18n — Pro upload, free checklist"
  ```

- [ ] **Step 6.8 — Update memory**

  Open `memory/project_tendersarthi.md` and mark Subsystem 4 as complete in the subsystem tracking table.

---

## Final Verification Checklist

- [ ] All 68+ tests passing: `cd app && npx vitest run`
- [ ] TypeScript clean: `cd app && npx tsc --noEmit`
- [ ] **Free user flow:** `/documents` renders checklist (empty — no docs), upload FAB not present, upgrade prompt with orange lock card visible, tapping "Upgrade to Pro" opens UpgradeDialog
- [ ] **Pro user flow:** FAB (`+` button) visible at bottom-right, tapping opens UploadDocumentDialog sheet, file picker validates type (PDF/JPG/PNG) and size (≤10MB), progress bar updates during upload, document appears in list after upload
- [ ] **Expiry warning:** Documents with `expiresAt` within 30 days show orange "Expiring soon" badge; documents past `expiresAt` show red "Expired" badge; checklist rows show AlertTriangle icon instead of CheckCircle2
- [ ] **Delete flow:** Tapping trash icon shows inline confirm/cancel buttons (no `window.confirm`); confirming deletes Firestore metadata first, then Storage file; card disappears via real-time onSnapshot
- [ ] **Offline:** Document list visible from Firestore cache; file preview link requires network (standard browser behaviour)
- [ ] **Storage rules deployed:** `firebase deploy --only storage` from `app/` directory
- [ ] **Firestore rules deployed:** `firebase deploy --only firestore:rules` from `app/` directory

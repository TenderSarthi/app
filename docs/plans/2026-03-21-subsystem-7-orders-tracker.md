# Subsystem 7 — Orders Tracker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Orders Tracker — a Pro-gated screen where users log won tenders as work orders and track four milestones (Delivery → Inspection → Invoice → Payment) through to completion.

**Architecture:** `Order` type added to `types.ts`; five Firestore helpers (`addOrder`, `subscribeOrders`, `updateOrder`, `deleteOrder`, `advanceOrderMilestone`) added to `firestore.ts`; pure utility functions isolated in `order-utils.ts` for unit-testing; three focused UI components (`OrderCard`, `AddOrderDialog`, `MilestoneStepper`) compose the `/orders` page.

**Tech Stack:** Next.js 16 + Tailwind v4 + shadcn/ui + Firebase Firestore (client SDK) + Vitest + next-intl (11 locales)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add `OrderStatus`, `OrderMilestones`, `Order` interfaces + `isValidOrderStatus` guard |
| Modify | `src/lib/firebase/firestore.ts` | Add `addOrder`, `subscribeOrders`, `updateOrder`, `deleteOrder`, `advanceOrderMilestone` |
| Modify | `firestore.rules` | Add `orders/{orderId}` security rules |
| Create | `src/lib/order-utils.ts` | Pure functions: `getNextStatus`, `getMilestoneKey`, `formatOrderValue`, `getInvoiceDaysSince` |
| Create | `tests/unit/order-utils.test.ts` | 18 unit tests for order-utils |
| Create | `src/components/orders/order-card.tsx` | Single order card with status badge, value, delete confirm |
| Create | `src/components/orders/milestone-stepper.tsx` | 4-step horizontal progress stepper |
| Create | `src/components/orders/add-order-dialog.tsx` | Dialog to add a new order (tender selector + form) |
| Modify | `src/app/[locale]/(app)/orders/page.tsx` | Replace placeholder; Pro gate; real-time orders list |
| Modify | `messages/en.json` + 10 locale files | Add `orders` namespace (42 keys) |

---

## Chunk 1: Foundation — Types, Firestore, Utilities

### Task 1: Add Order types to types.ts

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Append types to types.ts**

Open `src/lib/types.ts` and append after the `AlertConfig` block at the end of the file:

```typescript
// --- Orders Tracker types ---

export type OrderStatus =
  | 'delivery_pending'
  | 'inspection_pending'
  | 'invoice_pending'
  | 'payment_pending'
  | 'completed'

export interface OrderMilestones {
  deliveryDate: Timestamp | null
  inspectionDate: Timestamp | null
  invoiceDate: Timestamp | null
  paymentDate: Timestamp | null
}

export interface Order {
  id: string
  userId: string
  tenderId: string
  workOrderNumber: string | null
  value: number | null
  status: OrderStatus
  milestones: OrderMilestones
  notes: string | null
  createdAt: Timestamp
}

export function isValidOrderStatus(s: unknown): s is OrderStatus {
  return [
    'delivery_pending', 'inspection_pending', 'invoice_pending',
    'payment_pending', 'completed',
  ].includes(s as string)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/types.ts
git commit -m "feat(orders): add Order types and isValidOrderStatus guard"
```

---

### Task 2: Firestore CRUD + security rules

**Files:**
- Modify: `src/lib/firebase/firestore.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Add Order to the imports line in firestore.ts**

The top of `firestore.ts` has:
```typescript
import type { UserProfile, OnboardingData, LanguageCode, Tender, TenderStatus, PlatformStats, VaultDocument, BidDocument, AlertConfig } from '../types'
```

Change it to:
```typescript
import type { UserProfile, OnboardingData, LanguageCode, Tender, TenderStatus, PlatformStats, VaultDocument, BidDocument, AlertConfig, Order, OrderStatus, OrderMilestones } from '../types'
```

- [ ] **Step 2: Append five order functions to firestore.ts**

Append after the `subscribeAlertConfig` block at the end of the file:

```typescript
// ---------- Orders ----------

/** Add a new work order. Returns the new Firestore document ID. */
export async function addOrder(
  uid: string,
  data: Omit<Order, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'orders'), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Real-time listener on the current user's orders, newest first. */
export function subscribeOrders(
  uid: string,
  onData: (orders: Order[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'orders'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)))
    },
    onError
  )
}

/** Update simple fields on an order (notes, workOrderNumber, value). */
export async function updateOrder(
  orderId: string,
  updates: Partial<Pick<Order, 'workOrderNumber' | 'value' | 'notes'>>
): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), updates)
}

/**
 * Advance an order to the next milestone.
 * Sets milestones.{milestoneKey} = serverTimestamp() and updates status.
 * Uses Firestore dot-notation to merge into the milestones map without
 * overwriting the other milestone fields.
 */
export async function advanceOrderMilestone(
  orderId: string,
  milestoneKey: keyof OrderMilestones,
  nextStatus: OrderStatus
): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), {
    [`milestones.${milestoneKey}`]: serverTimestamp(),
    status: nextStatus,
  })
}

/** Delete a work order permanently. */
export async function deleteOrder(orderId: string): Promise<void> {
  await deleteDoc(doc(db, 'orders', orderId))
}
```

- [ ] **Step 3: Add orders rule to firestore.rules**

In `firestore.rules`, insert before the final catch-all line (`match /{document=**}`):

```
    match /orders/{orderId} {
      allow read, update, delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
```

The rules file should now end with:
```
    match /orders/{orderId} {
      allow read, update, delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/firebase/firestore.ts app/firestore.rules
git commit -m "feat(orders): add Firestore CRUD helpers and security rules"
```

---

### Task 3: order-utils.ts + unit tests

**Files:**
- Create: `src/lib/order-utils.ts`
- Create: `tests/unit/order-utils.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `app/tests/unit/order-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import {
  getNextStatus,
  getMilestoneKey,
  formatOrderValue,
  getInvoiceDaysSince,
} from '@/lib/order-utils'

// Helper: returns a Timestamp N days in the past
function daysAgo(n: number): Timestamp {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return Timestamp.fromDate(d)
}

describe('getNextStatus', () => {
  it('returns inspection_pending after delivery_pending', () => {
    expect(getNextStatus('delivery_pending')).toBe('inspection_pending')
  })
  it('returns invoice_pending after inspection_pending', () => {
    expect(getNextStatus('inspection_pending')).toBe('invoice_pending')
  })
  it('returns payment_pending after invoice_pending', () => {
    expect(getNextStatus('invoice_pending')).toBe('payment_pending')
  })
  it('returns completed after payment_pending', () => {
    expect(getNextStatus('payment_pending')).toBe('completed')
  })
  it('returns null for completed (terminal state)', () => {
    expect(getNextStatus('completed')).toBeNull()
  })
})

describe('getMilestoneKey', () => {
  it('returns deliveryDate for delivery_pending', () => {
    expect(getMilestoneKey('delivery_pending')).toBe('deliveryDate')
  })
  it('returns inspectionDate for inspection_pending', () => {
    expect(getMilestoneKey('inspection_pending')).toBe('inspectionDate')
  })
  it('returns invoiceDate for invoice_pending', () => {
    expect(getMilestoneKey('invoice_pending')).toBe('invoiceDate')
  })
  it('returns paymentDate for payment_pending', () => {
    expect(getMilestoneKey('payment_pending')).toBe('paymentDate')
  })
  it('returns null for completed (no milestone to set)', () => {
    expect(getMilestoneKey('completed')).toBeNull()
  })
})

describe('formatOrderValue', () => {
  it('returns em-dash for null value', () => {
    expect(formatOrderValue(null)).toBe('\u2014')
  })
  it('returns em-dash for zero value', () => {
    expect(formatOrderValue(0)).toBe('\u2014')
  })
  it('formats 50000 with Indian currency grouping', () => {
    const result = formatOrderValue(50000)
    expect(result).toContain('50,000')
  })
  it('formats 1500000 with Indian lakh grouping', () => {
    const result = formatOrderValue(1500000)
    expect(result).toContain('15,00,000')
  })
})

describe('getInvoiceDaysSince', () => {
  it('returns null for null invoiceDate', () => {
    expect(getInvoiceDaysSince(null)).toBeNull()
  })
  it('returns 0 for invoice submitted today', () => {
    expect(getInvoiceDaysSince(daysAgo(0))).toBe(0)
  })
  it('returns 3 for invoice submitted 3 days ago', () => {
    expect(getInvoiceDaysSince(daysAgo(3))).toBe(3)
  })
  it('returns 10 for invoice submitted 10 days ago', () => {
    const result = getInvoiceDaysSince(daysAgo(10))
    expect(result).toBe(10)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd app && npx vitest run tests/unit/order-utils.test.ts`
Expected: FAIL — "Cannot find module '@/lib/order-utils'"

- [ ] **Step 3: Create order-utils.ts with minimal implementation**

Create `app/src/lib/order-utils.ts`:

```typescript
import type { Timestamp } from 'firebase/firestore'
import type { OrderStatus, OrderMilestones } from './types'

const STATUS_PROGRESSION: OrderStatus[] = [
  'delivery_pending',
  'inspection_pending',
  'invoice_pending',
  'payment_pending',
  'completed',
]

/**
 * Returns the next status in the milestone progression,
 * or null if the order is already completed.
 */
export function getNextStatus(status: OrderStatus): OrderStatus | null {
  const idx = STATUS_PROGRESSION.indexOf(status)
  if (idx < 0 || idx >= STATUS_PROGRESSION.length - 1) return null
  return STATUS_PROGRESSION[idx + 1]
}

/**
 * Returns the milestones map key that should be set when advancing FROM
 * the given status, or null if status is 'completed'.
 */
export function getMilestoneKey(status: OrderStatus): keyof OrderMilestones | null {
  const map: Partial<Record<OrderStatus, keyof OrderMilestones>> = {
    delivery_pending: 'deliveryDate',
    inspection_pending: 'inspectionDate',
    invoice_pending: 'invoiceDate',
    payment_pending: 'paymentDate',
  }
  return map[status] ?? null
}

/**
 * Formats an order value in INR using Indian numbering.
 * Returns an em-dash for null or zero.
 */
export function formatOrderValue(value: number | null): string {
  if (!value) return '\u2014'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Returns the number of full days that have elapsed since the invoice
 * was submitted. Returns null if the invoice has not been submitted yet.
 * Both dates are stripped to midnight to avoid partial-day edge cases.
 */
export function getInvoiceDaysSince(invoiceDate: Timestamp | null): number | null {
  if (!invoiceDate) return null
  const now = new Date()
  const inv = invoiceDate.toDate()
  now.setHours(0, 0, 0, 0)
  inv.setHours(0, 0, 0, 0)
  return Math.round((now.getTime() - inv.getTime()) / (1000 * 60 * 60 * 24))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd app && npx vitest run tests/unit/order-utils.test.ts`
Expected: PASS — 18 tests passing

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `cd app && npx vitest run`
Expected: All prior tests still passing

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/order-utils.ts app/tests/unit/order-utils.test.ts
git commit -m "feat(orders): add order-utils with 18 passing unit tests"
```

---

## Chunk 2: UI — Components and Page

### Task 4: UI components

**Files:**
- Create: `src/components/orders/milestone-stepper.tsx`
- Create: `src/components/orders/order-card.tsx`
- Create: `src/components/orders/add-order-dialog.tsx`

Build in order: MilestoneStepper (no dependencies) -> OrderCard (uses MilestoneStepper) -> AddOrderDialog (standalone).

- [ ] **Step 1: Create MilestoneStepper**

Create `app/src/components/orders/milestone-stepper.tsx`:

```typescript
'use client'

import { useTranslations } from 'next-intl'
import type { Order, OrderStatus } from '@/lib/types'
import { getNextStatus, getMilestoneKey } from '@/lib/order-utils'

interface MilestoneStepperProps {
  order: Order
  onAdvance: (orderId: string, milestoneKey: string, nextStatus: OrderStatus) => void
  advancing?: boolean
}

const STEPS: { key: string; label: string }[] = [
  { key: 'delivery',   label: 'step_delivery' },
  { key: 'inspection', label: 'step_inspection' },
  { key: 'invoice',    label: 'step_invoice' },
  { key: 'payment',    label: 'step_payment' },
]

const STATUS_INDEX: Record<OrderStatus, number> = {
  delivery_pending:   0,
  inspection_pending: 1,
  invoice_pending:    2,
  payment_pending:    3,
  completed:          4,
}

export function MilestoneStepper({ order, onAdvance, advancing }: MilestoneStepperProps) {
  const t = useTranslations('orders')
  const currentIdx = STATUS_INDEX[order.status]
  const isCompleted = order.status === 'completed'
  const next = getNextStatus(order.status)
  const mKey = getMilestoneKey(order.status)

  return (
    <div className="space-y-3">
      {/* Step dots + connectors */}
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx && !isCompleted
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div
                className={[
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0',
                  done || isCompleted ? 'bg-green-600 border-green-600 text-white' : '',
                  active ? 'border-navy bg-navy text-white' : '',
                  !done && !active && !isCompleted ? 'border-gray-300 bg-white text-gray-400' : '',
                ].filter(Boolean).join(' ')}
              >
                {done || isCompleted ? '\u2713' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={['flex-1 h-0.5 mx-1', i < currentIdx ? 'bg-green-600' : 'bg-gray-200'].join(' ')} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step labels */}
      <div className="flex justify-between text-xs text-muted">
        {STEPS.map(step => (
          <span key={step.key} className="text-center w-1/4 truncate px-0.5">
            {t(step.label as never)}
          </span>
        ))}
      </div>

      {/* Advance button */}
      {next && mKey && (
        <button
          onClick={() => onAdvance(order.id, mKey, next)}
          disabled={advancing}
          className="w-full mt-1 px-3 py-1.5 rounded-lg bg-navy text-white text-sm font-medium disabled:opacity-50"
        >
          {advancing ? t('advancing') : t(`mark_${order.status.replace('_pending', '')}` as never)}
        </button>
      )}

      {isCompleted && (
        <p className="text-center text-green-600 text-sm font-medium">
          {t('orderComplete')}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create OrderCard**

Create `app/src/components/orders/order-card.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Order, OrderStatus } from '@/lib/types'
import { formatOrderValue, getInvoiceDaysSince } from '@/lib/order-utils'
import { MilestoneStepper } from './milestone-stepper'

interface OrderCardProps {
  order: Order
  tenderName: string
  onAdvance: (orderId: string, milestoneKey: string, nextStatus: OrderStatus) => Promise<void>
  onDelete: (orderId: string) => void
}

const STATUS_BADGE: Record<Order['status'], string> = {
  delivery_pending:   'bg-amber-100 text-amber-800',
  inspection_pending: 'bg-blue-100 text-blue-800',
  invoice_pending:    'bg-purple-100 text-purple-800',
  payment_pending:    'bg-orange-100 text-orange-800',
  completed:          'bg-green-100 text-green-800',
}

export function OrderCard({ order, tenderName, onAdvance, onDelete }: OrderCardProps) {
  const t = useTranslations('orders')
  const [advancing, setAdvancing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const displayTitle = order.workOrderNumber ? `WO# ${order.workOrderNumber}` : tenderName
  const invoiceDays = getInvoiceDaysSince(order.milestones.invoiceDate)
  const showInvoiceAlert = invoiceDays !== null && invoiceDays >= 30 && order.status === 'payment_pending'

  async function handleAdvance(orderId: string, milestoneKey: string, nextStatus: OrderStatus) {
    setAdvancing(true)
    try {
      await onAdvance(orderId, milestoneKey, nextStatus)
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy truncate">{displayTitle}</p>
          <p className="text-xs text-muted truncate">{tenderName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[order.status]}`}>
            {t(`status_${order.status}` as never)}
          </span>
          {order.value ? (
            <span className="text-xs font-medium text-navy">{formatOrderValue(order.value)}</span>
          ) : null}
        </div>
      </div>

      {/* Invoice overdue warning */}
      {showInvoiceAlert && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
          {'\u26a0\ufe0f'} {t('invoicedDaysAgo', { days: invoiceDays })}
        </p>
      )}

      {/* Notes */}
      {order.notes && (
        <p className="text-xs text-muted line-clamp-2">{order.notes}</p>
      )}

      {/* Milestone stepper */}
      <MilestoneStepper order={order} onAdvance={handleAdvance} advancing={advancing} />

      {/* Delete */}
      <div className="pt-1 border-t border-border">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-red-600 flex-1">{t('deleteConfirm')}</p>
            <button
              onClick={() => onDelete(order.id)}
              className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg"
            >
              {t('deleteConfirmBtn')}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-2 py-1 text-muted"
            >
              {t('cancelDelete')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            {t('deleteOrder')}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create AddOrderDialog**

Create `app/src/components/orders/add-order-dialog.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Tender } from '@/lib/types'

interface AddOrderDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: {
    tenderId: string
    workOrderNumber: string | null
    value: number | null
    notes: string | null
  }) => Promise<void>
  wonTenders: Tender[]
}

export function AddOrderDialog({ open, onClose, onSave, wonTenders }: AddOrderDialogProps) {
  const t = useTranslations('orders')

  const [tenderId, setTenderId] = useState('')
  const [workOrderNumber, setWorkOrderNumber] = useState('')
  const [valueInput, setValueInput] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setTenderId('')
    setWorkOrderNumber('')
    setValueInput('')
    setNotes('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenderId) { setError(t('errorSelectTender')); return }
    setSaving(true)
    setError(null)
    try {
      const parsedValue = valueInput.trim() ? parseInt(valueInput.trim(), 10) : null
      await onSave({
        tenderId,
        workOrderNumber: workOrderNumber.trim() || null,
        value: parsedValue && !isNaN(parsedValue) ? parsedValue : null,
        notes: notes.trim() || null,
      })
      reset()
      onClose()
    } catch {
      setError(t('errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addOrder')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Tender selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-navy">{t('tenderLabel')}</label>
            {wonTenders.length === 0 ? (
              <p className="text-sm text-muted">{t('noWonTenders')}</p>
            ) : (
              <select
                value={tenderId}
                onChange={e => setTenderId(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white"
              >
                <option value="">{t('tenderPlaceholder')}</option>
                {wonTenders.map(tender => (
                  <option key={tender.id} value={tender.id}>
                    {tender.name || tender.gemId}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Work order number */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-navy">{t('workOrderLabel')}</label>
            <input
              type="text"
              value={workOrderNumber}
              onChange={e => setWorkOrderNumber(e.target.value)}
              placeholder={t('workOrderPlaceholder')}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          {/* Order value */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-navy">{t('valueLabel')}</label>
            <input
              type="number"
              min="0"
              value={valueInput}
              onChange={e => setValueInput(e.target.value)}
              placeholder={t('valuePlaceholder')}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-navy">{t('notesLabel')}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-navy"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || wonTenders.length === 0}
              className="flex-1 px-4 py-2 rounded-lg bg-navy text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? t('saving') : t('saveOrder')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/src/components/orders/
git commit -m "feat(orders): add MilestoneStepper, OrderCard, and AddOrderDialog components"
```

---

### Task 5: Orders page

**Files:**
- Modify: `src/app/[locale]/(app)/orders/page.tsx`

- [ ] **Step 1: Replace the placeholder page**

Overwrite `app/src/app/[locale]/(app)/orders/page.tsx` with:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAuthUser } from '@/lib/hooks/use-auth-user'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { isPro } from '@/lib/plan-utils'
import { UpgradeDialog } from '@/components/upgrade-dialog'
import { OrderCard } from '@/components/orders/order-card'
import { AddOrderDialog } from '@/components/orders/add-order-dialog'
import {
  subscribeOrders,
  advanceOrderMilestone,
  deleteOrder,
  addOrder,
  subscribeUserTenders,
} from '@/lib/firebase/firestore'
import type { Order, Tender, OrderStatus } from '@/lib/types'

export default function OrdersPage() {
  const t = useTranslations('orders')
  const { user } = useAuthUser()
  const { profile } = useUserProfile()

  const [orders, setOrders] = useState<Order[]>([])
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Real-time orders subscription
  useEffect(() => {
    if (!user) return
    const unsub = subscribeOrders(
      user.uid,
      data => { setOrders(data); setLoadingOrders(false) },
      () => setLoadingOrders(false)
    )
    return unsub
  }, [user])

  // Real-time tenders subscription (for won tender selector + display names)
  useEffect(() => {
    if (!user) return
    return subscribeUserTenders(user.uid, setTenders, () => {})
  }, [user])

  const wonTenders = tenders.filter(t => t.status === 'won')

  // Map tenderId -> tender name for display in OrderCard
  const tenderNameMap = tenders.reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.name || t.gemId
    return acc
  }, {})

  const handleAdvance = useCallback(async (
    orderId: string,
    milestoneKey: string,
    nextStatus: OrderStatus
  ) => {
    await advanceOrderMilestone(
      orderId,
      milestoneKey as keyof Order['milestones'],
      nextStatus
    )
  }, [])

  const handleDelete = useCallback((orderId: string) => {
    deleteOrder(orderId)
  }, [])

  const handleSaveOrder = useCallback(async (data: {
    tenderId: string
    workOrderNumber: string | null
    value: number | null
    notes: string | null
  }) => {
    if (!user) return
    await addOrder(user.uid, {
      ...data,
      status: 'delivery_pending',
      milestones: {
        deliveryDate: null,
        inspectionDate: null,
        invoiceDate: null,
        paymentDate: null,
      },
    })
  }, [user])

  // Loading skeleton
  if (!profile || !user) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted/30 rounded" />
        <div className="h-32 bg-muted/20 rounded-xl" />
        <div className="h-32 bg-muted/20 rounded-xl" />
      </div>
    )
  }

  // Pro gate
  if (!isPro(profile)) {
    return (
      <UpgradeDialog
        trigger="feature_gate"
        title={t('proOnly')}
        description={t('proOnlySub')}
        ctaLabel={t('upgradeCta')}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-navy">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-4 py-2 rounded-xl bg-navy text-white text-sm font-semibold"
        >
          + {t('addOrder')}
        </button>
      </div>

      {/* Loading */}
      {loadingOrders && (
        <div className="space-y-3 animate-pulse">
          <div className="h-48 bg-muted/20 rounded-xl" />
          <div className="h-48 bg-muted/20 rounded-xl" />
        </div>
      )}

      {/* Empty state */}
      {!loadingOrders && orders.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-navy font-semibold">{t('emptyState')}</p>
          <p className="text-sm text-muted">{t('emptyStateSub')}</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-4 px-6 py-2 rounded-xl bg-navy text-white text-sm font-semibold"
          >
            + {t('addOrder')}
          </button>
        </div>
      )}

      {/* Orders list */}
      {!loadingOrders && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              tenderName={tenderNameMap[order.tenderId] ?? order.tenderId}
              onAdvance={handleAdvance}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add Order Dialog */}
      <AddOrderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveOrder}
        wonTenders={wonTenders}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run all tests to confirm no regressions**

Run: `cd app && npx vitest run`
Expected: All tests passing (84+ from prior subsystems + 18 new = 102+)

- [ ] **Step 4: Commit**

```bash
git add "app/src/app/[locale]/(app)/orders/page.tsx"
git commit -m "feat(orders): implement Orders Tracker page with Pro gate and real-time subscription"
```

---

## Chunk 3: i18n and Memory

### Task 6: Add orders namespace to all 11 locale files

**Files:**
- Modify: `messages/en.json` and 10 Indic locale files

**IMPORTANT:** In every locale file, the existing last key is `"alerts"`. Add a comma after the closing brace of `"alerts"` and append the `"orders"` block before the final `}`.

- [ ] **Step 1: Add orders namespace to en.json**

In `messages/en.json`, append after the `"alerts"` block (before the final `}`):

```json
  "orders": {
    "title": "Orders Tracker",
    "subtitle": "Track delivery, inspection, invoice, and payment",
    "proOnly": "Orders Tracker is a Pro feature",
    "proOnlySub": "Upgrade to Pro to track your work orders and payment milestones.",
    "upgradeCta": "Upgrade to Pro",
    "addOrder": "Add Order",
    "emptyState": "No orders yet",
    "emptyStateSub": "Log a won tender here to track delivery and payment.",
    "workOrderLabel": "Work order number",
    "workOrderPlaceholder": "e.g. WO/2026/00123",
    "tenderLabel": "Won tender",
    "tenderPlaceholder": "Select a won tender",
    "noWonTenders": "No won tenders found. Mark a tender as Won first.",
    "valueLabel": "Order value (\u20b9)",
    "valuePlaceholder": "e.g. 500000",
    "notesLabel": "Notes",
    "notesPlaceholder": "Optional notes about this order...",
    "saveOrder": "Save Order",
    "saving": "Saving...",
    "cancel": "Cancel",
    "deleteOrder": "Delete Order",
    "deleteConfirm": "Delete this order? This cannot be undone.",
    "deleteConfirmBtn": "Yes, Delete",
    "cancelDelete": "Cancel",
    "errorSelectTender": "Please select a tender.",
    "errorSave": "Could not save order. Please try again.",
    "status_delivery_pending": "Delivery Pending",
    "status_inspection_pending": "Inspection Pending",
    "status_invoice_pending": "Invoice Pending",
    "status_payment_pending": "Payment Pending",
    "status_completed": "Completed",
    "step_delivery": "Delivery",
    "step_inspection": "Inspection",
    "step_invoice": "Invoice",
    "step_payment": "Payment",
    "mark_delivery": "Mark Delivered",
    "mark_inspection": "Mark Inspected",
    "mark_invoice": "Mark Invoiced",
    "mark_payment": "Mark Paid",
    "advancing": "Updating...",
    "orderComplete": "Order Complete \u2713",
    "invoicedDaysAgo": "{days} days since invoice submitted"
  }
```

- [ ] **Step 2: Add orders namespace to hi.json (Hindi)**

```json
  "orders": {
    "title": "\u0911\u0930\u094d\u0921\u0930 \u091f\u094d\u0930\u0948\u0915\u0930",
    "subtitle": "\u0921\u093f\u0932\u0940\u0935\u0930\u0940, \u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0923, \u0907\u0928\u0935\u0949\u0907\u0938 \u0914\u0930 \u092d\u0941\u0917\u0924\u093e\u0928 \u091f\u094d\u0930\u0948\u0915 \u0915\u0930\u0947\u0902",
    "proOnly": "\u0911\u0930\u094d\u0921\u0930 \u091f\u094d\u0930\u0948\u0915\u0930 Pro \u092b\u0940\u091a\u0930 \u0939\u0948",
    "proOnlySub": "Pro \u092e\u0947\u0902 \u0905\u092a\u0917\u094d\u0930\u0947\u0921 \u0915\u0930\u0947\u0902 \u0914\u0930 \u0935\u0930\u094d\u0915 \u0911\u0930\u094d\u0921\u0930 \u091f\u094d\u0930\u0948\u0915 \u0915\u0930\u0947\u0902\u0964",
    "upgradeCta": "Pro \u092e\u0947\u0902 \u0905\u092a\u0917\u094d\u0930\u0947\u0921 \u0915\u0930\u0947\u0902",
    "addOrder": "\u0911\u0930\u094d\u0921\u0930 \u091c\u094b\u0921\u093c\u0947\u0902",
    "emptyState": "\u0905\u092d\u0940 \u0915\u094b\u0908 \u0911\u0930\u094d\u0921\u0930 \u0928\u0939\u0940\u0902",
    "emptyStateSub": "\u091c\u0940\u0924\u0947 \u0939\u0941\u090f \u091f\u0947\u0902\u0921\u0930 \u092f\u0939\u093e\u0901 \u0932\u0949\u0917 \u0915\u0930\u0947\u0902\u0964",
    "workOrderLabel": "\u0935\u0930\u094d\u0915 \u0911\u0930\u094d\u0921\u0930 \u0928\u0902\u092c\u0930",
    "workOrderPlaceholder": "\u091c\u0948\u0938\u0947 WO/2026/00123",
    "tenderLabel": "\u091c\u0940\u0924\u093e \u0939\u0941\u0906 \u091f\u0947\u0902\u0921\u0930",
    "tenderPlaceholder": "\u091f\u0947\u0902\u0921\u0930 \u091a\u0941\u0928\u0947\u0902",
    "noWonTenders": "\u0915\u094b\u0908 \u091c\u0940\u0924\u093e \u0939\u0941\u0906 \u091f\u0947\u0902\u0921\u0930 \u0928\u0939\u0940\u0902\u0964 \u092a\u0939\u0932\u0947 \u091f\u0947\u0902\u0921\u0930 \u0915\u094b Won \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u0947\u0902\u0964",
    "valueLabel": "\u0911\u0930\u094d\u0921\u0930 \u092e\u0942\u0932\u094d\u092f (\u20b9)",
    "valuePlaceholder": "\u091c\u0948\u0938\u0947 500000",
    "notesLabel": "\u0928\u094b\u091f\u094d\u0938",
    "notesPlaceholder": "\u0935\u0948\u0915\u0932\u094d\u092a\u093f\u0915 \u0928\u094b\u091f\u094d\u0938...",
    "saveOrder": "\u0911\u0930\u094d\u0921\u0930 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902",
    "saving": "\u0938\u0947\u0935 \u0939\u094b \u0930\u0939\u093e \u0939\u0948...",
    "cancel": "\u0930\u0926\u094d\u0926 \u0915\u0930\u0947\u0902",
    "deleteOrder": "\u0911\u0930\u094d\u0921\u0930 \u0939\u091f\u093e\u090f\u0902",
    "deleteConfirm": "\u092f\u0939 \u0911\u0930\u094d\u0921\u0930 \u0939\u091f\u093e\u090f\u0902? \u092f\u0939 \u0935\u093e\u092a\u0938 \u0928\u0939\u0940\u0902 \u0939\u094b\u0917\u093e\u0964",
    "deleteConfirmBtn": "\u0939\u093e\u0901, \u0939\u091f\u093e\u090f\u0902",
    "cancelDelete": "\u0930\u0926\u094d\u0926 \u0915\u0930\u0947\u0902",
    "errorSelectTender": "\u0915\u0943\u092a\u092f\u093e \u090f\u0915 \u091f\u0947\u0902\u0921\u0930 \u091a\u0941\u0928\u0947\u0902\u0964",
    "errorSave": "\u0911\u0930\u094d\u0921\u0930 \u0938\u0947\u0935 \u0928\u0939\u0940\u0902 \u0939\u0941\u0906\u0964 \u0926\u094b\u092c\u093e\u0930\u093e \u0915\u094b\u0936\u093f\u0936 \u0915\u0930\u0947\u0902\u0964",
    "status_delivery_pending": "\u0921\u093f\u0932\u0940\u0935\u0930\u0940 \u092c\u093e\u0915\u0940",
    "status_inspection_pending": "\u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0923 \u092c\u093e\u0915\u0940",
    "status_invoice_pending": "\u0907\u0928\u0935\u0949\u0907\u0938 \u092c\u093e\u0915\u0940",
    "status_payment_pending": "\u092d\u0941\u0917\u0924\u093e\u0928 \u092c\u093e\u0915\u0940",
    "status_completed": "\u092a\u0942\u0930\u094d\u0923",
    "step_delivery": "\u0921\u093f\u0932\u0940\u0935\u0930\u0940",
    "step_inspection": "\u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0923",
    "step_invoice": "\u0907\u0928\u0935\u0949\u0907\u0938",
    "step_payment": "\u092d\u0941\u0917\u0924\u093e\u0928",
    "mark_delivery": "\u0921\u093f\u0932\u0940\u0935\u0930\u0940 \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u0947\u0902",
    "mark_inspection": "\u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0923 \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u0947\u0902",
    "mark_invoice": "\u0907\u0928\u0935\u0949\u0907\u0938 \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u0947\u0902",
    "mark_payment": "\u092d\u0941\u0917\u0924\u093e\u0928 \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u0947\u0902",
    "advancing": "\u0905\u092a\u0921\u0947\u091f \u0939\u094b \u0930\u0939\u093e \u0939\u0948...",
    "orderComplete": "\u0911\u0930\u094d\u0921\u0930 \u092a\u0942\u0930\u094d\u0923 \u2713",
    "invoicedDaysAgo": "\u0907\u0928\u0935\u0949\u0907\u0938 \u091c\u092e\u093e \u0915\u093f\u090f {days} \u0926\u093f\u0928 \u0939\u0941\u090f"
  }
```

- [ ] **Step 3: Add orders namespace to remaining 9 locale files**

For each of mr.json, bn.json, ta.json, te.json, gu.json, kn.json, pa.json, or.json, ml.json — append an `"orders"` block with translations appropriate to that language. The keys must exactly match the en.json keys. Use the English values as fallback if translation is unavailable (next-intl falls back to the message key, not the English value, so do provide real translations).

Reference translations for each locale (append as JSON before the final `}` in each file):

**mr.json (Marathi)** — key values: title="\u0911\u0930\u094d\u0921\u0930 \u091f\u094d\u0930\u0945\u0915\u0930", status_delivery_pending="\u0921\u093f\u0932\u093f\u0935\u094d\u0939\u0930\u0940 \u092a\u094d\u0930\u0932\u0902\u092c\u093f\u0924", status_inspection_pending="\u0924\u092a\u093e\u0938\u0923\u0940 \u092a\u094d\u0930\u0932\u0902\u092c\u093f\u0924", status_invoice_pending="\u0907\u0928\u094d\u0935\u094d\u0939\u0949\u0907\u0938 \u092c\u093e\u0915\u0940", status_payment_pending="\u092a\u0947\u092e\u0947\u0902\u091f \u092c\u093e\u0915\u0940", status_completed="\u092a\u0942\u0930\u094d\u0923", step_delivery="\u0921\u093f\u0932\u093f\u0935\u094d\u0939\u0930\u0940", step_inspection="\u0924\u092a\u093e\u0938\u0923\u0940", step_invoice="\u0907\u0928\u094d\u0935\u094d\u0939\u0949\u0907\u0938", step_payment="\u092a\u0947\u092e\u0947\u0902\u091f", mark_delivery="\u0921\u093f\u0932\u093f\u0935\u094d\u0939\u0930\u0940 \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u093e", mark_inspection="\u0924\u092a\u093e\u0938\u0923\u0940 \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u093e", mark_invoice="\u0907\u0928\u094d\u0935\u094d\u0939\u0949\u0907\u0938 \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u093e", mark_payment="\u092a\u0947\u092e\u0947\u0902\u091f \u092e\u093e\u0930\u094d\u0915 \u0915\u0930\u093e", addOrder="\u0911\u0930\u094d\u0921\u0930 \u091c\u094b\u0921\u093e", emptyState="\u0905\u091c\u0942\u0928 \u0915\u094b\u0923\u0924\u0947\u0939\u0940 \u0911\u0930\u094d\u0921\u0930 \u0928\u093e\u0939\u0940", orderComplete="\u0911\u0930\u094d\u0921\u0930 \u092a\u0942\u0930\u094d\u0923 \u2713"

**For bn, ta, te, gu, kn, pa, or, ml:** Copy the en.json orders block to each locale file, then translate the visible UI labels: `title`, `subtitle`, `status_*`, `step_*`, `mark_*`, `addOrder`, `emptyState`, `emptyStateSub`, `proOnly`, `proOnlySub`, `upgradeCta`, `saveOrder`, `deleteOrder`, `deleteConfirm`, `deleteConfirmBtn`, `orderComplete`, `advancing`, `invoicedDaysAgo`. Leave error strings (`errorSelectTender`, `errorSave`) and placeholder strings (`workOrderPlaceholder`, `valuePlaceholder`, `notesPlaceholder`, `tenderPlaceholder`) in English.

- [ ] **Step 4: Verify all locale files have valid JSON**

Run:
```bash
cd app && node -e "
const fs = require('fs');
['en','hi','mr','bn','ta','te','gu','kn','pa','or','ml'].forEach(l => {
  const path = 'messages/' + l + '.json';
  JSON.parse(fs.readFileSync(path, 'utf8'));
  console.log(l, 'OK');
});
"
```
Expected: All 11 locale codes printed with OK

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Run full test suite one final time**

Run: `cd app && npx vitest run`
Expected: All tests passing (84+ prior + 18 new = 102+ total)

- [ ] **Step 7: Commit**

```bash
git add app/messages/
git commit -m "feat(orders): add orders i18n namespace for all 11 locales"
```

---

### Task 7: Update memory

- [ ] **Step 1: Update project memory**

In `/Users/adityaraj0421/.claude/projects/-Users-adityaraj0421-Cool-Projects-Tender/memory/project_tendersarthi.md`:

In `## Implementation Status`, add after Subsystem 6 line:
```
- Subsystem 7 (Orders Tracker): Complete -- 102+ tests passing, 0 TS errors
```

Add new section after `## Subsystem 6 Key Decisions`:
```
## Subsystem 7 Key Decisions
- orders/{orderId} collection -- one doc per order, userId field scoped per Firestore rules
- advanceOrderMilestone uses Firestore dot-notation (milestones.deliveryDate) to update nested
  milestone field without overwriting the full map
- updateOrder is limited to workOrderNumber|value|notes -- milestone advancement goes through
  advanceOrderMilestone only
- getNextStatus / getMilestoneKey are pure functions in order-utils.ts -- no Firebase dependency,
  fully unit-testable (18 tests)
- invoiceDaysSince warning shown only when >= 30 days AND status === payment_pending
- Won tenders list for AddOrderDialog comes from subscribeUserTenders on the page
- Delete is immediate (no undo) -- two-step inline confirm, no window.confirm (same as TenderCard)
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "docs: update memory with Subsystem 7 completion"
```

---

## Summary

| Chunk | Tasks | Tests | Commits |
|-------|-------|-------|---------|
| 1 -- Foundation | 3 (types + firestore + utils) | 18 unit tests | 3 |
| 2 -- UI | 2 (components + page) | TypeScript compile | 2 |
| 3 -- i18n + memory | 2 (11 locales + memory) | JSON parse verify | 2 |
| **Total** | **7** | **18 new + 84 prior = 102+** | **7** |

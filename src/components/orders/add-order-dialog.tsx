'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { Order, Tender } from '@/lib/types'
import { addOrder, updateOrder } from '@/lib/firebase/firestore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'


interface AddOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Active tenders to pick from when creating a new order */
  tenders: Tender[]
  /** If set, pre-fills the form for editing (only workOrderNumber / value / notes) */
  editOrder?: Order | null
  uid: string
}

function getInitialState(editOrder?: Order | null) {
  return {
    tenderId:        editOrder?.tenderId        ?? '',
    workOrderNumber: editOrder?.workOrderNumber ?? '',
    value:           editOrder?.value != null ? String(editOrder.value) : '',
    notes:           editOrder?.notes           ?? '',
  }
}

export function AddOrderDialog({
  open,
  onOpenChange,
  tenders,
  editOrder,
  uid,
}: AddOrderDialogProps) {
  const t = useTranslations('orders')
  const isEditing = editOrder != null

  const [tenderId,        setTenderId]        = useState('')
  const [workOrderNumber, setWorkOrderNumber] = useState('')
  const [value,           setValue]           = useState('')
  const [notes,           setNotes]           = useState('')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  // Re-seed form when dialog opens or the edited order's identity changes.
  // Using editOrder?.id (not the full object) avoids resets when the parent
  // re-renders with a new reference but the same order.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      const init = getInitialState(editOrder)
      setTenderId(init.tenderId)
      setWorkOrderNumber(init.workOrderNumber)
      setValue(init.value)
      setNotes(init.notes)
      setError(null)
    }
  }, [open, editOrder?.id])

  const reset = () => {
    setTenderId('')
    setWorkOrderNumber('')
    setValue('')
    setNotes('')
    setError(null)
    setSaving(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    if (!isEditing && !tenderId) {
      setError(t('errorSelectTender'))
      return
    }

    const parsedValue = value.trim() === '' ? null : Number(value)
    if (parsedValue !== null && (isNaN(parsedValue) || parsedValue <= 0)) {
      setError(t('errorInvalidValue'))
      return
    }

    if (notes.length > 500) {
      setError(t('errorNotesTooLong'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (isEditing) {
        await updateOrder(editOrder.id, {
          workOrderNumber: workOrderNumber.trim() || null,
          value:           parsedValue,
          notes:           notes.trim() || null,
        })
      } else {
        await addOrder(uid, {
          tenderId,
          workOrderNumber: workOrderNumber.trim() || null,
          value:           parsedValue,
          status:          'delivery_pending',
          milestones: {
            deliveryDate:   null,
            inspectionDate: null,
            invoiceDate:    null,
            paymentDate:    null,
          },
          notes: notes.trim() || null,
        })
      }
      handleOpenChange(false)
    } catch {
      setError(t('errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('editOrder') : t('addWorkOrder')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tender select — disabled when editing */}
          <div>
            <Label htmlFor="order-tender">
              {t('tenderLabel')} <span className="text-danger">*</span>
            </Label>
            <Select
              value={tenderId}
              onValueChange={(v) => { if (v) setTenderId(v) }}
              disabled={isEditing}
            >
              <SelectTrigger id="order-tender" className="mt-1 w-full">
                <SelectValue placeholder={t('tenderPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {tenders.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted">
                    {t('noWonTenders')}
                  </p>
                ) : (
                  tenders.map((tender) => (
                    <SelectItem key={tender.id} value={tender.id}>
                      {tender.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Work order number (optional) */}
          <div>
            <Label htmlFor="order-won">
              {t('workOrderLabel')}{' '}
              <span className="text-muted font-normal">({t('optional')})</span>
            </Label>
            <Input
              id="order-won"
              value={workOrderNumber}
              onChange={(e) => setWorkOrderNumber(e.target.value)}
              placeholder="e.g. WO/2025/00123"
              className="mt-1"
            />
          </div>

          {/* Value (optional) */}
          <div>
            <Label htmlFor="order-value">
              {t('valueLabel')}{' '}
              <span className="text-muted font-normal">({t('optional')})</span>
            </Label>
            <Input
              id="order-value"
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('valuePlaceholder')}
              className="mt-1"
            />
          </div>

          {/* Notes (optional) */}
          <div>
            <Label htmlFor="order-notes">
              {t('notesLabel')}{' '}
              <span className="text-muted font-normal">({t('optional')})</span>
            </Label>
            <textarea
              id="order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              maxLength={500}
              rows={3}
              className="mt-1 w-full border border-input rounded-lg px-2.5 py-2 text-sm bg-transparent resize-none outline-none focus-visible:border-ring placeholder:text-muted"
            />
            <p className="text-xs text-muted text-right mt-0.5">
              {notes.length}/500
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || (!isEditing && !tenderId)}
          >
            {saving ? t('saving') : isEditing ? t('saveChanges') : t('addWorkOrder')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

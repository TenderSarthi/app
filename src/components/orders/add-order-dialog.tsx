'use client'

import { useState, useEffect } from 'react'
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

// TODO: i18n — replace hardcoded strings once orders namespace is added (Task 6)

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
  const isEditing = editOrder != null

  const [tenderId,        setTenderId]        = useState('')
  const [workOrderNumber, setWorkOrderNumber] = useState('')
  const [value,           setValue]           = useState('')
  const [notes,           setNotes]           = useState('')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  // Re-seed form when dialog opens or editOrder changes
  useEffect(() => {
    if (open) {
      const init = getInitialState(editOrder)
      setTenderId(init.tenderId)
      setWorkOrderNumber(init.workOrderNumber)
      setValue(init.value)
      setNotes(init.notes)
      setError(null)
    }
  }, [open, editOrder])

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
      setError('Please select a tender.')
      return
    }

    const parsedValue = value.trim() === '' ? null : Number(value)
    if (parsedValue !== null && (isNaN(parsedValue) || parsedValue < 0)) {
      setError('Value must be a positive number.')
      return
    }

    if (notes.length > 500) {
      setError('Notes must be 500 characters or fewer.')
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
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Order' : 'Add Work Order'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tender select — disabled when editing */}
          <div>
            <Label htmlFor="order-tender">
              Tender <span className="text-destructive">*</span>
            </Label>
            <Select
              value={tenderId}
              onValueChange={(v) => { if (v) setTenderId(v) }}
              disabled={isEditing}
            >
              <SelectTrigger id="order-tender" className="mt-1 w-full">
                <SelectValue placeholder="Select a tender" />
              </SelectTrigger>
              <SelectContent>
                {tenders.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Work order number (optional) */}
          <div>
            <Label htmlFor="order-won">
              Work Order Number{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
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
              Order Value (INR){' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="order-value"
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 500000"
              className="mt-1"
            />
          </div>

          {/* Notes (optional) */}
          <div>
            <Label htmlFor="order-notes">
              Notes{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <textarea
              id="order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              maxLength={500}
              rows={3}
              className="mt-1 w-full border border-input rounded-lg px-2.5 py-2 text-sm bg-transparent resize-none outline-none focus-visible:border-ring placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground text-right mt-0.5">
              {notes.length}/500
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || (!isEditing && !tenderId)}
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Order, OrderStatus } from '@/lib/types'
import { MilestoneStepper } from './milestone-stepper'
import { getNextStatus, getMilestoneKey, formatOrderValue } from '@/lib/order-utils'
import { advanceOrderMilestone, deleteOrder } from '@/lib/firebase/firestore'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderCardProps {
  order: Order
  onEdit: (order: Order) => void
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  delivery_pending:   'bg-orange/10 text-orange',
  inspection_pending: 'bg-orange/10 text-orange',
  invoice_pending:    'bg-navy/10 text-navy',
  payment_pending:    'bg-gold/10 text-gold',
  completed:          'bg-success/10 text-success',
}

const STATUS_I18N_KEY: Record<OrderStatus, string> = {
  delivery_pending:   'status_delivery_pending',
  inspection_pending: 'status_inspection_pending',
  invoice_pending:    'status_invoice_pending',
  payment_pending:    'status_payment_pending',
  completed:          'status_completed',
}

export function OrderCard({ order, onEdit }: OrderCardProps) {
  const t = useTranslations('orders')
  const [advancing,      setAdvancing]      = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [deleteError,    setDeleteError]    = useState(false)

  const badgeClass  = STATUS_CLASS[order.status] ?? 'bg-navy/10 text-navy'
  const badgeLabel  = STATUS_I18N_KEY[order.status] ? t(STATUS_I18N_KEY[order.status] as never) : order.status
  const nextStatus  = getNextStatus(order.status)
  const isCompleted = order.status === 'completed'

  const handleAdvance = async () => {
    if (!nextStatus) return
    const milestoneKey = getMilestoneKey(order.status)
    if (!milestoneKey) return
    setAdvancing(true)
    try {
      await advanceOrderMilestone(order.id, milestoneKey, nextStatus)
    } catch {
      // Firestore onSnapshot will reconcile — silent fail is acceptable
    } finally {
      setAdvancing(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(false)
    try {
      await deleteOrder(order.id)
    } catch {
      setDeleteError(true)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="bg-white">
      <CardContent className="pt-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {order.workOrderNumber ? (
              <p className="font-semibold text-sm leading-snug truncate">
                {order.workOrderNumber}
              </p>
            ) : (
              <p className="text-sm text-muted italic">
                No work order number
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                badgeClass
              )}
            >
              {badgeLabel}
            </span>
            <span className="text-sm font-semibold">
              {formatOrderValue(order.value)}
            </span>
          </div>
        </div>

        {/* Milestone stepper */}
        <MilestoneStepper order={order} />

        {/* Notes */}
        {order.notes && (
          <p className="mt-3 text-xs text-muted line-clamp-2">
            {order.notes}
          </p>
        )}
      </CardContent>

      {deleteError && (
        <p role="alert" className="px-4 pb-0 text-xs text-danger">
          Delete failed. Please try again.
        </p>
      )}
      <CardFooter className="gap-2 flex-wrap">
        {/* Edit */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(order)}
          className="gap-1"
        >
          <Pencil size={13} />
          Edit
        </Button>

        {/* Advance milestone */}
        {!isCompleted && (
          <Button
            size="sm"
            onClick={handleAdvance}
            disabled={advancing}
            className="gap-1"
          >
            {advancing ? '...' : (
              <>Advance <ChevronRight size={13} /></>
            )}
          </Button>
        )}

        {/* Delete — two-step inline confirm, same pattern as TenderCard */}
        <div className="ml-auto flex items-center gap-1">
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-semibold text-danger px-2 py-1 rounded-lg hover:bg-danger/5 disabled:opacity-50"
              >
                {deleting ? '...' : 'Confirm?'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="text-xs text-muted px-2 py-1 rounded-lg hover:bg-navy/5"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-muted hover:text-danger rounded-lg hover:bg-danger/5"
              aria-label="Delete order"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

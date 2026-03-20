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

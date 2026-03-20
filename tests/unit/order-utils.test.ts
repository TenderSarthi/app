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

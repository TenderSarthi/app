// tests/unit/admin-utils.test.ts
import { describe, it, expect } from 'vitest'
import { calcMRR, formatPercent, formatCurrency } from '@/lib/admin-utils'

describe('calcMRR', () => {
  it('returns 0 for no pro users', () => {
    expect(calcMRR(0)).toBe(0)
  })
  it('multiplies pro count by 499', () => {
    expect(calcMRR(10)).toBe(4990)
  })
})

describe('formatPercent', () => {
  it('returns 0.0% when total is 0', () => {
    expect(formatPercent(0, 0)).toBe('0.0%')
  })
  it('formats conversion rate to 1 decimal place', () => {
    expect(formatPercent(15, 100)).toBe('15.0%')
  })
  it('rounds correctly', () => {
    expect(formatPercent(1, 3)).toBe('33.3%')
  })
})

describe('formatCurrency', () => {
  it('formats with rupee sign and Indian grouping', () => {
    expect(formatCurrency(4990)).toBe('₹4,990')
  })
  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('₹0')
  })
})

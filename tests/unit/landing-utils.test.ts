import { describe, it, expect } from 'vitest'
import { formatStat } from '@/lib/landing-utils'

describe('formatStat', () => {
  it('returns em-dash for null', () => {
    expect(formatStat(null)).toBe('—')
  })

  it('formats 0 as "0+"', () => {
    expect(formatStat(0)).toBe('0+')
  })

  it('formats 1234 with Indian comma grouping', () => {
    expect(formatStat(1234)).toBe('1,234+')
  })

  it('formats 100000 with Indian lakh grouping', () => {
    expect(formatStat(100000)).toBe('1,00,000+')
  })
})

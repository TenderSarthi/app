import { describe, it, expect } from 'vitest'
import type { TenderStatus } from '@/lib/types'

describe('TenderStatus values', () => {
  it('active is a valid status', () => {
    const s: TenderStatus = 'active'
    expect(s).toBe('active')
  })
  it('won is a valid status', () => {
    const s: TenderStatus = 'won'
    expect(s).toBe('won')
  })
  it('lost is a valid status', () => {
    const s: TenderStatus = 'lost'
    expect(s).toBe('lost')
  })
  it('expired is a valid status', () => {
    const s: TenderStatus = 'expired'
    expect(s).toBe('expired')
  })
})

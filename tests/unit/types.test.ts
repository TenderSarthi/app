import { describe, it, expect } from 'vitest'
import { isProPlan, isValidLanguageCode } from '@/lib/types'

describe('isProPlan', () => {
  it('returns true for pro', () => expect(isProPlan('pro')).toBe(true))
  it('returns false for free', () => expect(isProPlan('free')).toBe(false))
  it('returns false for unknown', () => expect(isProPlan('unknown')).toBe(false))
})

describe('isValidLanguageCode', () => {
  it('accepts valid codes', () => {
    expect(isValidLanguageCode('en')).toBe(true)
    expect(isValidLanguageCode('hi')).toBe(true)
    expect(isValidLanguageCode('ml')).toBe(true)
  })
  it('rejects invalid codes', () => {
    expect(isValidLanguageCode('xx')).toBe(false)
    expect(isValidLanguageCode('')).toBe(false)
    expect(isValidLanguageCode(null)).toBe(false)
  })
})

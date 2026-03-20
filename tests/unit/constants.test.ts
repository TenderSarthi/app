import { describe, it, expect } from 'vitest'
import { BRAND_COLORS, GEM_CATEGORIES, INDIAN_STATES, SUPPORTED_LANGUAGES, LOCALE_CODES } from '@/lib/constants'

describe('BRAND_COLORS', () => {
  it('has all required colors', () => {
    expect(BRAND_COLORS.navy).toBe('#1A3766')
    expect(BRAND_COLORS.orange).toBe('#F97316')
    expect(BRAND_COLORS.gold).toBe('#D97706')
    expect(BRAND_COLORS.green).toBe('#16A34A')
  })
})

describe('GEM_CATEGORIES', () => {
  it('has at least 10 categories', () => expect(GEM_CATEGORIES.length).toBeGreaterThanOrEqual(10))
})

describe('INDIAN_STATES', () => {
  it('has all 28 states + 8 UTs', () => expect(INDIAN_STATES.length).toBe(36))
})

describe('SUPPORTED_LANGUAGES', () => {
  it('supports all 11 languages', () => expect(SUPPORTED_LANGUAGES.length).toBe(11))
  it('has Hindi in list', () => expect(LOCALE_CODES).toContain('hi'))
  it('has Malayalam in list', () => expect(LOCALE_CODES).toContain('ml'))
})

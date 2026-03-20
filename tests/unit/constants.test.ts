import { describe, it, expect } from 'vitest'
import { BRAND_COLORS, GEM_CATEGORIES, INDIAN_STATES, SUPPORTED_LANGUAGES, LOCALE_CODES } from '@/lib/constants'

describe('BRAND_COLORS', () => {
  it('has all required colors', () => {
    expect(BRAND_COLORS.navy).toBe('#1A3766')
    expect(BRAND_COLORS.orange).toBe('#F97316')
    expect(BRAND_COLORS.gold).toBe('#D97706')
    expect(BRAND_COLORS.success).toBe('#16A34A')
    expect(BRAND_COLORS.danger).toBe('#DC2626')
  })
})

describe('GEM_CATEGORIES', () => {
  it('has at least 10 categories', () => expect(GEM_CATEGORIES.length).toBeGreaterThanOrEqual(10))
  it('contains required key categories', () => {
    expect(GEM_CATEGORIES).toContain('Transport & Vehicles')
    expect(GEM_CATEGORIES).toContain('IT & Electronics')
    expect(GEM_CATEGORIES).toContain('Medical & Healthcare')
  })
  it('has no duplicate categories', () => {
    const unique = new Set(GEM_CATEGORIES)
    expect(unique.size).toBe(GEM_CATEGORIES.length)
  })
})

describe('INDIAN_STATES', () => {
  it('has all 28 states + 8 UTs = 36 total', () => expect(INDIAN_STATES.length).toBe(36))
  it('contains key states', () => {
    expect(INDIAN_STATES).toContain('Maharashtra')
    expect(INDIAN_STATES).toContain('Tamil Nadu')
    expect(INDIAN_STATES).toContain('Delhi')
  })
  it('has no duplicate entries', () => {
    const unique = new Set(INDIAN_STATES)
    expect(unique.size).toBe(INDIAN_STATES.length)
  })
})

describe('SUPPORTED_LANGUAGES', () => {
  it('supports exactly 11 languages', () => expect(SUPPORTED_LANGUAGES.length).toBe(11))
  it('has correct language codes in order', () => {
    expect(LOCALE_CODES).toEqual(['en', 'hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'pa', 'or', 'ml'])
  })
  it('every language has a non-empty native label', () => {
    SUPPORTED_LANGUAGES.forEach((lang) => {
      expect(lang.nativeLabel.length).toBeGreaterThan(0)
    })
  })
})

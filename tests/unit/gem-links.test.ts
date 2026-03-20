import { describe, it, expect } from 'vitest'
import { buildGemUrl, buildGemSearchUrl } from '@/lib/gem-links'

describe('buildGemUrl', () => {
  it('returns base GeM URL when no filters', () => {
    const url = buildGemUrl({})
    expect(url).toBe('https://bidplus.gem.gov.in/bidlists')
  })

  it('appends state filter', () => {
    const url = buildGemUrl({ state: 'Maharashtra' })
    expect(url).toContain('Maharashtra')
  })

  it('appends category filter', () => {
    const url = buildGemUrl({ category: 'Transport' })
    expect(url).toContain('Transport')
  })

  it('appends both filters', () => {
    const url = buildGemUrl({ state: 'Gujarat', category: 'IT' })
    expect(url).toContain('Gujarat')
    expect(url).toContain('IT')
  })
})

describe('buildGemSearchUrl', () => {
  it('returns url with keyword', () => {
    const url = buildGemSearchUrl('vehicle')
    expect(url).toContain('vehicle')
  })
})

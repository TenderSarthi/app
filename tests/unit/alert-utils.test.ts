import { describe, it, expect } from 'vitest'
import { parseRSSItem, matchesAlertConfig, formatAlertMessage } from '@/lib/alert-utils'
import type { AlertConfig } from '@/lib/alert-utils'

const baseConfig: AlertConfig = {
  userId: 'uid1',
  categories: ['Transport & Vehicles'],
  states: ['Maharashtra'],
  keywords: [],
  channels: { push: true, whatsapp: false, email: false },
  active: true,
}

describe('parseRSSItem', () => {
  it('extracts title and link from item', () => {
    const result = parseRSSItem({ title: 'Bus Hiring — Pune', link: 'https://example.com/tender/1', contentSnippet: '', pubDate: '2026-03-21' })
    expect(result.title).toBe('Bus Hiring — Pune')
    expect(result.link).toBe('https://example.com/tender/1')
  })

  it('detects Maharashtra in text', () => {
    const result = parseRSSItem({ title: 'Vehicle Hire Maharashtra', link: '', contentSnippet: '', pubDate: '2026-03-21' })
    expect(result.states).toContain('Maharashtra')
  })

  it('detects Transport & Vehicles category from keyword "vehicle"', () => {
    const result = parseRSSItem({ title: 'Vehicle Hiring Contract', link: '', contentSnippet: '', pubDate: '2026-03-21' })
    expect(result.categories).toContain('Transport & Vehicles')
  })

  it('detects IT category from keyword "laptop"', () => {
    const result = parseRSSItem({ title: 'Laptop Procurement', link: '', contentSnippet: '', pubDate: '2026-03-21' })
    expect(result.categories).toContain('IT & Electronics')
  })

  it('handles missing pubDate gracefully', () => {
    const result = parseRSSItem({ title: 'Test', link: '', contentSnippet: '', pubDate: undefined })
    expect(result.pubDate).toBeInstanceOf(Date)
  })

  it('handles missing title and contentSnippet', () => {
    const result = parseRSSItem({ title: undefined, link: '', contentSnippet: undefined, pubDate: undefined })
    expect(result.title).toBe('')
    expect(result.description).toBe('')
  })
})

describe('matchesAlertConfig', () => {
  const tender = {
    title: 'Bus Hiring Contract',
    link: 'https://example.com/1',
    description: 'Maharashtra vehicle hiring',
    pubDate: new Date(),
    categories: ['Transport & Vehicles'],
    states: ['Maharashtra'],
  }

  it('returns true when category and state match', () => {
    expect(matchesAlertConfig(tender, baseConfig)).toBe(true)
  })

  it('returns false when config is not active', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, active: false })).toBe(false)
  })

  it('returns true when categories is empty (match all)', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, categories: [] })).toBe(true)
  })

  it('returns true when states is empty (match all)', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, states: [] })).toBe(true)
  })

  it('returns false when state does not match', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, states: ['Gujarat'] })).toBe(false)
  })

  it('returns false when category does not match', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, categories: ['IT & Electronics'] })).toBe(false)
  })

  it('returns true when keyword matches title', () => {
    const config = { ...baseConfig, keywords: ['bus hiring'] }
    expect(matchesAlertConfig(tender, config)).toBe(true)
  })

  it('returns false when keywords provided but none match', () => {
    const config = { ...baseConfig, keywords: ['laptop', 'printer'] }
    expect(matchesAlertConfig(tender, config)).toBe(false)
  })

  it('returns true when keywords empty (match all)', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, keywords: [] })).toBe(true)
  })
})

describe('formatAlertMessage', () => {
  it('returns a non-empty string with the tender title', () => {
    const msg = formatAlertMessage({ title: 'Bus Hiring Bihar', link: 'https://example.com', description: '', pubDate: new Date(), categories: [], states: [] })
    expect(msg).toContain('Bus Hiring Bihar')
  })

  it('includes the link', () => {
    const msg = formatAlertMessage({ title: 'Test', link: 'https://example.com/tender/123', description: '', pubDate: new Date(), categories: [], states: [] })
    expect(msg).toContain('https://example.com/tender/123')
  })
})

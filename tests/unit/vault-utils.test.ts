import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import {
  getRequiredDocTypes,
  getVaultProgress,
  isDocumentExpiringSoon,
  isDocumentExpired,
} from '@/lib/vault-utils'
import type { VaultDocument } from '@/lib/types'

function makeDoc(type: string, expiresAt: Timestamp | null = null): VaultDocument {
  return {
    id: '1', userId: 'u1', type: type as any, fileName: 'test.pdf',
    fileSize: 1000, storagePath: 'docs/u1/test.pdf', storageUrl: 'https://example.com',
    expiresAt, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), expiryAlertSent: false,
  }
}

function daysFromNow(n: number): Timestamp {
  const d = new Date(); d.setDate(d.getDate() + n); return Timestamp.fromDate(d)
}

describe('getRequiredDocTypes', () => {
  it('returns gst and pan for empty categories', () => {
    expect(getRequiredDocTypes([])).toEqual(expect.arrayContaining(['gst', 'pan']))
  })
  it('always includes gst and pan regardless of category', () => {
    const types = getRequiredDocTypes(['IT & Electronics'])
    expect(types).toContain('gst')
    expect(types).toContain('pan')
  })
  it('includes rc and insurance for Transport & Vehicles', () => {
    const types = getRequiredDocTypes(['Transport & Vehicles'])
    expect(types).toContain('rc')
    expect(types).toContain('insurance')
  })
  it('takes union across multiple categories', () => {
    const types = getRequiredDocTypes(['Transport & Vehicles', 'IT & Electronics'])
    expect(types).toContain('rc')
    expect(types).toContain('msme')
  })
  it('returns gst and pan for an unrecognized category', () => {
    const types = getRequiredDocTypes(['Unknown Category'])
    expect(types).toContain('gst')
    expect(types).toContain('pan')
  })
})

describe('getVaultProgress', () => {
  it('returns 100% when no categories (no requirements)', () => {
    expect(getVaultProgress([], []).percent).toBe(100)
  })
  it('returns 0% when no docs uploaded', () => {
    const { percent } = getVaultProgress([], ['IT & Electronics'])
    expect(percent).toBe(0)
  })
  it('returns 100% when all required docs uploaded', () => {
    const docs = ['gst', 'pan', 'msme'].map(t => makeDoc(t))
    expect(getVaultProgress(docs, ['IT & Electronics']).percent).toBe(100)
  })
  it('counts uploaded/required correctly', () => {
    const docs = [makeDoc('gst')]
    const { uploaded, required } = getVaultProgress(docs, ['IT & Electronics'])
    expect(uploaded).toBe(1)
    expect(required).toBe(3) // gst, pan, msme
  })
})

describe('isDocumentExpiringSoon', () => {
  it('returns false for null expiresAt', () => {
    expect(isDocumentExpiringSoon(makeDoc('gst', null))).toBe(false)
  })
  it('returns true for doc expiring in 15 days', () => {
    expect(isDocumentExpiringSoon(makeDoc('gst', daysFromNow(15)))).toBe(true)
  })
  it('returns false for doc expiring in 31 days', () => {
    expect(isDocumentExpiringSoon(makeDoc('gst', daysFromNow(31)))).toBe(false)
  })
  it('returns true for doc expiring today (daysLeft === 0)', () => {
    expect(isDocumentExpiringSoon(makeDoc('gst', daysFromNow(0)))).toBe(true)
  })
})

describe('isDocumentExpired', () => {
  it('returns false for null expiresAt', () => {
    expect(isDocumentExpired(makeDoc('gst', null))).toBe(false)
  })
  it('returns true for past expiry', () => {
    expect(isDocumentExpired(makeDoc('gst', daysFromNow(-1)))).toBe(true)
  })
  it('returns false for future expiry', () => {
    expect(isDocumentExpired(makeDoc('gst', daysFromNow(5)))).toBe(false)
  })
})

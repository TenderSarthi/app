import { describe, it, expect } from 'vitest'
import { isPro, canUseAI, canSaveTenders, canUseBidGenerator, getBlockReason } from '@/lib/plan-guard'
import type { UserProfile } from '@/lib/types'

const free = { plan: 'free' } as UserProfile
const pro  = { plan: 'pro'  } as UserProfile

describe('isPro', () => {
  it('true for pro', () => expect(isPro(pro)).toBe(true))
  it('false for free', () => expect(isPro(free)).toBe(false))
})

describe('canUseAI', () => {
  it('allows free user with queries remaining', () => expect(canUseAI(free, { queries: 5, bidDocs: 0 })).toBe(true))
  it('blocks free user at 10 queries', () => expect(canUseAI(free, { queries: 10, bidDocs: 0 })).toBe(false))
  it('always allows pro', () => expect(canUseAI(pro, { queries: 999, bidDocs: 0 })).toBe(true))
})

describe('canSaveTenders', () => {
  it('allows free user with < 5 tenders', () => expect(canSaveTenders(free, 4)).toBe(true))
  it('blocks free user at 5 tenders', () => expect(canSaveTenders(free, 5)).toBe(false))
  it('always allows pro', () => expect(canSaveTenders(pro, 999)).toBe(true))
})

describe('canUseBidGenerator', () => {
  it('blocks free users', () => expect(canUseBidGenerator(free, { queries: 0, bidDocs: 0 })).toBe(false))
  it('allows pro under soft cap', () => expect(canUseBidGenerator(pro, { queries: 0, bidDocs: 10 })).toBe(true))
  it('blocks pro at 30 bid doc soft cap', () => expect(canUseBidGenerator(pro, { queries: 0, bidDocs: 30 })).toBe(false))
})

describe('getBlockReason', () => {
  it('returns a non-empty string for ai', () => {
    expect(getBlockReason('ai').length).toBeGreaterThan(0)
  })
  it('returns a non-empty string for pro', () => {
    expect(getBlockReason('pro').length).toBeGreaterThan(0)
  })
})

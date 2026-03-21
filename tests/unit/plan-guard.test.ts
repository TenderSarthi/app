import { describe, it, expect } from 'vitest'
import { isPro, canUseAI, canSaveTenders, canUseBidGenerator, getBlockReason, isOnTrial, isTrialExpired, isPaidPro } from '@/lib/plan-guard'
import type { UserProfile } from '@/lib/types'
import type { Timestamp } from 'firebase/firestore'

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

function makeTimestamp(date: Date): Timestamp {
  return { toDate: () => date, seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 } as Timestamp
}

const tomorrow  = makeTimestamp(new Date(Date.now() + 86_400_000))
const yesterday = makeTimestamp(new Date(Date.now() - 86_400_000))

const trialActive  = { plan: 'pro', trialUsed: true, razorpaySubscriptionId: null, trialEndsAt: tomorrow } as UserProfile
const trialExpired = { plan: 'pro', trialUsed: true, razorpaySubscriptionId: null, trialEndsAt: yesterday } as UserProfile
const paidPro      = { plan: 'pro', trialUsed: true, razorpaySubscriptionId: 'sub_xxx', trialEndsAt: null } as UserProfile

describe('isOnTrial', () => {
  it('true for active trial user', () => expect(isOnTrial(trialActive)).toBe(true))
  it('false for free user', () => expect(isOnTrial(free)).toBe(false))
  it('false for paid pro (has subscriptionId)', () => expect(isOnTrial(paidPro)).toBe(false))
})

describe('isTrialExpired', () => {
  it('true when trialEndsAt is in the past', () => expect(isTrialExpired(trialExpired)).toBe(true))
  it('false when trialEndsAt is in the future', () => expect(isTrialExpired(trialActive)).toBe(false))
  it('false for non-trial user', () => expect(isTrialExpired(free)).toBe(false))
})

describe('isPaidPro', () => {
  it('true when plan is pro and has subscriptionId', () => expect(isPaidPro(paidPro)).toBe(true))
  it('false for trial user (no subscriptionId)', () => expect(isPaidPro(trialActive)).toBe(false))
  it('false for free user', () => expect(isPaidPro(free)).toBe(false))
})

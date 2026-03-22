// tests/unit/dashboard-utils.test.ts
import { describe, it, expect } from 'vitest'
import { getPlanBadge, deriveDeadlineInfo } from '@/lib/dashboard-utils'
import type { UserProfile, Tender } from '@/lib/types'
import type { Timestamp } from 'firebase/firestore'

// Minimal Timestamp mock — only toMillis() is used by our helpers
function ts(ms: number): Timestamp {
  return { toMillis: () => ms } as unknown as Timestamp
}

const baseProfile: UserProfile = {
  uid: 'u1',
  name: 'Test User',
  businessName: '',
  phone: null,
  email: null,
  gstin: null,
  udyamNumber: null,
  state: 'Maharashtra',
  categories: ['Transport & Vehicles'],
  language: 'hi',
  plan: 'free',
  trialUsed: false,
  trialEndsAt: null,
  proSince: null,
  proRenewsAt: null,
  razorpayCustomerId: null,
  razorpaySubscriptionId: null,
  experienceYears: null,
  fcmToken: null,
  notificationsDeclined: false,
  scheduledDowngradeAt: null,
  deletionRequested: false,
  deletionRequestedAt: null,
  createdAt: ts(0),
  lastActiveAt: null,
}

const baseTender: Tender = {
  id: 't1',
  userId: 'u1',
  name: 'Test Tender',
  gemId: '',
  category: 'Transport & Vehicles',
  state: 'Maharashtra',
  deadline: null,
  status: 'active',
  aiSummary: null,
  gemUrl: null,
  createdAt: ts(1_000),
  updatedAt: ts(1_000),
}

// ─── getPlanBadge ─────────────────────────────────────────────────────────────

describe('getPlanBadge', () => {
  it('returns "Pro" for a pro plan user', () => {
    expect(getPlanBadge({ ...baseProfile, plan: 'pro' })).toBe('Pro')
  })

  it('returns "Free" when on free plan with no trial', () => {
    expect(getPlanBadge({ ...baseProfile, plan: 'free', trialEndsAt: null })).toBe('Free')
  })

  it('returns "Pro Trial · N days left" when trial is active', () => {
    // Use 3.5 days so Math.ceil produces 4 regardless of sub-ms timing differences
    const futureMs = Date.now() + 3.5 * 86_400_000
    const result = getPlanBadge({ ...baseProfile, plan: 'free', trialEndsAt: ts(futureMs) })
    expect(result).toBe('Pro Trial · 4 days left')
  })

  it('returns "Free" when trial timestamp is in the past', () => {
    const pastMs = Date.now() - 86_400_000 // 1 day ago
    const result = getPlanBadge({ ...baseProfile, plan: 'free', trialEndsAt: ts(pastMs) })
    expect(result).toBe('Free')
  })
})

// ─── deriveDeadlineInfo ───────────────────────────────────────────────────────

describe('deriveDeadlineInfo', () => {
  it('returns undefined nextDeadlineTender and null daysUntilDeadline when no tenders have deadlines', () => {
    const { nextDeadlineTender, daysUntilDeadline } = deriveDeadlineInfo([baseTender])
    expect(nextDeadlineTender).toBeUndefined()
    expect(daysUntilDeadline).toBeNull()
  })

  it('returns the most recently created tender as fallback when no deadlines', () => {
    const t1 = { ...baseTender, id: 't1', createdAt: ts(1_000) }
    const t2 = { ...baseTender, id: 't2', createdAt: ts(5_000) }
    const { fallbackTender } = deriveDeadlineInfo([t1, t2])
    expect(fallbackTender?.id).toBe('t2')
  })

  it('picks the earliest deadline from multiple tenders with deadlines', () => {
    const t1 = { ...baseTender, id: 't1', deadline: ts(3_000) }
    const t2 = { ...baseTender, id: 't2', deadline: ts(1_000) }
    const { nextDeadlineTender } = deriveDeadlineInfo([t1, t2])
    expect(nextDeadlineTender?.id).toBe('t2')
  })

  it('does not mutate the input array when deriving fallback', () => {
    const tenders = [baseTender, { ...baseTender, id: 't2', createdAt: ts(5_000) }]
    const original = [...tenders]
    deriveDeadlineInfo(tenders)
    expect(tenders).toEqual(original) // no mutation
  })

  it('returns all undefined/null for empty list', () => {
    const { nextDeadlineTender, fallbackTender, daysUntilDeadline } = deriveDeadlineInfo([])
    expect(nextDeadlineTender).toBeUndefined()
    expect(fallbackTender).toBeUndefined()
    expect(daysUntilDeadline).toBeNull()
  })
})

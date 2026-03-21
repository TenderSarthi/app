import type { UserProfile } from './types'

const FREE_AI_QUERY_LIMIT   = 10
const FREE_TENDER_SAVE_LIMIT = 5
const PRO_BID_DOC_SOFT_CAP  = 30

export interface AIUsage { queries: number; bidDocs: number }

export function isPro(user: UserProfile, now = new Date()): boolean {
  if (user.plan !== 'pro') return false
  // Grace period ended (subscription cancelled, billing period expired)
  if (user.scheduledDowngradeAt && user.scheduledDowngradeAt.toDate() <= now) return false
  return true
}

export function canUseAI(user: UserProfile, usage: AIUsage): boolean {
  if (isPro(user)) return true
  return usage.queries < FREE_AI_QUERY_LIMIT
}

export function canSaveTenders(user: UserProfile, currentCount: number): boolean {
  if (isPro(user)) return true
  return currentCount < FREE_TENDER_SAVE_LIMIT
}

export function canUseBidGenerator(user: UserProfile, usage: AIUsage): boolean {
  if (!isPro(user)) return false
  return usage.bidDocs < PRO_BID_DOC_SOFT_CAP
}

const BLOCK_REASONS: Record<'hi' | 'en', Record<'ai' | 'tenders' | 'bidGenerator' | 'pro', string>> = {
  hi: {
    ai:           `आपने इस महीने ${FREE_AI_QUERY_LIMIT}/${FREE_AI_QUERY_LIMIT} AI queries use कर लिए। Pro में upgrade करें।`,
    tenders:      `Free plan में ${FREE_TENDER_SAVE_LIMIT} tenders save कर सकते हैं।`,
    bidGenerator: 'Bid Document Generator Pro feature है।',
    pro:          'यह Pro feature है। Upgrade करें।',
  },
  en: {
    ai:           `You've used all ${FREE_AI_QUERY_LIMIT} AI queries this month. Upgrade to Pro.`,
    tenders:      `Free plan allows saving up to ${FREE_TENDER_SAVE_LIMIT} tenders.`,
    bidGenerator: 'Bid Document Generator is a Pro feature.',
    pro:          'This is a Pro feature. Please upgrade.',
  },
}

export function getBlockReason(
  feature: 'ai' | 'tenders' | 'bidGenerator' | 'pro',
  locale: 'hi' | 'en' = 'hi',
): string {
  return BLOCK_REASONS[locale]?.[feature] ?? BLOCK_REASONS.hi[feature]
}

/**
 * True when the user is on a 7-day trial (plan=pro, no paid subscription).
 * Trial users have trialUsed=true and razorpaySubscriptionId=null.
 */
export function isOnTrial(user: UserProfile): boolean {
  return (
    user.plan === 'pro' &&
    user.trialUsed &&
    user.razorpaySubscriptionId === null &&
    user.trialEndsAt !== null
  )
}

/**
 * True when the trial has ended and the user has not subscribed.
 * Pass `now` in tests to control the clock.
 */
export function isTrialExpired(user: UserProfile, now = new Date()): boolean {
  if (!isOnTrial(user)) return false
  const trialEndsAt = user.trialEndsAt
  if (!trialEndsAt) return false
  return trialEndsAt.toDate() <= now
}

/** True when the user is a paying Pro subscriber (not just a trial). */
export function isPaidPro(user: UserProfile): boolean {
  return user.plan === 'pro' && user.razorpaySubscriptionId !== null
}

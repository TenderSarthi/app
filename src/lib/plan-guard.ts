import type { UserProfile } from './types'

const FREE_AI_QUERY_LIMIT   = 10
const FREE_TENDER_SAVE_LIMIT = 5
const PRO_BID_DOC_SOFT_CAP  = 30

export interface AIUsage { queries: number; bidDocs: number }

export function isPro(user: UserProfile): boolean { return user.plan === 'pro' }

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

export function getBlockReason(feature: 'ai' | 'tenders' | 'bidGenerator' | 'pro'): string {
  switch (feature) {
    case 'ai':           return `आपने इस महीने ${FREE_AI_QUERY_LIMIT}/${FREE_AI_QUERY_LIMIT} AI queries use कर लिए। Pro में upgrade करें।`
    case 'tenders':      return `Free plan में ${FREE_TENDER_SAVE_LIMIT} tenders save कर सकते हैं।`
    case 'bidGenerator': return 'Bid Document Generator Pro feature है।'
    case 'pro':          return 'यह Pro feature है। Upgrade करें।'
  }
}

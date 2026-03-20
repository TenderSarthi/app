import type { Timestamp } from 'firebase/firestore'
import { LOCALE_CODES } from './constants'

export type Plan = 'free' | 'pro'
export type LanguageCode = (typeof LOCALE_CODES)[number]

export interface UserProfile {
  uid: string
  name: string
  businessName: string
  phone: string | null
  email: string | null
  gstin: string | null
  udyamNumber: string | null
  state: string
  categories: string[]
  language: LanguageCode
  plan: Plan
  trialUsed: boolean
  trialEndsAt: Timestamp | null
  proSince: Timestamp | null
  proRenewsAt: Timestamp | null
  razorpayCustomerId: string | null
  razorpaySubscriptionId: string | null
  experienceYears: number | null
  fcmToken: string | null
  notificationsDeclined: boolean
  scheduledDowngradeAt: Timestamp | null
  deletionRequested: boolean
  deletionRequestedAt: Timestamp | null
  createdAt: Timestamp
}

export type OnboardingData = Pick<
  UserProfile,
  'name' | 'businessName' | 'state' | 'categories' | 'language' |
  'fcmToken' | 'notificationsDeclined'
>

export function isProPlan(plan: unknown): plan is 'pro' {
  return plan === 'pro'
}

export function isValidLanguageCode(code: unknown): code is LanguageCode {
  return typeof code === 'string' && (LOCALE_CODES as readonly string[]).includes(code)
}

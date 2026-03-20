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

// --- Tender types ---

export type TenderStatus = 'active' | 'won' | 'lost' | 'expired'

export interface Tender {
  id: string
  userId: string
  name: string
  gemId: string
  category: string
  state: string
  deadline: Timestamp | null
  status: TenderStatus
  aiSummary: string | null
  gemUrl: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PlatformStats {
  vendorCount: number
  tendersFiled: number
  tendersWon: number
  lastUpdatedAt: Timestamp | null
}

export function isValidTenderStatus(s: unknown): s is TenderStatus {
  return s === 'active' || s === 'won' || s === 'lost' || s === 'expired'
}

// --- Document Vault types ---

export type DocumentType = 'rc' | 'gst' | 'insurance' | 'itr' | 'msme' | 'pan' | 'udyam' | 'other'

export interface VaultDocument {
  id: string
  userId: string
  type: DocumentType
  fileName: string
  fileSize: number          // bytes
  storagePath: string       // Firebase Storage path, e.g. documents/{uid}/{timestamp}_{name}
  storageUrl: string        // Firebase Storage download URL
  expiresAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
  expiryAlertSent: boolean  // true once 30-day expiry alert has been sent
}

export function isValidDocumentType(s: unknown): s is DocumentType {
  return ['rc','gst','insurance','itr','msme','pan','udyam','other'].includes(s as string)
}

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
}

export interface BidDocument {
  id: string
  userId: string
  tenderId: string
  tenderName: string
  tenderCategory: string
  experienceYears: number
  pastContracts: string
  capacity: string
  quotedRate: string
  winScore: number
  winLabel: string
  generatedDocument: string
  createdAt: Timestamp
}

export interface AlertConfig {
  userId: string
  categories: string[]
  states: string[]
  keywords: string[]
  channels: {
    push: boolean
    whatsapp: boolean
    email: boolean
  }
  active: boolean
  createdAt?: Timestamp
}

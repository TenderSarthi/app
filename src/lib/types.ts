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
  lastActiveAt: Timestamp | null
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
  return typeof s === 'string' && ['rc','gst','insurance','itr','msme','pan','udyam','other'].includes(s)
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

// --- Orders Tracker types ---

export type OrderStatus =
  | 'delivery_pending'
  | 'inspection_pending'
  | 'invoice_pending'
  | 'payment_pending'
  | 'completed'

export interface OrderMilestones {
  deliveryDate: Timestamp | null
  inspectionDate: Timestamp | null
  invoiceDate: Timestamp | null
  paymentDate: Timestamp | null
}

export interface Order {
  id: string
  userId: string
  tenderId: string
  workOrderNumber: string | null
  value: number | null
  status: OrderStatus
  milestones: OrderMilestones
  notes: string | null
  createdAt: Timestamp
}

export function isValidOrderStatus(s: unknown): s is OrderStatus {
  return typeof s === 'string' && [
    'delivery_pending', 'inspection_pending', 'invoice_pending',
    'payment_pending', 'completed',
  ].includes(s)
}

// --- Learning Center types ---

export type ArticleCategory =
  | 'getting_started'
  | 'bidding_strategy'
  | 'finance_compliance'
  | 'post_win'

export interface Article {
  id: string
  category: ArticleCategory
  readMinutes: number
  youtubeId: string | null  // YouTube video ID, e.g. 'dQw4w9WgXcQ' — null if no video
  titleEn: string
  titleHi: string
  summaryEn: string
  summaryHi: string
  bodyEn: string[]   // paragraphs (plain text)
  bodyHi: string[]
}

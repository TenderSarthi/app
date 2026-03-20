import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp,
  collection, query, where, orderBy, onSnapshot, addDoc,
  deleteDoc, increment, QuerySnapshot, DocumentData
} from 'firebase/firestore'
import { db } from './config'
import type { UserProfile, OnboardingData, LanguageCode, Tender, TenderStatus, PlatformStats } from '../types'

export async function getUser(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function userExists(uid: string): Promise<boolean> {
  return (await getDoc(doc(db, 'users', uid))).exists()
}

/** Called immediately after first sign-in. Starts 7-day Pro trial. */
export async function createUser(uid: string, email: string | null, phone: string | null): Promise<void> {
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)

  await setDoc(doc(db, 'users', uid), {
    uid, name: '', businessName: '', phone, email,
    gstin: null, udyamNumber: null, state: '', categories: [],
    language: 'hi', plan: 'pro',          // shown as pro during 7-day trial
    trialUsed: true, trialEndsAt: Timestamp.fromDate(trialEnd),
    proSince: null, proRenewsAt: null,
    razorpayCustomerId: null, razorpaySubscriptionId: null,
    experienceYears: null, fcmToken: null,
    notificationsDeclined: false, scheduledDowngradeAt: null,
    deletionRequested: false, deletionRequestedAt: null,
    createdAt: serverTimestamp(),
  })
}

/** Saves all data collected during onboarding wizard. */
export async function saveOnboardingData(uid: string, data: OnboardingData): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    name: data.name, businessName: data.businessName,
    state: data.state, categories: data.categories,
    language: data.language, fcmToken: data.fcmToken,
    notificationsDeclined: data.notificationsDeclined,
  })
}

/** Switches user language. Propagates to all active sessions via Firestore listener. */
export async function updateLanguage(uid: string, language: LanguageCode): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { language })
}

// ---------- Platform Stats ----------

/** One-time fetch of platformStats/global. Returns null if doc doesn't exist. */
export async function getPlatformStats(): Promise<PlatformStats | null> {
  const snap = await getDoc(doc(db, 'platformStats', 'global'))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    vendorCount: d.vendorCount ?? 0,
    tendersFiled: d.tendersFiled ?? 0,
    tendersWon: d.tendersWon ?? 0,
    lastUpdatedAt: d.lastUpdatedAt ?? null,
  }
}

// ---------- Tenders ----------

/** Saves a new tender document. Returns the new Firestore document ID. */
export async function saveTender(
  uid: string,
  tender: Omit<Tender, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'tenders'), {
    ...tender,
    userId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Real-time listener on the current user's tenders, ordered by createdAt desc. */
export function subscribeUserTenders(
  uid: string,
  onData: (tenders: Tender[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'tenders'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      const tenders: Tender[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tender))
      onData(tenders)
    },
    onError
  )
}

/** Deletes a tender by document ID. */
export async function deleteTender(tenderId: string): Promise<void> {
  await deleteDoc(doc(db, 'tenders', tenderId))
}

/** Updates tender status. */
export async function updateTenderStatus(tenderId: string, status: TenderStatus): Promise<void> {
  await updateDoc(doc(db, 'tenders', tenderId), {
    status,
    updatedAt: serverTimestamp(),
  })
}

// ---------- AI Usage ----------

/** Returns current month key in format YYYY-MM. */
export function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export interface AIUsageData { queries: number; bidDocs: number }

/** Fetches AI usage for the current month. Returns zeros if doc doesn't exist. */
export async function getAIUsage(uid: string): Promise<AIUsageData> {
  const ref = doc(db, 'aiUsage', uid, currentMonthKey(), 'data')
  const snap = await getDoc(ref)
  if (!snap.exists()) return { queries: 0, bidDocs: 0 }
  const d = snap.data()
  return { queries: d.queries ?? 0, bidDocs: d.bidDocs ?? 0 }
}

/**
 * Atomically increments the AI query counter for the current month.
 */
export async function incrementAIQueryCount(uid: string): Promise<void> {
  const ref = doc(db, 'aiUsage', uid, currentMonthKey(), 'data')
  await setDoc(ref, { queries: increment(1) }, { merge: true })
}

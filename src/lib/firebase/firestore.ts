import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp,
  collection, query, where, orderBy, onSnapshot, addDoc,
  deleteDoc, increment, QuerySnapshot, DocumentData
} from 'firebase/firestore'
import { db } from './config'
import type { UserProfile, OnboardingData, LanguageCode, Tender, TenderStatus, PlatformStats, VaultDocument, BidDocument, AlertConfig, Order, OrderStatus, OrderMilestones } from '../types'

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
    lastActiveAt: serverTimestamp(),
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

/** Updates editable profile fields set by the user in Settings. */
export type ProfileUpdate = Partial<Pick<UserProfile,
  'name' | 'businessName' | 'gstin' | 'udyamNumber' | 'state' | 'categories' | 'experienceYears'
>>

export async function updateProfile(uid: string, data: ProfileUpdate): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...data })
}

/** Switches user language. Propagates to all active sessions via Firestore listener. */
export async function updateLanguage(uid: string, language: LanguageCode): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { language })
}

/** Updates lastActiveAt to now. Call on dashboard load to track active users. */
export async function touchLastActive(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { lastActiveAt: serverTimestamp() })
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

// ---------- Document Vault ----------

/** Saves new vault document metadata. Returns the new Firestore document ID. */
export async function addVaultDocument(
  uid: string,
  data: Omit<VaultDocument, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'documents'), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Real-time listener on user's vault documents, ordered by createdAt desc. */
export function subscribeUserDocuments(
  uid: string,
  onData: (docs: VaultDocument[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'documents'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as VaultDocument)))
    },
    onError
  )
}

/** Deletes vault document metadata from Firestore. Caller is responsible for deleting the Storage file. */
export async function deleteVaultDocument(documentId: string): Promise<void> {
  await deleteDoc(doc(db, 'documents', documentId))
}

// ---------- Bid History ----------

/** Saves generated bid document to history. Returns new document ID. */
export async function addBidDocument(
  uid: string,
  data: Omit<BidDocument, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'bidHistory'), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Real-time listener for user's bid history, newest first. */
export function subscribeBidHistory(
  uid: string,
  onData: (docs: BidDocument[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'bidHistory'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as BidDocument)))
    },
    onError
  )
}

/** Atomically increments the bidDocs counter for the current month. */
export async function incrementBidDocCount(uid: string): Promise<void> {
  const ref = doc(db, 'aiUsage', uid, currentMonthKey(), 'data')
  await setDoc(ref, { bidDocs: increment(1) }, { merge: true })
}

// ---------- Alert Config ----------

/** Create or overwrite a user's alert config (one config per user). */
export async function saveAlertConfig(
  uid: string,
  config: Omit<AlertConfig, 'userId' | 'createdAt'>
): Promise<void> {
  const ref = doc(db, 'alertConfigs', uid)
  await setDoc(ref, {
    ...config,
    userId: uid,
    createdAt: serverTimestamp(),
  })
}

/** Fetch a user's alert config once. Returns null if not configured yet. */
export async function getAlertConfig(uid: string): Promise<AlertConfig | null> {
  const snap = await getDoc(doc(db, 'alertConfigs', uid))
  if (!snap.exists()) return null
  return { ...(snap.data() as AlertConfig) }
}

/** Real-time listener for a user's alert config. */
export function subscribeAlertConfig(
  uid: string,
  onData: (config: AlertConfig | null) => void,
  onError: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'alertConfigs', uid),
    snap => onData(snap.exists() ? (snap.data() as AlertConfig) : null),
    onError
  )
}

// ---------- Orders ----------

/** Add a new work order. Returns the new Firestore document ID. */
export async function addOrder(
  uid: string,
  data: Omit<Order, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'orders'), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Real-time listener on the current user's orders, newest first. */
export function subscribeOrders(
  uid: string,
  onData: (orders: Order[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'orders'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)))
    },
    onError
  )
}

/** Update simple fields on an order (notes, workOrderNumber, value). */
export async function updateOrder(
  orderId: string,
  updates: Partial<Pick<Order, 'workOrderNumber' | 'value' | 'notes'>>
): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), updates)
}

/**
 * Advance an order to the next milestone.
 * Sets milestones.{milestoneKey} = serverTimestamp() and updates status.
 * Uses Firestore dot-notation to merge into the milestones map without
 * overwriting the other milestone fields.
 */
export async function advanceOrderMilestone(
  orderId: string,
  milestoneKey: keyof OrderMilestones,
  nextStatus: OrderStatus
): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), {
    [`milestones.${milestoneKey}`]: serverTimestamp(),
    status: nextStatus,
  })
}

/** Delete a work order permanently. */
export async function deleteOrder(orderId: string): Promise<void> {
  await deleteDoc(doc(db, 'orders', orderId))
}

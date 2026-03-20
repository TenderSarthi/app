import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from './config'
import type { UserProfile, OnboardingData, LanguageCode } from '../types'

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

import {
  GoogleAuthProvider, RecaptchaVerifier,
  signInWithPopup, signInWithPhoneNumber, signOut as fbSignOut,
  onAuthStateChanged, type User, type ConfirmationResult,
} from 'firebase/auth'
import { auth } from './config'

export type { User, ConfirmationResult }

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

/** phoneNumber must be E.164 format: "+919876543210" */
export async function sendOtp(phoneNumber: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' })
  return signInWithPhoneNumber(auth, phoneNumber, verifier)
}

export async function verifyOtp(confirmation: ConfirmationResult, otp: string): Promise<User> {
  return (await confirmation.confirm(otp)).user
}

export async function signOut(): Promise<void> { await fbSignOut(auth) }

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb)
}

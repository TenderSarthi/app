import { NextRequest, NextResponse } from 'next/server'
import { getAuth }      from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'
import { rzp } from '@/lib/razorpay-admin'
import { downgradeToFree } from '@/lib/firebase/admin-firestore'
import type { UserProfile } from '@/lib/types'

async function verifyToken(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const decoded = await getAuth().verifyIdToken(auth.slice(7))
    return decoded.uid
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const uid = await verifyToken(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snap    = await getFirestore().doc(`users/${uid}`).get()
  const profile = snap.data() as UserProfile | undefined
  const subId   = profile?.razorpaySubscriptionId

  if (!subId) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
  }

  // Cancel immediately (false = cancel_at_cycle_end=false)
  try {
    await rzp.subscriptions.cancel(subId, false)
  } catch (err) {
    // Log but don't throw — subscription may already be cancelled on Razorpay's side.
    // We still need to downgrade the user in Firestore.
    console.warn('[cancel-subscription] Razorpay cancel failed (may already be cancelled):', err)
  }
  await downgradeToFree(uid)
  return NextResponse.json({ success: true })
}

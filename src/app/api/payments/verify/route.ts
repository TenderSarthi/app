import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'
import { rzp, verifyPaymentSignature } from '@/lib/razorpay-admin'
import { upgradeToPro } from '@/lib/firebase/admin-firestore'

// Minimal shape of subscription returned by rzp.subscriptions.fetch
// (Razorpay SDK types don't expose current_end/customer_id at compile time)
interface FetchedSubscription {
  id:          string
  customer_id: string
  current_end: number    // Unix timestamp of current billing period end
}

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

  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
  } = await req.json() as {
    razorpay_payment_id:      string
    razorpay_subscription_id: string
    razorpay_signature:       string
  }

  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }

  const isValid = verifyPaymentSignature(
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    process.env.RAZORPAY_KEY_SECRET ?? '',
  )
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  // Fetch subscription to get customer ID and renewal date
  const subscription = await rzp.subscriptions.fetch(razorpay_subscription_id) as unknown as FetchedSubscription
  const subNoteUid = (subscription as { notes?: { uid?: string } }).notes?.uid
  if (subNoteUid !== uid) {
    console.error('[verify] Subscription uid mismatch:', { subNoteUid, uid })
    return Response.json({ error: 'Subscription does not belong to this user' }, { status: 403 })
  }
  if (!subscription.customer_id || !subscription.current_end) {
    return NextResponse.json({ error: 'Subscription not yet active' }, { status: 422 })
  }
  const renewsAt = new Date(subscription.current_end * 1000)

  await upgradeToPro(
    uid,
    subscription.customer_id,
    razorpay_subscription_id,
    renewsAt,
  )

  return NextResponse.json({ success: true })
}

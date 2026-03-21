import { NextRequest, NextResponse } from 'next/server'
import { getAuth }      from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'
import { rzp, PLAN_IDS } from '@/lib/razorpay-admin'
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

  const body = await req.json() as { plan?: unknown }
  const { plan } = body
  if (plan !== 'monthly' && plan !== 'annual') {
    return NextResponse.json({ error: 'plan must be "monthly" or "annual"' }, { status: 400 })
  }

  const planId = PLAN_IDS[plan]
  if (!planId) {
    return NextResponse.json(
      { error: `RAZORPAY_PLAN_ID_${plan.toUpperCase()} env var not set` },
      { status: 500 },
    )
  }

  // Load user profile to prefill checkout and reuse existing customer
  const snap    = await getFirestore().doc(`users/${uid}`).get()
  const profile = snap.data() as UserProfile | undefined

  const keyId = process.env.RAZORPAY_KEY_ID
  if (!keyId) {
    console.error('[create-subscription] RAZORPAY_KEY_ID not set')
    return NextResponse.json({ error: 'Payment configuration error' }, { status: 500 })
  }

  // Check for existing active subscription
  if (profile?.razorpaySubscriptionId) {
    try {
      const existingSub = await rzp.subscriptions.fetch(profile.razorpaySubscriptionId)
      const activeStates = ['created', 'authenticated', 'active', 'pending']
      if (activeStates.includes(existingSub.status)) {
        return NextResponse.json({
          subscriptionId: existingSub.id,
          keyId,
        })
      }
    } catch {
      // Subscription not found in Razorpay — proceed to create a new one
    }
  }

  // Reuse existing Razorpay customer or create a new one
  let customerId = profile?.razorpayCustomerId ?? null
  if (!customerId) {
    const customer = await rzp.customers.create({
      name:          profile?.name    || 'TenderSarthi User',
      email:         profile?.email   ?? undefined,
      contact:       profile?.phone   ?? undefined,
      fail_existing: '0',
    })
    customerId = customer.id
    // Persist customer ID so we don't create duplicates on retry
    await getFirestore().doc(`users/${uid}`).update({ razorpayCustomerId: customerId })
  }

  const subscription = await rzp.subscriptions.create({
    plan_id:         planId,
    customer_notify: 1,
    quantity:        1,
    total_count:     120,
    addons:          [],
    notes:           { uid, plan },
  })

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db  = getFirestore()
  const now = Timestamp.now()

  // Find pro users whose trial has ended
  // Requires composite Firestore index on (plan, trialUsed, trialEndsAt)
  // — Firebase console will suggest creating it on first run
  const snapshot = await db.collection('users')
    .where('plan',        '==', 'pro')
    .where('trialUsed',   '==', true)
    .where('trialEndsAt', '<=', now)
    .get()

  // Filter in JS: only downgrade users without a paid subscription
  const toDowngrade = snapshot.docs.filter(
    (d) => d.data().razorpaySubscriptionId === null,
  )

  await Promise.all(toDowngrade.map((d) => d.ref.update({ plan: 'free' })))

  console.info(`[expire-trials] Downgraded ${toDowngrade.length} users`)
  return NextResponse.json({ expired: toDowngrade.length })
}

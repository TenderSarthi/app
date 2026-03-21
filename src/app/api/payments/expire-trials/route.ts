import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if (token.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
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
    (d) => !d.data().razorpaySubscriptionId,
  )

  const results = await Promise.allSettled(
    toDowngrade.map((d) => d.ref.update({ plan: 'free' }))
  )
  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed    = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) console.warn(`[expire-trials] ${failed} updates failed`)

  console.info(`[expire-trials] Downgraded ${succeeded}/${toDowngrade.length} users`)
  return NextResponse.json({ expired: succeeded })
}

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'
import { verifyWebhookSignature } from '@/lib/razorpay-admin'
import { upgradeToPro, renewProSubscription, downgradeToFree } from '@/lib/firebase/admin-firestore'

async function crossVerifyUid(uid: string, subscriptionId: string, event: string): Promise<boolean> {
  const snap = await getFirestore().doc(`users/${uid}`).get()
  if (!snap.exists) return false
  const data = snap.data()
  if (!data) return false

  if (event === 'subscription.activated') {
    // On activation, subscription should not yet be stored (or could be stored from verify)
    return true // Allow through — verify route also handles this
  }
  // For all other events, verify subscription matches
  return data.razorpaySubscriptionId === subscriptionId
}

// Minimal shape of subscription entity in Razorpay webhook payload
interface RzpSubscriptionEntity {
  id:           string
  customer_id:  string
  current_end:  number
  notes?:       { uid?: string }
}

interface RzpWebhookEvent {
  event:    string
  payload?: {
    subscription?: { entity: RzpSubscriptionEntity }
  }
}

export async function POST(req: NextRequest) {
  const rawBody   = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  const isValid = verifyWebhookSignature(
    rawBody,
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  )
  if (!isValid) {
    console.warn('[Webhook] Invalid signature — possible spoofed request')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event     = JSON.parse(rawBody) as RzpWebhookEvent
  const subEntity = event.payload?.subscription?.entity

  // Ignore events that don't carry a subscription entity
  if (!subEntity) return NextResponse.json({ ok: true })

  const uid = subEntity.notes?.uid
  if (!uid) {
    console.warn('[Webhook] subscription.notes.uid missing — skipping', event.event)
    return NextResponse.json({ ok: true })
  }

  const isValidUid = await crossVerifyUid(uid, subEntity.id, event.event)
  if (!isValidUid) {
    console.error(`[webhook] UID mismatch for subscription ${subEntity.id}, claimed uid: ${uid}`)
    return Response.json({ ok: true }) // Return 200 to prevent Razorpay retries
  }

  switch (event.event) {
    case 'subscription.activated': {
      const renewsAt = new Date(subEntity.current_end * 1000)
      await upgradeToPro(uid, subEntity.customer_id, subEntity.id, renewsAt)
      break
    }
    case 'subscription.charged': {
      const renewsAt = new Date(subEntity.current_end * 1000)
      await renewProSubscription(uid, renewsAt)
      break
    }
    case 'subscription.cancelled': {
      await getFirestore().doc(`users/${uid}`).update({
        scheduledDowngradeAt: subEntity.current_end
          ? Timestamp.fromMillis(subEntity.current_end * 1000)
          : null,
      })
      break
    }
    case 'subscription.halted': {
      console.warn('subscription halted for uid:', uid)
      break
    }
    case 'subscription.completed': {
      await downgradeToFree(uid)
      break
    }
    default:
      console.info('[Webhook] Unhandled event:', event.event)
  }

  return NextResponse.json({ ok: true })
}

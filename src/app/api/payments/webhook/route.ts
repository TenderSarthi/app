import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { DocumentData } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'
import { verifyWebhookSignature, rzp } from '@/lib/razorpay-admin'
import { upgradeToPro, renewProSubscription, downgradeToFree } from '@/lib/firebase/admin-firestore'

/**
 * Fetches user data and verifies the webhook event is legitimate for this user.
 * Returns user data on success, null on failure (UID not found, subscription mismatch).
 *
 * For subscription.activated: UID is trusted from notes.uid; server-side Razorpay
 * verification is performed separately before calling upgradeToPro.
 * For all other events: also requires razorpaySubscriptionId to already match.
 */
async function getVerifiedUserData(
  uid: string,
  subscriptionId: string,
  event: string,
): Promise<DocumentData | null> {
  const snap = await getFirestore().doc(`users/${uid}`).get()
  if (!snap.exists) return null
  const data = snap.data()
  if (!data) return null

  if (event === 'subscription.activated') {
    return data // subscription ID not yet stored on first activation — checked separately
  }
  // For all other events the subscription ID must already match what's on file
  return data.razorpaySubscriptionId === subscriptionId ? data : null
}

// Minimal shape of subscription entity in Razorpay webhook payload
interface RzpSubscriptionEntity {
  id:          string
  customer_id: string
  current_end: number
  notes?:      { uid?: string }
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

  const userData = await getVerifiedUserData(uid, subEntity.id, event.event)
  if (!userData) {
    console.error(`[Webhook] UID/subscription mismatch for sub ${subEntity.id}, claimed uid: ${uid}`)
    return NextResponse.json({ ok: true }) // 200 to prevent Razorpay retries
  }

  switch (event.event) {
    case 'subscription.activated': {
      // Idempotency: skip if already upgraded with this exact subscription
      if (userData.razorpaySubscriptionId === subEntity.id && userData.plan === 'pro') {
        console.info('[Webhook] subscription.activated already processed — skipping')
        break
      }

      // CRIT-4: Verify with Razorpay that this subscription is actually active
      // (guards against replayed or forged webhook payloads)
      try {
        const sub = await rzp.subscriptions.fetch(subEntity.id) as unknown as { status: string }
        if (sub.status !== 'active' && sub.status !== 'authenticated') {
          console.warn('[Webhook] subscription.activated but Razorpay status is:', sub.status)
          break
        }
      } catch (verifyErr) {
        console.error('[Webhook] Could not verify subscription status with Razorpay:', verifyErr)
        break // Do not upgrade if we cannot confirm status
      }

      const renewsAt = new Date(subEntity.current_end * 1000)
      await upgradeToPro(uid, subEntity.customer_id, subEntity.id, renewsAt)
      break
    }

    case 'subscription.charged': {
      const renewsAt = new Date(subEntity.current_end * 1000)
      // Idempotency: skip if proRenewsAt is already at or past this renewal date
      const existingRenewsAt = (userData.proRenewsAt as Timestamp | null)?.toDate()
      if (existingRenewsAt && existingRenewsAt.getTime() >= renewsAt.getTime()) {
        console.info('[Webhook] subscription.charged already processed — skipping')
        break
      }
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
      console.warn('[Webhook] subscription halted for uid:', uid)
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

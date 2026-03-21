import { NextRequest, NextResponse } from 'next/server'
import '@/lib/firebase/admin'
import { verifyWebhookSignature } from '@/lib/razorpay-admin'
import { upgradeToPro, renewProSubscription, downgradeToFree } from '@/lib/firebase/admin-firestore'

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
    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.halted': {
      await downgradeToFree(uid)
      break
    }
    default:
      console.info('[Webhook] Unhandled event:', event.event)
  }

  return NextResponse.json({ ok: true })
}

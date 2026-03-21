/**
 * Server-only Razorpay helpers.
 * NEVER import this in 'use client' components — it reads server env vars.
 */
import Razorpay from 'razorpay'
import crypto   from 'node:crypto'

let _rzp: Razorpay | null = null

function getRzpInstance(): Razorpay {
  if (!_rzp) {
    const key_id     = process.env.RAZORPAY_KEY_ID
    const key_secret = process.env.RAZORPAY_KEY_SECRET
    if (!key_id || !key_secret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set')
    }
    _rzp = new Razorpay({ key_id, key_secret })
  }
  return _rzp
}

/** Lazy proxy over the Razorpay singleton — defers env-var validation to first use. */
export const rzp: Pick<Razorpay, 'subscriptions' | 'customers' | 'payments'> = {
  get subscriptions() { return getRzpInstance().subscriptions },
  get customers()     { return getRzpInstance().customers },
  get payments()      { return getRzpInstance().payments },
}

/** Plan IDs created in Razorpay dashboard under Subscriptions > Plans */
export const PLAN_IDS = {
  monthly: process.env.RAZORPAY_PLAN_ID_MONTHLY ?? '',
  annual:  process.env.RAZORPAY_PLAN_ID_ANNUAL  ?? '',
} as const

/**
 * Verifies a Razorpay webhook signature.
 * Razorpay signs the raw request body with HMAC-SHA256 using the webhook secret.
 */
export function verifyWebhookSignature(
  rawBody:   string,
  signature: string,
  secret:    string,
): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

/**
 * Verifies the payment signature returned in the Razorpay checkout handler callback.
 * Razorpay signs `${paymentId}|${subscriptionId}` with the key secret.
 */
export function verifyPaymentSignature(
  paymentId:      string,
  subscriptionId: string,
  signature:      string,
  keySecret:      string,
): boolean {
  const body     = `${paymentId}|${subscriptionId}`
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex')
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

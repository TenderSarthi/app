/**
 * Server-only Razorpay helpers.
 * NEVER import this in 'use client' components — it reads server env vars.
 */
import Razorpay from 'razorpay'
import crypto   from 'node:crypto'

let _rzp: Razorpay | null = null

function getRzpInstance(): Razorpay {
  if (!_rzp) {
    _rzp = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID     ?? '',
      key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
    })
  }
  return _rzp
}

// Export as 'rzp' for spec compliance (lazy proxy for test env)
export const rzp = {
  get subscriptions() {
    return getRzpInstance().subscriptions
  },
  get customers() {
    return getRzpInstance().customers
  },
  get payments() {
    return getRzpInstance().payments
  },
} as unknown as Razorpay

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
  return expected === signature
}

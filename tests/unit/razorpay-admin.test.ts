import crypto from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { verifyWebhookSignature, verifyPaymentSignature } from '@/lib/razorpay-admin'

const WEBHOOK_SECRET = 'test_webhook_secret'
const KEY_SECRET     = 'test_key_secret'
const BODY           = '{"event":"subscription.activated","account_id":"acc_test"}'
const PAY_ID         = 'pay_TestPaymentId123'
const SUB_ID         = 'sub_TestSubscriptionId456'

function hmac(data: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

describe('verifyWebhookSignature', () => {
  const validSig = hmac(BODY, WEBHOOK_SECRET)

  it('returns true for valid signature', () => {
    expect(verifyWebhookSignature(BODY, validSig, WEBHOOK_SECRET)).toBe(true)
  })
  it('returns false when body is tampered', () => {
    expect(verifyWebhookSignature(BODY + 'x', validSig, WEBHOOK_SECRET)).toBe(false)
  })
  it('returns false for wrong secret', () => {
    expect(verifyWebhookSignature(BODY, validSig, 'wrong_secret')).toBe(false)
  })
})

describe('verifyPaymentSignature', () => {
  const validSig = hmac(`${PAY_ID}|${SUB_ID}`, KEY_SECRET)

  it('returns true for valid signature', () => {
    expect(verifyPaymentSignature(PAY_ID, SUB_ID, validSig, KEY_SECRET)).toBe(true)
  })
  it('returns false when payment ID is wrong', () => {
    expect(verifyPaymentSignature('pay_other', SUB_ID, validSig, KEY_SECRET)).toBe(false)
  })
  it('returns false for wrong key secret', () => {
    expect(verifyPaymentSignature(PAY_ID, SUB_ID, validSig, 'wrong_secret')).toBe(false)
  })
})

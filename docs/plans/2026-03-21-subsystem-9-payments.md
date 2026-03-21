# Subsystem 9: Payments + Freemium Gates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Razorpay subscriptions so users can upgrade from free/trial to Pro, with webhook-driven plan lifecycle management and a full Settings page.

**Architecture:** Razorpay Subscriptions API handles recurring billing; server-side API routes create subscriptions, verify initial payments, and process webhook events. `UserProfile.plan` is the single source of truth — updated by `/api/payments/verify` (initial payment) and the webhook handler (renewals, cancellations, trial expiry cron).

**Tech Stack:** `razorpay` npm (Node.js SDK), Firebase Admin SDK (server-side Firestore writes), Next.js App Router API routes, `next/script` for client-side Razorpay checkout script, `node:crypto` for HMAC-SHA256 signature verification, Vitest unit tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/razorpay-admin.ts` | Create | Server-only Razorpay client + signature helpers |
| `src/lib/firebase/admin-firestore.ts` | Create | Admin-SDK Firestore helpers shared by payment routes |
| `src/lib/plan-guard.ts` | Modify | Add `isOnTrial`, `isTrialExpired`, `isPaidPro` |
| `tests/unit/razorpay-admin.test.ts` | Create | 6 tests for HMAC signature functions |
| `tests/unit/plan-guard.test.ts` | Modify | 9 new tests for trial/pro helpers |
| `src/app/api/payments/create-subscription/route.ts` | Create | Create Razorpay subscription, return subscription ID + key |
| `src/app/api/payments/verify/route.ts` | Create | Verify payment signature → upgrade user in Firestore |
| `src/app/api/payments/webhook/route.ts` | Create | Handle Razorpay lifecycle events (charged, cancelled, etc.) |
| `src/app/api/payments/cancel-subscription/route.ts` | Create | Cancel active Razorpay subscription + downgrade user |
| `src/app/api/payments/expire-trials/route.ts` | Create | Cron: downgrade expired trial users to free |
| `src/app/api/payments/delete-request/route.ts` | Create | Mark user account for deletion (Admin panel deletes in Subsystem 11) |
| `src/app/[locale]/(app)/settings/page.tsx` | Modify | Replace placeholder with full Settings + Billing page |
| `vercel.json` | Modify | Add `expire-trials` daily cron |
| `messages/en.json` + 10 locale files | Modify | Add `settings` namespace (22 keys) |
| Memory | Update | Mark Subsystem 9 complete, record key decisions |

---

## Environment Variables (add to `.env.local`)

```bash
# Razorpay — dashboard.razorpay.com > Settings > API Keys
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret

# Razorpay Webhook Secret — dashboard.razorpay.com > Webhooks
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Razorpay Plan IDs — create plans in dashboard first, then paste IDs
# Dashboard > Subscriptions > Plans > Create Plan
RAZORPAY_PLAN_ID_MONTHLY=plan_xxxxxxxxxxxx    # ₹499/month (MRP ₹899 — launch discount)
RAZORPAY_PLAN_ID_ANNUAL=plan_xxxxxxxxxxxx     # ₹3,999/year (MRP ₹7,999 — launch discount)
```

---

## Chunk 1: Infrastructure — Helpers + Unit Tests

### Task 1: Install `razorpay` npm package + create `src/lib/razorpay-admin.ts`

**Files:**
- Create: `src/lib/razorpay-admin.ts`
- Create: `tests/unit/razorpay-admin.test.ts`

- [ ] **Step 1: Install the package**

```bash
cd app && npm install razorpay
```

Expected: package added to `package.json` dependencies.

- [ ] **Step 2: Write failing tests for signature helpers**

Create `tests/unit/razorpay-admin.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd app && npx vitest run tests/unit/razorpay-admin.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/razorpay-admin'`

- [ ] **Step 4: Create `src/lib/razorpay-admin.ts`**

```typescript
/**
 * Server-only Razorpay helpers.
 * NEVER import this in 'use client' components — it reads server env vars.
 */
import Razorpay from 'razorpay'
import crypto   from 'node:crypto'

export const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

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
  return expected === signature
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd app && npx vitest run tests/unit/razorpay-admin.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/razorpay-admin.ts tests/unit/razorpay-admin.test.ts package.json package-lock.json
git commit -m "feat: add razorpay-admin.ts with signature helpers and tests"
```

---

### Task 2: Extend `plan-guard.ts` with trial/pro helpers

**Files:**
- Modify: `src/lib/plan-guard.ts`
- Modify: `tests/unit/plan-guard.test.ts`

- [ ] **Step 1: Write failing tests for new helpers**

Append to `tests/unit/plan-guard.test.ts` (after existing tests).
> **Note:** `UserProfile` and `free` fixture are already defined at the top of that file — do NOT re-import them. Only add the new imports and describe blocks below.

```typescript
// These imports merge with existing ones at the top — do not duplicate UserProfile
import { isOnTrial, isTrialExpired, isPaidPro } from '@/lib/plan-guard'
import type { Timestamp } from 'firebase/firestore'

function makeTimestamp(date: Date): Timestamp {
  return { toDate: () => date, seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 } as Timestamp
}

const tomorrow  = makeTimestamp(new Date(Date.now() + 86_400_000))
const yesterday = makeTimestamp(new Date(Date.now() - 86_400_000))

const trialActive  = { plan: 'pro', trialUsed: true, razorpaySubscriptionId: null, trialEndsAt: tomorrow } as UserProfile
const trialExpired = { plan: 'pro', trialUsed: true, razorpaySubscriptionId: null, trialEndsAt: yesterday } as UserProfile
const paidPro      = { plan: 'pro', trialUsed: true, razorpaySubscriptionId: 'sub_xxx', trialEndsAt: null } as UserProfile

describe('isOnTrial', () => {
  it('true for active trial user', () => expect(isOnTrial(trialActive)).toBe(true))
  it('false for free user', () => expect(isOnTrial(free)).toBe(false))
  it('false for paid pro (has subscriptionId)', () => expect(isOnTrial(paidPro)).toBe(false))
})

describe('isTrialExpired', () => {
  it('true when trialEndsAt is in the past', () => expect(isTrialExpired(trialExpired)).toBe(true))
  it('false when trialEndsAt is in the future', () => expect(isTrialExpired(trialActive)).toBe(false))
  it('false for non-trial user', () => expect(isTrialExpired(free)).toBe(false))
})

describe('isPaidPro', () => {
  it('true when plan is pro and has subscriptionId', () => expect(isPaidPro(paidPro)).toBe(true))
  it('false for trial user (no subscriptionId)', () => expect(isPaidPro(trialActive)).toBe(false))
  it('false for free user', () => expect(isPaidPro(free)).toBe(false))
})
```

- [ ] **Step 2: Run tests to verify new describes fail**

```bash
cd app && npx vitest run tests/unit/plan-guard.test.ts
```

Expected: existing 13 pass (plan-guard already has 13 tests), new 9 fail — `isOnTrial is not a function`

- [ ] **Step 3: Add helpers to `src/lib/plan-guard.ts`**

Append after the `getBlockReason` function:

```typescript
/**
 * True when the user is on a 7-day trial (plan=pro, no paid subscription).
 * Trial users have trialUsed=true and razorpaySubscriptionId=null.
 */
export function isOnTrial(user: UserProfile): boolean {
  return (
    user.plan === 'pro' &&
    user.trialUsed &&
    user.razorpaySubscriptionId === null &&
    user.trialEndsAt !== null
  )
}

/**
 * True when the trial has ended and the user has not subscribed.
 * Pass `now` in tests to control the clock.
 */
export function isTrialExpired(user: UserProfile, now = new Date()): boolean {
  if (!isOnTrial(user)) return false
  return user.trialEndsAt!.toDate() <= now
}

/** True when the user is a paying Pro subscriber (not just a trial). */
export function isPaidPro(user: UserProfile): boolean {
  return user.plan === 'pro' && user.razorpaySubscriptionId !== null
}
```

- [ ] **Step 4: Run all tests**

```bash
cd app && npx vitest run
```

Expected: 148 tests pass (133 baseline + 6 razorpay-admin from Task 1 + 9 plan-guard from this task).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/plan-guard.ts tests/unit/plan-guard.test.ts
git commit -m "feat: add isOnTrial, isTrialExpired, isPaidPro to plan-guard"
```

---

### Task 3: Create `src/lib/firebase/admin-firestore.ts`

**Files:**
- Create: `src/lib/firebase/admin-firestore.ts`

These helpers are shared by the `verify`, `webhook`, and `cancel-subscription` routes to avoid duplicating Firestore Admin update logic.

- [ ] **Step 1: Create the file**

```typescript
/**
 * Firebase Admin SDK Firestore helpers for payment routes.
 * Server-only — never import in 'use client' components.
 *
 * These mirror client-side helpers in firestore.ts but use the Admin SDK
 * so they can be called from API routes without user credentials.
 */
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'

function db() { return getFirestore() }

/** Upgrade user to paid Pro. Called by verify route and subscription.activated webhook. */
export async function upgradeToPro(
  uid:            string,
  customerId:     string,
  subscriptionId: string,
  renewsAt:       Date,
): Promise<void> {
  await db().doc(`users/${uid}`).update({
    plan:                    'pro',
    proSince:                FieldValue.serverTimestamp(),
    proRenewsAt:             Timestamp.fromDate(renewsAt),
    razorpayCustomerId:      customerId,
    razorpaySubscriptionId:  subscriptionId,
    scheduledDowngradeAt:    null,
  })
}

/** Update renewal date on each successful charge. Called by subscription.charged webhook. */
export async function renewProSubscription(uid: string, renewsAt: Date): Promise<void> {
  await db().doc(`users/${uid}`).update({
    proRenewsAt: Timestamp.fromDate(renewsAt),
  })
}

/** Downgrade user to free. Called by cancellation webhooks and expire-trials cron. */
export async function downgradeToFree(uid: string): Promise<void> {
  await db().doc(`users/${uid}`).update({
    plan:                   'free',
    razorpaySubscriptionId: null,
    scheduledDowngradeAt:   null,
    proRenewsAt:            null,
  })
}

/** Mark account for deletion (Admin panel in Subsystem 11 handles actual deletion). */
export async function requestAccountDeletion(uid: string): Promise<void> {
  await db().doc(`users/${uid}`).update({
    deletionRequested:    true,
    deletionRequestedAt:  FieldValue.serverTimestamp(),
  })
}
```

- [ ] **Step 2: Run all tests to verify no regressions**

```bash
cd app && npx vitest run
```

Expected: 148 tests pass.

- [ ] **Step 3: Commit**

```bash
cd app && git add src/lib/firebase/admin-firestore.ts
git commit -m "feat: add admin-firestore.ts with upgradeToPro, downgradeToFree, renewProSubscription"
```

---

## Chunk 2: API Routes

### Task 4: `POST /api/payments/create-subscription`

**Files:**
- Create: `src/app/api/payments/create-subscription/route.ts`

This route is called by the Settings page before opening the Razorpay checkout modal. It creates a Razorpay subscription and returns the subscription ID + public key ID to the client.

- [ ] **Step 1: Create the route**

```typescript
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

  // Reuse existing Razorpay customer or create a new one
  let customerId = profile?.razorpayCustomerId ?? null
  if (!customerId) {
    const customer = await rzp.customers.create({
      name:          profile?.name    || 'TenderSarthi User',
      email:         profile?.email   ?? undefined,
      contact:       profile?.phone   ?? undefined,
      // Don't fail if a customer with this contact already exists
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
    total_count:     120,   // 10 years — effectively open-ended
    addons:          [],
    notes:           { uid, plan },
  })

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId:          process.env.RAZORPAY_KEY_ID,
  })
}
```

- [ ] **Step 2: Run all tests**

```bash
cd app && npx vitest run
```

Expected: 148 tests pass.

- [ ] **Step 3: Commit**

```bash
cd app && git add "src/app/api/payments/create-subscription/route.ts"
git commit -m "feat: add POST /api/payments/create-subscription route"
```

---

### Task 5: `POST /api/payments/verify`

**Files:**
- Create: `src/app/api/payments/verify/route.ts`

Called by the Settings page after the Razorpay checkout `handler` callback fires. Verifies the payment signature and upgrades the user's plan in Firestore. This is the primary upgrade path; the webhook is a safety net.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'
import { rzp, verifyPaymentSignature } from '@/lib/razorpay-admin'
import { upgradeToPro } from '@/lib/firebase/admin-firestore'

// Minimal shape of the subscription object returned by rzp.subscriptions.fetch
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
```

- [ ] **Step 2: Run all tests**

```bash
cd app && npx vitest run
```

Expected: 148 tests pass.

- [ ] **Step 3: Commit**

```bash
cd app && git add "src/app/api/payments/verify/route.ts"
git commit -m "feat: add POST /api/payments/verify route"
```

---

### Task 6: `POST /api/payments/webhook`

**Files:**
- Create: `src/app/api/payments/webhook/route.ts`

Handles Razorpay subscription lifecycle events. Configure this URL in the Razorpay dashboard under Settings > Webhooks.

Events to subscribe to in Razorpay dashboard:
- `subscription.activated` — safety net for initial upgrade
- `subscription.charged` — update renewal date on each billing cycle
- `subscription.cancelled`, `subscription.completed`, `subscription.halted` — downgrade to free

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import '@/lib/firebase/admin'
import { verifyWebhookSignature } from '@/lib/razorpay-admin'
import { upgradeToPro, renewProSubscription, downgradeToFree } from '@/lib/firebase/admin-firestore'

// Raw Razorpay webhook event shape (minimal — only fields we use)
interface RzpSubscriptionEntity {
  id:           string
  customer_id:  string
  current_end:  number
  notes?:       { uid?: string }
}

interface RzpWebhookEvent {
  event:   string
  payload?: {
    subscription?: { entity: RzpSubscriptionEntity }
  }
}

export async function POST(req: NextRequest) {
  const rawBody  = await req.text()
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
      // Unhandled event — log and acknowledge (Razorpay retries on non-200)
      console.info('[Webhook] Unhandled event:', event.event)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Run all tests**

```bash
cd app && npx vitest run
```

Expected: 148 tests pass.

- [ ] **Step 3: Commit**

```bash
cd app && git add "src/app/api/payments/webhook/route.ts"
git commit -m "feat: add POST /api/payments/webhook Razorpay lifecycle handler"
```

---

### Task 7: `POST /api/payments/cancel-subscription` + `POST /api/payments/expire-trials`

**Files:**
- Create: `src/app/api/payments/cancel-subscription/route.ts`
- Create: `src/app/api/payments/expire-trials/route.ts`

- [ ] **Step 1: Create `cancel-subscription/route.ts`**

Cancels the Razorpay subscription at period end (`cancel_at_cycle_end: false` = immediate) and downgrades the user in Firestore. The Settings page calls this with user auth.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuth }      from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'
import { rzp } from '@/lib/razorpay-admin'
import { downgradeToFree } from '@/lib/firebase/admin-firestore'
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

  const snap    = await getFirestore().doc(`users/${uid}`).get()
  const profile = snap.data() as UserProfile | undefined
  const subId   = profile?.razorpaySubscriptionId

  if (!subId) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
  }

  // Cancel immediately in Razorpay (cancel_at_cycle_end=false)
  await rzp.subscriptions.cancel(subId, false)
  await downgradeToFree(uid)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create `expire-trials/route.ts`**

Runs daily via Vercel Cron. Finds users whose 7-day trial has ended and who haven't subscribed, then sets `plan: 'free'`.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Vercel Cron invokes routes via GET — must use GET handler (not POST)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db  = getFirestore()
  const now = Timestamp.now()

  // Find pro users whose trial has ended
  // Note: Firestore requires a composite index on (plan, trialUsed, trialEndsAt)
  // The index will be auto-suggested in Firebase console on first run.
  const snapshot = await db.collection('users')
    .where('plan',       '==', 'pro')
    .where('trialUsed',  '==', true)
    .where('trialEndsAt', '<=', now)
    .get()

  // Filter in JS: only users without a paid subscription
  const toDowngrade = snapshot.docs.filter(
    (d) => d.data().razorpaySubscriptionId === null,
  )

  await Promise.all(toDowngrade.map((d) => d.ref.update({ plan: 'free' })))

  console.info(`[expire-trials] Downgraded ${toDowngrade.length} users`)
  return NextResponse.json({ expired: toDowngrade.length })
}
```

- [ ] **Step 3: Run all tests**

```bash
cd app && npx vitest run
```

Expected: 148 tests pass.

- [ ] **Step 4: Commit**

```bash
cd app && git add "src/app/api/payments/cancel-subscription/route.ts" "src/app/api/payments/expire-trials/route.ts"
git commit -m "feat: add cancel-subscription and expire-trials payment routes"
```

---

## Chunk 3: Settings Page + Vercel Cron + i18n + Memory

### Task 8: Settings page (`src/app/[locale]/(app)/settings/page.tsx`)

**Files:**
- Modify: `src/app/[locale]/(app)/settings/page.tsx`

The page shows plan status, upgrade/cancel CTAs, language switcher, and account deletion. The Razorpay checkout is triggered by loading `checkout.razorpay.com/v1/checkout.js` via `next/script`.

`?upgrade=monthly` / `?upgrade=annual` query params from the existing `UpgradeDialog` auto-trigger checkout on page load.

> **User contribution point — plan status display logic:**
>
> The plan card needs to render three distinct states: active trial (shows expiry countdown), paid Pro (shows renewal date + cancel), and free (shows upgrade CTA). The logic that determines which variant to show is a meaningful UX decision.
>
> In the file below, I've left a `TODO` in the `PlanContent` component. Implement the conditional rendering:
> - If `isPaidPro(profile)` → show renewal date + cancel button
> - Else if `isOnTrial(profile)` and not `isTrialExpired(profile)` → show trial expiry date + upgrade CTA
> - Else → show "Free plan" + upgrade CTA
>
> Use `profile.proRenewsAt?.toDate()` and `profile.trialEndsAt?.toDate()` for dates. Format with `toLocaleDateString('en-IN')`.

- [ ] **Step 1: Create the Settings page**

Replace `src/app/[locale]/(app)/settings/page.tsx` with:

```tsx
'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Script from 'next/script'
import { useTranslations } from 'next-intl'
import { Zap, Shield, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFirebase }      from '@/components/providers/firebase-provider'
import { useUserProfile }   from '@/lib/hooks/use-user-profile'
import { isPro, isOnTrial, isPaidPro, isTrialExpired } from '@/lib/plan-guard'
import { updateLanguage }   from '@/lib/firebase/firestore'
import { track }            from '@/lib/posthog'
import { LOCALE_CODES }     from '@/lib/constants'
import type { LanguageCode } from '@/lib/types'

// useSearchParams requires a Suspense boundary in Next.js App Router
export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-8 w-32 bg-muted/30 animate-pulse rounded" />}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const t             = useTranslations('settings')
  const { user }      = useFirebase()
  const { profile }   = useUserProfile()
  const router        = useRouter()
  const params        = useParams()
  const locale        = params.locale as string
  const searchParams  = useSearchParams()
  const upgradeParam  = searchParams.get('upgrade') as 'monthly' | 'annual' | null

  const [rzpReady,        setRzpReady]        = useState(false)
  const [upgrading,       setUpgrading]       = useState(false)
  const [cancelling,      setCancelling]      = useState(false)
  const [confirmCancel,   setConfirmCancel]   = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(false)
  const [deletionSent,    setDeletionSent]    = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [successMsg,      setSuccessMsg]      = useState<string | null>(null)

  // ── Checkout ──────────────────────────────────────────────────────────
  const handleUpgrade = useCallback(async (plan: 'monthly' | 'annual') => {
    if (!user || !profile || !rzpReady) return
    setUpgrading(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res   = await fetch('/api/payments/create-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan }),
      })
      if (!res.ok) throw new Error('Failed to create subscription')

      const { subscriptionId, keyId } = await res.json() as {
        subscriptionId: string
        keyId: string
      }

      const rzpInstance = new (window as { Razorpay: new (o: unknown) => { open(): void } }).Razorpay({
        key:             keyId,
        subscription_id: subscriptionId,
        name:            'TenderSarthi',
        description:     plan === 'monthly' ? '₹499/month (Launch Offer)' : '₹3,999/year (Launch Offer)',
        prefill: {
          name:    profile.name ?? '',
          email:   profile.email ?? '',
          contact: profile.phone ?? '',
        },
        handler: async (response: {
          razorpay_payment_id:      string
          razorpay_subscription_id: string
          razorpay_signature:       string
        }) => {
          const token2   = await user.getIdToken()
          const verifyRes = await fetch('/api/payments/verify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
            body:    JSON.stringify(response),
          })
          if (verifyRes.ok) {
            track('upgrade_completed', { plan })
            setSuccessMsg(t('upgradeSuccess'))
          } else {
            setError(t('verifyFailed'))
          }
          setUpgrading(false)
        },
        modal: { ondismiss: () => setUpgrading(false) },
      })
      rzpInstance.open()
    } catch {
      setError(t('checkoutFailed'))
      setUpgrading(false)
    }
  }, [user, profile, rzpReady, t])

  // Auto-trigger checkout when arriving from UpgradeDialog (?upgrade=monthly)
  useEffect(() => {
    if (upgradeParam && rzpReady && profile && user) {
      handleUpgrade(upgradeParam)
      router.replace(`/${locale}/settings`, { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradeParam, rzpReady])

  // ── Cancel ────────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (!user) return
    setConfirmCancel(false)
    setCancelling(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res   = await fetch('/api/payments/cancel-subscription', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Cancel failed')
      track('plan_cancelled', {})
    } catch {
      setError(t('cancelFailed'))
    } finally {
      setCancelling(false)
    }
  }, [user, t])

  // ── Delete account ────────────────────────────────────────────────────
  const handleDeleteRequest = useCallback(async () => {
    if (!user) return
    setConfirmDelete(false)
    const token = await user.getIdToken()
    await fetch('/api/payments/delete-request', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })
    setDeletionSent(true)
    track('account_deletion_requested', {})
  }, [user])

  // ── Language ──────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback(async (lang: LanguageCode) => {
    if (!user) return
    await updateLanguage(user.uid, lang)
    router.push(`/${lang}/settings`)
  }, [user, router])

  if (!profile) return null

  return (
    <div className="space-y-6 max-w-lg">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setRzpReady(true)}
      />

      <h1 className="font-heading font-bold text-2xl text-navy">{t('title')}</h1>

      {error      && <p role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {successMsg && <p role="status" className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{successMsg}</p>}

      {/* ── Plan Card ───────────────────────────────────────────────── */}
      <div className="border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-navy flex items-center gap-2">
            <Zap size={18} className="text-orange" />
            {t('planCard')}
          </h2>
          {isPro(profile) && (
            <Badge className="bg-orange text-white">Pro</Badge>
          )}
        </div>

        {/* TODO: Implement plan content rendering based on user plan state */}
        <PlanContent
          profile={profile}
          upgrading={upgrading}
          cancelling={cancelling}
          confirmCancel={confirmCancel}
          onUpgrade={handleUpgrade}
          onCancelClick={() => setConfirmCancel(true)}
          onCancelConfirm={handleCancel}
          onCancelDismiss={() => setConfirmCancel(false)}
          t={t}
        />
      </div>

      {/* ── Language ────────────────────────────────────────────────── */}
      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-navy">{t('language')}</h2>
        <Select
          value={profile.language}
          onValueChange={(v) => handleLanguageChange(v as LanguageCode)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALE_CODES.map((code) => (
              <SelectItem key={code} value={code}>{code.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
      <div className="border border-red-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-red-600">{t('dangerZone')}</h2>
        {deletionSent ? (
          <p className="text-sm text-muted flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            {t('deleteRequested')}
          </p>
        ) : confirmDelete ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">{t('deleteWarning')}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" type="button" onClick={handleDeleteRequest}>
                {t('deleteConfirm')}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setConfirmDelete(false)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm" variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            {t('deleteAccount')}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── PlanContent — the key UX branch ────────────────────────────────────
interface PlanContentProps {
  profile:         ReturnType<typeof useUserProfile>['profile'] & {}
  upgrading:       boolean
  cancelling:      boolean
  confirmCancel:   boolean
  onUpgrade:       (plan: 'monthly' | 'annual') => void
  onCancelClick:   () => void
  onCancelConfirm: () => void
  onCancelDismiss: () => void
  t:               ReturnType<typeof useTranslations>
}

function PlanContent({
  profile, upgrading, cancelling, confirmCancel,
  onUpgrade, onCancelClick, onCancelConfirm, onCancelDismiss, t,
}: PlanContentProps) {
  // TODO: implement the three plan state branches here.
  //
  // Branch 1 — isPaidPro(profile):
  //   Show: "Pro · renews {proRenewsAt.toLocaleDateString('en-IN')}"
  //   CTA: Cancel button (two-step confirm with confirmCancel state)
  //
  // Branch 2 — isOnTrial(profile) && !isTrialExpired(profile):
  //   Show: "Pro Trial · expires {trialEndsAt.toLocaleDateString('en-IN')}"
  //   CTA: Two upgrade buttons (monthly ~~₹899~~ ₹499, annual ~~₹7,999~~ ₹3,999 — launch discount)
  //
  // Branch 3 — free / expired trial:
  //   Show: "Free plan"
  //   CTA: Two upgrade buttons (monthly ~~₹899~~ ₹499, annual ~~₹7,999~~ ₹3,999 — launch discount)
  //
  // Buttons: type="button", disabled when upgrading or cancelling.
  // Loader2 spinner (animate-spin) on buttons when loading.
  // Cancel two-step: show warning text + Confirm/Dismiss buttons.

  return (
    <div className="text-sm text-muted">
      {/* Implement here */}
      <p>{profile.plan === 'pro' ? 'Pro' : 'Free'}</p>
    </div>
  )
}
```

- [ ] **Step 2: Add `POST /api/payments/delete-request/route.ts`** (called by the delete button above)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'
import { requestAccountDeletion } from '@/lib/firebase/admin-firestore'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { uid } = await getAuth().verifyIdToken(auth.slice(7))
    await requestAccountDeletion(uid)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

- [ ] **Step 3: Implement `PlanContent` component**

Replace the TODO placeholder in `PlanContent` with the full conditional rendering:

```tsx
function PlanContent({ profile, upgrading, cancelling, confirmCancel, onUpgrade, onCancelClick, onCancelConfirm, onCancelDismiss, t }: PlanContentProps) {
  const renewDate = profile.proRenewsAt?.toDate().toLocaleDateString('en-IN')
  const trialEnd  = profile.trialEndsAt?.toDate().toLocaleDateString('en-IN')

  const UpgradeCTAs = (
    <div className="flex gap-2 flex-wrap">
      <Button
        size="sm" type="button"
        variant="outline"
        className="border-orange text-orange hover:bg-orange/5"
        disabled={upgrading}
        onClick={() => onUpgrade('monthly')}
      >
        {upgrading ? <Loader2 size={14} className="animate-spin" /> : (
          <><span className="line-through text-xs opacity-60 mr-1">₹899</span>₹499/{t('month')}</>
        )}
      </Button>
      <Button
        size="sm" type="button"
        className="bg-gold text-white hover:bg-gold/90"
        disabled={upgrading}
        onClick={() => onUpgrade('annual')}
      >
        {upgrading ? <Loader2 size={14} className="animate-spin" /> : (
          <><span className="line-through text-xs opacity-60 mr-1">₹7,999</span>₹3,999/{t('year')}</>
        )}
      </Button>
    </div>
  )

  if (isPaidPro(profile)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-navy">
          {t('planPro')} · {t('renewsOn', { date: renewDate ?? '—' })}
        </p>
        {confirmCancel ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">{t('cancelConfirm')}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" type="button" disabled={cancelling} onClick={onCancelConfirm}>
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : t('cancelPlan')}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={onCancelDismiss}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-muted text-xs" type="button" onClick={onCancelClick}>
            {t('cancelPlan')}
          </Button>
        )}
      </div>
    )
  }

  if (isOnTrial(profile) && !isTrialExpired(profile)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-navy flex items-center gap-1.5">
          <Shield size={14} className="text-orange" />
          {t('planTrial')} · {t('trialExpiresOn', { date: trialEnd ?? '—' })}
        </p>
        {UpgradeCTAs}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('planFree')}</p>
      {UpgradeCTAs}
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
cd app && npx vitest run
```

Expected: 148 tests pass.

- [ ] **Step 5: Commit**

```bash
cd app && git add "src/app/[locale]/(app)/settings/page.tsx" "src/app/api/payments/delete-request/route.ts"
git commit -m "feat: implement Settings page with Razorpay checkout + plan card"
```

---

### Task 9: `vercel.json` — add expire-trials cron

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Update vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/alerts/trigger",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/payments/expire-trials",
      "schedule": "0 2 * * *"
    }
  ]
}
```

The `expire-trials` cron runs at 2:00 AM UTC daily (off-peak for Indian users).

- [ ] **Step 2: Commit**

```bash
cd app && git add vercel.json
git commit -m "chore: add expire-trials daily cron to vercel.json"
```

---

### Task 10: i18n — add `settings` namespace to all 11 locales

**Files:**
- Modify: `messages/en.json` + `messages/hi.json` + 9 other locale files

**Keys (22 total):**

```json
{
  "settings": {
    "title": "Settings",
    "planCard": "Your Plan",
    "planFree": "Free plan",
    "planTrial": "Pro Trial",
    "planPro": "Pro",
    "trialExpiresOn": "Trial expires {date}",
    "renewsOn": "Renews {date}",
    "month": "mo",
    "year": "yr",
    "upgradeSuccess": "Pro activated! Enjoy unlimited access.",
    "verifyFailed": "Payment verified failed. Please contact support.",
    "checkoutFailed": "Failed to start checkout. Please try again.",
    "cancelFailed": "Cancellation failed. Please contact support.",
    "cancelPlan": "Cancel plan",
    "cancelConfirm": "Your Pro access ends immediately. Are you sure?",
    "language": "Language",
    "dangerZone": "Danger Zone",
    "deleteAccount": "Delete Account",
    "deleteWarning": "All your data will be permanently deleted. This cannot be undone.",
    "deleteRequested": "Deletion requested. We'll process it within 7 days.",
    "deleteConfirm": "Yes, delete my account",
    "cancel": "Cancel"
  }
}
```

Hindi (`hi.json`):
```json
{
  "settings": {
    "title": "Settings",
    "planCard": "आपका Plan",
    "planFree": "Free plan",
    "planTrial": "Pro Trial",
    "planPro": "Pro",
    "trialExpiresOn": "Trial {date} को खत्म होगा",
    "renewsOn": "{date} को renew होगा",
    "month": "महीना",
    "year": "साल",
    "upgradeSuccess": "Pro activate हो गया! Unlimited access enjoy करें।",
    "verifyFailed": "Payment verify नहीं हो सकी। Support से संपर्क करें।",
    "checkoutFailed": "Checkout शुरू नहीं हो सका। फिर से try करें।",
    "cancelFailed": "Cancel नहीं हो सका। Support से संपर्क करें।",
    "cancelPlan": "Plan cancel करें",
    "cancelConfirm": "आपका Pro access तुरंत बंद हो जाएगा। Sure हैं?",
    "language": "भाषा",
    "dangerZone": "Danger Zone",
    "deleteAccount": "Account Delete करें",
    "deleteWarning": "आपका सारा data permanently delete हो जाएगा। यह undo नहीं हो सकता।",
    "deleteRequested": "Deletion request भेज दी गई। 7 दिनों में process होगा।",
    "deleteConfirm": "हाँ, account delete करें",
    "cancel": "Cancel"
  }
}
```

Marathi (`mr.json`) — unique Marathi translations:
```json
{
  "settings": {
    "title": "सेटिंग्ज",
    "planCard": "तुमची योजना",
    "planFree": "मोफत योजना",
    "planTrial": "Pro चाचणी",
    "planPro": "Pro",
    "trialExpiresOn": "चाचणी {date} रोजी संपेल",
    "renewsOn": "{date} रोजी नूतनीकरण होईल",
    "month": "महिना",
    "year": "वर्ष",
    "upgradeSuccess": "Pro सक्रिय झाले!",
    "verifyFailed": "पेमेंट सत्यापन अयशस्वी.",
    "checkoutFailed": "चेकआउट सुरू झाले नाही.",
    "cancelFailed": "रद्द करणे अयशस्वी.",
    "cancelPlan": "योजना रद्द करा",
    "cancelConfirm": "तुमचा Pro access लगेच संपेल. खात्री आहे?",
    "language": "भाषा",
    "dangerZone": "धोकादायक विभाग",
    "deleteAccount": "खाते हटवा",
    "deleteWarning": "सर्व डेटा कायमचा हटवला जाईल.",
    "deleteRequested": "हटवण्याची विनंती केली.",
    "deleteConfirm": "होय, खाते हटवा",
    "cancel": "रद्द करा"
  }
}
```

All other 8 locales (bn, ta, te, gu, kn, pa, or, ml) — use Hindi translations as placeholder (matches existing codebase pattern):
Copy the `hi.json` settings block verbatim into each of those 8 locale files.

- [ ] **Step 1: Run a Node.js script to add the settings namespace**

```bash
cd app && node -e "
const fs = require('fs');
const path = require('path');
const msgs = require('./messages');

const enSettings = { /* paste en block */ };
const hiSettings = { /* paste hi block */ };
const mrSettings = { /* paste mr block */ };
const indic = ['bn','ta','te','gu','kn','pa','or','ml'];

const localeMap = { en: enSettings, hi: hiSettings, mr: mrSettings };
indic.forEach(l => localeMap[l] = hiSettings);

Object.entries(localeMap).forEach(([locale, settings]) => {
  const file = path.join(__dirname, 'messages', locale + '.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.settings = settings;
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('Updated', locale);
});
"
```

> **Note:** The above is a scaffold — paste the actual JSON objects from above into the script, or edit the files directly with the Edit tool. The important thing is all 11 locale files gain a `settings` key.

- [ ] **Step 2: Run all tests**

```bash
cd app && npx vitest run
```

Expected: 148 tests pass.

- [ ] **Step 3: Commit**

```bash
cd app && git add messages/
git commit -m "feat: add settings i18n namespace to all 11 locales"
```

---

### Task 11: Update memory

**Files:**
- Modify: `memory/project_tendersarthi.md`

- [ ] **Step 1: Update Implementation Status section**

Add to the Implementation Status table:
```
| 9 | Payments + Freemium Gates | ✅ Complete — 148 tests passing, 0 TS errors |
```

- [ ] **Step 2: Add Subsystem 9 Key Decisions section**

```markdown
## Subsystem 9 Key Decisions

1. **Razorpay Subscriptions API** (not payment links) — `razorpaySubscriptionId` on UserProfile enables webhook-driven plan lifecycle.
2. **`verify` route is primary upgrade path** — webhook (`subscription.activated`) is safety net only; avoids race conditions.
3. **`admin-firestore.ts`** — Admin-SDK Firestore helpers shared by multiple routes; separate from browser `firestore.ts`.
4. **Signature functions take `secret` as param** — both `verifyWebhookSignature` and `verifyPaymentSignature` are pure functions, fully unit-testable without env vars.
5. **Cancel = immediate** — `rzp.subscriptions.cancel(id, false)` cancels at period end = false; user loses Pro access immediately (simpler initial version).
6. **Trial expiry cron** — daily at 2 AM UTC; queries `plan=pro + trialUsed=true + trialEndsAt <= now`, filters `razorpaySubscriptionId=null` in JS (Firestore doesn't support compound inequality on different fields).
7. **Razorpay checkout script** — loaded via `next/script strategy="lazyOnload"` on the Settings page; `rzpReady` state gates the checkout call.
8. **`?upgrade=monthly` flow preserved** — UpgradeDialog's existing `window.location.href = '/settings?upgrade=monthly'` works unchanged; Settings page detects query param + auto-triggers checkout.
9. **`useSearchParams` + Suspense** — Settings page wraps content in `<Suspense>` to satisfy Next.js App Router requirement for `useSearchParams()` in static renders.
10. **`delete-request` route** — marks `deletionRequested: true` in Firestore; Subsystem 11 Admin Panel handles actual deletion.
```

- [ ] **Step 3: Commit**

```bash
git add memory/project_tendersarthi.md
git commit -m "docs: update memory with Subsystem 9 completion status and key decisions"
```

---

## Post-Implementation Checklist

- [ ] Set Razorpay webhook URL in dashboard: `https://<your-domain>/api/payments/webhook`
- [ ] Subscribe to events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.completed`, `subscription.halted`
- [ ] Create two Razorpay Plans (₹499/month, ₹3,999/year) and populate `RAZORPAY_PLAN_ID_MONTHLY` / `RAZORPAY_PLAN_ID_ANNUAL` in `.env.local`
- [ ] Deploy once to trigger Firestore composite index creation (Firebase console will show index suggestion for the `expire-trials` query)
- [ ] Test full flow in Razorpay test mode using test card: `4111 1111 1111 1111`, expiry any future date, CVV any 3 digits

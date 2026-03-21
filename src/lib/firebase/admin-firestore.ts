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
    plan: 'pro',
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

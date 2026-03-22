// src/lib/dashboard-utils.ts
import type { Timestamp } from 'firebase/firestore'
import type { UserProfile, Tender } from '@/lib/types'

/**
 * Returns the user-facing plan badge text for the MenuSheet user strip.
 * Priority: pro > active trial > free.
 */
export function getPlanBadge(profile: UserProfile): string {
  if (profile.plan === 'pro') return 'Pro'
  if (profile.trialEndsAt && profile.trialEndsAt.toMillis() > Date.now()) {
    const daysLeft = Math.ceil(
      (profile.trialEndsAt.toMillis() - Date.now()) / 86_400_000
    )
    return `Pro Trial · ${daysLeft} days left`
  }
  return 'Free'
}

export interface DeadlineInfo {
  /** The active tender with the earliest deadline, or undefined if none have deadlines. */
  nextDeadlineTender: (Tender & { deadline: Timestamp }) | undefined
  /** Most recently created active tender — used as fallback when no deadlines are set. */
  fallbackTender: Tender | undefined
  /** Days until nextDeadlineTender's deadline, or null when no deadlines exist. */
  daysUntilDeadline: number | null
}

/**
 * Derives the deadline card data from a list of active tenders.
 * Does NOT mutate the input array.
 */
export function deriveDeadlineInfo(activeTenders: Tender[]): DeadlineInfo {
  const withDeadline = activeTenders
    .filter((t): t is Tender & { deadline: Timestamp } => !!t.deadline)
    .sort((a, b) => a.deadline.toMillis() - b.deadline.toMillis())

  const nextDeadlineTender = withDeadline[0]

  // .slice() prevents mutation of the original activeTenders array
  const fallbackTender = activeTenders
    .slice()
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]

  const daysUntilDeadline = nextDeadlineTender
    ? Math.ceil((nextDeadlineTender.deadline.toMillis() - Date.now()) / 86_400_000)
    : null

  return { nextDeadlineTender, fallbackTender, daysUntilDeadline }
}

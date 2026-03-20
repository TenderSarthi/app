import type { Timestamp } from 'firebase/firestore'

export type DeadlineUrgency = 'red' | 'amber' | 'green' | 'none'

/** How many whole days until the deadline. Negative = overdue. Null = no deadline. */
export function getDeadlineDaysLeft(deadline: Timestamp | null): number | null {
  if (!deadline) return null
  const msLeft = deadline.toMillis() - Date.now()
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24))
}

/**
 * PRD 7.3 urgency:
 *   red   = < 3 days (including overdue)
 *   amber = 3-7 days
 *   green = > 7 days
 *   none  = no deadline
 */
export function getDeadlineUrgency(deadline: Timestamp | null): DeadlineUrgency {
  const days = getDeadlineDaysLeft(deadline)
  if (days === null) return 'none'
  if (days < 3)  return 'red'
  if (days <= 7) return 'amber'
  return 'green'
}

/** Human-readable deadline badge label. */
export function formatDeadlineLabel(deadline: Timestamp | null): string {
  const days = getDeadlineDaysLeft(deadline)
  if (days === null) return ''
  if (days < 0)   return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days left`
}

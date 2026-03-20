import type { Timestamp } from 'firebase/firestore'

export type DeadlineUrgency = 'red' | 'amber' | 'green' | 'none'

/** How many whole days until the deadline. Negative = overdue. Null = no deadline.
 *  Both today and the deadline are normalised to midnight so a deadline anywhere
 *  on today's calendar date always returns 0 (not 1 due to remaining hours). */
export function getDeadlineDaysLeft(deadline: Timestamp | null): number | null {
  if (!deadline) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadlineDay = deadline.toDate()
  deadlineDay.setHours(0, 0, 0, 0)
  return Math.round((deadlineDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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

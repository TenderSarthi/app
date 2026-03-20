import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import {
  getDeadlineUrgency,
  getDeadlineDaysLeft,
  formatDeadlineLabel,
} from '@/lib/deadline-utils'

function daysFromNow(n: number): Timestamp {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return Timestamp.fromDate(d)
}

describe('getDeadlineDaysLeft', () => {
  it('returns null for null deadline', () => {
    expect(getDeadlineDaysLeft(null)).toBeNull()
  })
  it('returns 0 for deadline that is today', () => {
    // daysFromNow(0) inherits the current time, but getDeadlineDaysLeft
    // strips both sides to midnight, so any time on today's date → 0.
    expect(getDeadlineDaysLeft(daysFromNow(0))).toBe(0)
  })
  it('returns 3 for deadline 3 days away', () => {
    expect(getDeadlineDaysLeft(daysFromNow(3))).toBe(3)
  })
  it('returns 10 for deadline 10 days away', () => {
    expect(getDeadlineDaysLeft(daysFromNow(10))).toBe(10)
  })
  it('returns negative for overdue deadline', () => {
    expect(getDeadlineDaysLeft(daysFromNow(-2))).toBeLessThan(0)
  })
})

describe('getDeadlineUrgency', () => {
  it('returns none for null deadline', () => {
    expect(getDeadlineUrgency(null)).toBe('none')
  })
  it('returns red for overdue', () => {
    expect(getDeadlineUrgency(daysFromNow(-1))).toBe('red')
  })
  it('returns red for 0 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(0))).toBe('red')
  })
  it('returns red for 2 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(2))).toBe('red')
  })
  it('returns amber for 3 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(3))).toBe('amber')
  })
  it('returns amber for 7 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(7))).toBe('amber')
  })
  it('returns green for 8 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(8))).toBe('green')
  })
  it('returns green for 30 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(30))).toBe('green')
  })
})

describe('formatDeadlineLabel', () => {
  it('returns empty string for null', () => {
    expect(formatDeadlineLabel(null)).toBe('')
  })
  it('returns Today for 0 days', () => {
    expect(formatDeadlineLabel(daysFromNow(0))).toBe('Today')
  })
  it('returns Tomorrow for 1 day', () => {
    expect(formatDeadlineLabel(daysFromNow(1))).toBe('Tomorrow')
  })
  it('returns X days left for > 1 day', () => {
    expect(formatDeadlineLabel(daysFromNow(5))).toBe('5 days left')
  })
  it('returns Overdue for past deadline', () => {
    expect(formatDeadlineLabel(daysFromNow(-3))).toBe('Overdue')
  })
})

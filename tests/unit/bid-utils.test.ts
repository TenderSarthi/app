import { describe, it, expect } from 'vitest'
import { computeHeuristicScore, getWinScoreResult } from '@/lib/bid-utils'

describe('computeHeuristicScore', () => {
  const base = { userState: 'Maharashtra', tenderState: 'Maharashtra',
    userCategories: ['Transport & Vehicles'], tenderCategory: 'Transport & Vehicles' }

  it('returns High when category matches and high experience', () => {
    const r = computeHeuristicScore({ ...base, experienceYears: 5 })
    expect(r.tier).toBe('high')
  })
  it('returns lower score when category does not match', () => {
    const r = computeHeuristicScore({ ...base, tenderCategory: 'IT & Electronics', experienceYears: 5 })
    expect(r.score).toBeLessThan(computeHeuristicScore({ ...base, experienceYears: 5 }).score)
  })
  it('adds state match bonus', () => {
    const withMatch    = computeHeuristicScore({ ...base, experienceYears: 0 })
    const withoutMatch = computeHeuristicScore({ ...base, experienceYears: 0, tenderState: 'Gujarat' })
    expect(withMatch.score).toBe(withoutMatch.score + 10)
  })
  it('handles null experienceYears as 0', () => {
    const r = computeHeuristicScore({ ...base, experienceYears: null })
    expect(r.score).toBe(80)  // 30 base + 40 cat match + 10 state match + 0 experience
  })
  it('does not add state bonus when states are empty strings', () => {
    const r = computeHeuristicScore({ ...base, userState: '', tenderState: '', experienceYears: 0 })
    expect(r.score).toBe(70)
    expect(r.tier).toBe('high')  // 70 >= 70 boundary
  })
  it('caps score at 95', () => {
    const r = computeHeuristicScore({ ...base, experienceYears: 10 })
    expect(r.score).toBeLessThanOrEqual(95)
  })
  it('returns Low tier for 0 experience, no match, different state', () => {
    const r = computeHeuristicScore({ userState: 'Bihar', tenderState: 'Gujarat',
      userCategories: [], tenderCategory: 'IT & Electronics', experienceYears: 0 })
    expect(r.tier).toBe('low')
  })
})

describe('getWinScoreResult', () => {
  it('returns High for score 70 (boundary)', () => {
    expect(getWinScoreResult(70).tier).toBe('high')
  })
  it('returns Medium for score 69 (boundary)', () => {
    expect(getWinScoreResult(69).tier).toBe('medium')
  })
  it('returns Medium for score 40 (boundary)', () => {
    expect(getWinScoreResult(40).tier).toBe('medium')
  })
  it('returns Low for score 39 (boundary)', () => {
    expect(getWinScoreResult(39).tier).toBe('low')
  })
  it('returns correct colors', () => {
    expect(getWinScoreResult(75).color).toBe('text-success')
    expect(getWinScoreResult(50).color).toBe('text-orange')
    expect(getWinScoreResult(20).color).toBe('text-danger')
  })
  it('preserves score value', () => {
    expect(getWinScoreResult(73).score).toBe(73)
  })
})

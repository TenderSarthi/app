export interface WinScoreInput {
  experienceYears: number | null
  tenderCategory: string
  userCategories: string[]
  userState: string
  tenderState: string
}

export interface WinScoreResult {
  score: number
  label: 'High' | 'Medium' | 'Low'
  color: 'text-success' | 'text-orange' | 'text-danger'
  tier: 'high' | 'medium' | 'low'
}

/** Pure heuristic: instant client-side win probability score. */
export function computeHeuristicScore(input: WinScoreInput): WinScoreResult {
  let score = 30 // base

  // Category match (40 pts max; 0 pts if mismatch — no consolation bonus)
  // Note: plan draft included `else score += 10` but this was dropped as incorrect:
  // a category mismatch is a disqualifying factor, not a partial positive signal.
  if (input.userCategories.includes(input.tenderCategory)) score += 40

  // Experience years (20 pts)
  const exp = input.experienceYears ?? 0
  if (exp >= 5)      score += 20
  else if (exp >= 3) score += 14
  else if (exp >= 1) score += 7

  // State match bonus (10 pts)
  if (input.userState && input.tenderState && input.userState === input.tenderState) score += 10

  return getWinScoreResult(Math.min(95, score))
}

/** Maps a numeric score to label/color/tier. PRD §15.3: >=70 = High, >=40 = Medium, <40 = Low. */
export function getWinScoreResult(score: number): WinScoreResult {
  if (score >= 70) return { score, label: 'High',   color: 'text-success', tier: 'high'   }
  if (score >= 40) return { score, label: 'Medium', color: 'text-orange',  tier: 'medium' }
  return               { score, label: 'Low',    color: 'text-danger',  tier: 'low'    }
}

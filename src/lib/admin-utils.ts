// src/lib/admin-utils.ts

/** Monthly Recurring Revenue estimate (₹499/month per Pro user). */
export function calcMRR(proCount: number): number {
  return proCount * 499
}

/** Format a fraction as a percentage with 1 decimal place. */
export function formatPercent(part: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

/** Format a number as Indian-locale rupees, e.g. 4990 → "₹4,990". */
export function formatCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}

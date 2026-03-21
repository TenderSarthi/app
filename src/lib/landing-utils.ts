/**
 * Formats a platform stat number for the landing page trust bar.
 * Returns '—' when data is not yet loaded.
 * Returns the number in Indian locale with a '+' suffix, e.g. "1,234+".
 */
export function formatStat(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-IN') + '+'
}

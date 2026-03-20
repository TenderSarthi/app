const GEM_BASE = 'https://bidplus.gem.gov.in/bidlists'

interface GemFilters {
  state?: string
  category?: string
}

/**
 * Builds a GeM BidPlus URL pre-filtered by state and/or category.
 */
export function buildGemUrl(filters: GemFilters): string {
  const params = new URLSearchParams()
  if (filters.state)    params.set('state', filters.state)
  if (filters.category) params.set('bid_type', filters.category)
  const qs = params.toString()
  return qs ? `${GEM_BASE}?${qs}` : GEM_BASE
}

/**
 * Builds a GeM search URL for a keyword query.
 */
export function buildGemSearchUrl(keyword: string): string {
  const params = new URLSearchParams({ search: keyword })
  return `${GEM_BASE}?${params.toString()}`
}

import { CATEGORY_KEYWORDS, INDIAN_STATES } from './constants'
import type { AlertConfig } from './types'

export type { AlertConfig }  // re-export so test imports can use @/lib/alert-utils

export interface ParsedTender {
  title: string
  link: string
  description: string
  pubDate: Date
  categories: string[]
  states: string[]
}

/** Convert an RSS feed item into a structured ParsedTender. */
export function parseRSSItem(item: {
  title?: string
  link?: string
  contentSnippet?: string
  pubDate?: string
}): ParsedTender {
  const title = item.title ?? ''
  const description = item.contentSnippet ?? ''
  const text = (title + ' ' + description).toLowerCase()

  // Extract matching states
  const states = INDIAN_STATES.filter(s => text.includes(s.toLowerCase()))

  // Extract matching categories from keywords
  const categories = Object.entries(CATEGORY_KEYWORDS)
    .filter(([, keywords]) => keywords.some(k => text.includes(k.toLowerCase())))
    .map(([cat]) => cat)

  // If no category keyword matched, classify as 'Other' (catch-all for unrecognised tenders)
  const finalCategories = categories.length > 0 ? categories : ['Other']

  return {
    title,
    link: item.link ?? '',
    description,
    pubDate: (() => {
      if (!item.pubDate) return new Date()
      const d = new Date(item.pubDate)
      return isNaN(d.getTime()) ? new Date() : d
    })(),
    categories: finalCategories,
    states,
  }
}

/** Returns true if this tender should trigger an alert for the given config. */
export function matchesAlertConfig(tender: ParsedTender, config: AlertConfig): boolean {
  if (!config.active) return false

  const titleLower = (tender.title + ' ' + tender.description).toLowerCase()

  // Empty arrays mean "match all" for that dimension
  const categoryMatch =
    config.categories.length === 0 ||
    config.categories.some(c => tender.categories.includes(c))

  const stateMatch =
    config.states.length === 0 ||
    config.states.some(s => tender.states.includes(s))

  const keywordMatch =
    config.keywords.length === 0 ||
    config.keywords.some(k => titleLower.includes(k.toLowerCase()))

  return categoryMatch && stateMatch && keywordMatch
}

/** Format a WhatsApp/push alert message for a matched tender. */
export function formatAlertMessage(tender: ParsedTender): string {
  return `नया Tender मिला! 🎯\n${tender.title}\n${tender.link}`
}

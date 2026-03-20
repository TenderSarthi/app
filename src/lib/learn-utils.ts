import type { Article, ArticleCategory } from './types'

/** Returns articles matching the given category, or all articles if 'all'. */
export function filterByCategory(
  articles: Article[],
  category: ArticleCategory | 'all'
): Article[] {
  if (category === 'all') return articles
  return articles.filter((a) => a.category === category)
}

/** Finds an article by its id. Returns undefined if not found. */
export function getArticleById(articles: Article[], id: string): Article | undefined {
  return articles.find((a) => a.id === id)
}

/**
 * Estimates reading time in minutes from an array of body paragraphs.
 * Uses 200 words per minute. Returns at least 1.
 */
export function getReadMinutes(paragraphs: string[]): number {
  const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(wordCount / 200))
}

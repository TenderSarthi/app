import { describe, it, expect } from 'vitest'
import type { Article, ArticleCategory } from '@/lib/types'
import {
  filterByCategory,
  getArticleById,
  getReadMinutes,
} from '@/lib/learn-utils'

// Minimal Article factory for tests
function makeArticle(id: string, category: ArticleCategory, bodyHi: string[] = ['hello world']): Article {
  return {
    id,
    category,
    readMinutes: 2,
    youtubeId: null,
    titleEn: 'Title',
    titleHi: 'शीर्षक',
    summaryEn: 'Summary',
    summaryHi: 'सारांश',
    bodyEn: ['content'],
    bodyHi,
  }
}

const articles: Article[] = [
  makeArticle('a1', 'getting_started'),
  makeArticle('a2', 'getting_started'),
  makeArticle('a3', 'bidding_strategy'),
  makeArticle('a4', 'finance_compliance'),
  makeArticle('a5', 'post_win'),
]

// ---- filterByCategory ----

describe('filterByCategory', () => {
  it('returns all articles when category is "all"', () => {
    expect(filterByCategory(articles, 'all')).toHaveLength(5)
  })

  it('returns only getting_started articles', () => {
    const result = filterByCategory(articles, 'getting_started')
    expect(result).toHaveLength(2)
    result.forEach(a => expect(a.category).toBe('getting_started'))
  })

  it('returns single article for unique category', () => {
    expect(filterByCategory(articles, 'post_win')).toHaveLength(1)
  })

  it('returns empty array for category with no articles', () => {
    expect(filterByCategory([], 'getting_started')).toHaveLength(0)
  })
})

// ---- getArticleById ----

describe('getArticleById', () => {
  it('returns the correct article', () => {
    expect(getArticleById(articles, 'a3')?.id).toBe('a3')
  })

  it('returns undefined for unknown id', () => {
    expect(getArticleById(articles, 'nonexistent')).toBeUndefined()
  })

  it('returns undefined on empty array', () => {
    expect(getArticleById([], 'a1')).toBeUndefined()
  })
})

// ---- getReadMinutes ----

describe('getReadMinutes', () => {
  it('returns 1 for very short content', () => {
    expect(getReadMinutes(['hello'])).toBe(1)
  })

  it('returns 1 for content under 200 words', () => {
    const short = ['word '.repeat(100).trim()]
    expect(getReadMinutes(short)).toBe(1)
  })

  it('returns 2 for ~300 word content', () => {
    const medium = ['word '.repeat(300).trim()]
    expect(getReadMinutes(medium)).toBe(2)
  })

  it('totals words across multiple paragraphs', () => {
    const para = ['word '.repeat(150).trim(), 'word '.repeat(150).trim()] // 300 words
    expect(getReadMinutes(para)).toBe(2)
  })

  it('returns 1 for empty array', () => {
    expect(getReadMinutes([])).toBe(1)
  })
})

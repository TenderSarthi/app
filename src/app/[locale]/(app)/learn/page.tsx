'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { ARTICLES } from '@/lib/learn-content'
import { filterByCategory } from '@/lib/learn-utils'
import { ArticleCard } from '@/components/learn/article-card'
import { CategoryTabs } from '@/components/learn/category-tabs'
import type { ArticleCategory } from '@/lib/types'

// TODO: i18n — replace hardcoded strings once learn namespace is added (Task 6)

type FilterCategory = ArticleCategory | 'all'

export default function LearnPage() {
  const { profile }  = useUserProfile()
  const params       = useParams<{ locale: string }>()
  const locale       = params?.locale ?? 'en'
  const router       = useRouter()

  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all')

  const filteredArticles = useMemo(
    () => filterByCategory(ARTICLES, activeCategory),
    [activeCategory]
  )

  // Article counts per tab (memoized — ARTICLES is static, doesn't change)
  const counts = useMemo(() => {
    const result: Record<FilterCategory, number> = {
      all:                ARTICLES.length,
      getting_started:    ARTICLES.filter(a => a.category === 'getting_started').length,
      bidding_strategy:   ARTICLES.filter(a => a.category === 'bidding_strategy').length,
      finance_compliance: ARTICLES.filter(a => a.category === 'finance_compliance').length,
      post_win:           ARTICLES.filter(a => a.category === 'post_win').length,
    }
    return result
  }, [])

  const handleArticleClick = useCallback((id: string) => {
    router.push(`/${locale}/learn/${id}`)
  }, [locale, router])

  const handleCategoryChange = useCallback((cat: FilterCategory) => {
    setActiveCategory(cat)
  }, [])

  // Loading skeleton — shown before profile resolves (locale may differ)
  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-44 bg-navy/5 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 w-24 bg-navy/5 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-navy/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">Learning Center</h1>
        <p className="text-sm text-muted mt-0.5">GeM tendering guides and tips</p>
      </div>

      {/* Category filter */}
      <CategoryTabs
        active={activeCategory}
        onChange={handleCategoryChange}
        counts={counts}
      />

      {/* Article list */}
      {filteredArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-navy/8 flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-navy/30" />
          </div>
          <p className="font-semibold text-navy text-sm">No articles yet</p>
          <p className="text-sm text-muted mt-1">Check back soon for new content.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              locale={locale}
              onClick={handleArticleClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

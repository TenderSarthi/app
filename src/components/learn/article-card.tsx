'use client'

import type { Article } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, PlayCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// TODO: i18n — replace hardcoded strings once learn namespace is added (Task 6)

interface ArticleCardProps {
  article: Article
  locale: string
  onClick: (id: string) => void
}

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  getting_started:    { label: 'Getting Started',      className: 'bg-navy/10 text-navy'       },
  bidding_strategy:   { label: 'Bidding Strategy',     className: 'bg-orange/10 text-orange'   },
  finance_compliance: { label: 'Finance & Compliance', className: 'bg-success/10 text-success' },
  post_win:           { label: 'Post Win',             className: 'bg-gold/10 text-gold'       },
}

export function ArticleCard({ article, locale, onClick }: ArticleCardProps) {
  const isHindi = locale !== 'en'
  const title   = isHindi ? article.titleHi   : article.titleEn
  const summary = isHindi ? article.summaryHi : article.summaryEn
  const badge   = CATEGORY_BADGE[article.category]

  return (
    <button
      type="button"
      onClick={() => onClick(article.id)}
      className="w-full text-left"
    >
      <Card className="bg-white hover:shadow-md transition-shadow">
        <CardContent className="pt-4">
          {/* Category badge + video chip */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', badge.className)}>
              {badge.label}{/* TODO: i18n */}
            </span>
            {article.youtubeId && (
              <span className="flex items-center gap-0.5 text-xs text-danger font-medium">
                <PlayCircle size={12} />
                Video{/* TODO: i18n */}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="font-semibold text-sm text-navy leading-snug line-clamp-2">
            {title}
          </p>

          {/* Summary */}
          <p className="mt-1 text-xs text-muted line-clamp-2">
            {summary}
          </p>

          {/* Read time */}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted">
            <Clock size={11} />
            <span>{article.readMinutes} min read{/* TODO: i18n */}</span>
            <BookOpen size={11} className="ml-auto" />
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

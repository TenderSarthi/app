'use client'

import { useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ARTICLES } from '@/lib/learn-content'
import { getArticleById } from '@/lib/learn-utils'
import { ArrowLeft, Clock, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// TODO: i18n — replace hardcoded strings once learn namespace is added (Task 6)

const CATEGORY_LABEL: Record<string, string> = {
  getting_started:    'Getting Started',
  bidding_strategy:   'Bidding Strategy',
  finance_compliance: 'Finance & Compliance',
  post_win:           'Post Win',
}

const CATEGORY_CLASS: Record<string, string> = {
  getting_started:    'bg-blue-100 text-blue-700',
  bidding_strategy:   'bg-orange-100 text-orange-700',
  finance_compliance: 'bg-green-100 text-green-700',
  post_win:           'bg-purple-100 text-purple-700',
}

export default function ArticleDetailPage() {
  const params     = useParams<{ locale: string; articleId: string }>()
  const locale     = params?.locale ?? 'en'
  const articleId  = params?.articleId ?? ''
  const router     = useRouter()

  const article = getArticleById(ARTICLES, articleId)
  const isHindi = locale !== 'en'

  const handleBack = useCallback(() => {
    router.push(`/${locale}/learn`)
  }, [locale, router])

  // Article not found
  if (!article) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy"
        >
          <ArrowLeft size={15} />
          Back to Learning Center
        </button>
        <p className="text-navy font-semibold">Article not found.</p>
      </div>
    )
  }

  const title = isHindi ? article.titleHi : article.titleEn
  const body  = isHindi ? article.bodyHi  : article.bodyEn

  return (
    <div className="space-y-5 pb-32 desktop:pb-6 max-w-2xl">
      {/* Back link */}
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy"
      >
        <ArrowLeft size={15} />
        Back to Learning Center
      </button>

      {/* Category badge + read time */}
      <div className="flex items-center gap-3">
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          CATEGORY_CLASS[article.category]
        )}>
          {CATEGORY_LABEL[article.category]}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={11} />
          {article.readMinutes} min read
        </span>
        {article.youtubeId && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <PlayCircle size={11} />
            Video
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="font-heading font-bold text-xl text-navy leading-snug">
        {title}
      </h1>

      {/* YouTube embed */}
      {article.youtubeId && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100">
          <iframe
            src={`https://www.youtube.com/embed/${article.youtubeId}`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
          />
        </div>
      )}

      {/* Body paragraphs */}
      <div className="space-y-4">
        {body.map((paragraph, idx) => (
          <p key={idx} className="text-sm text-gray-700 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Bottom back link */}
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1.5 text-sm text-navy font-medium hover:underline pt-2"
      >
        <ArrowLeft size={15} />
        Back to Learning Center
      </button>
    </div>
  )
}

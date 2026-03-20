'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Search, FileText, MessageSquare, Bell, FolderOpen, ShoppingBag, ChevronRight
} from 'lucide-react'
import { Card } from '@/components/ui/card'

interface FeatureCardData {
  key: string
  href: string
  icon: React.ElementType
  color: string
  bgColor: string
  primary: boolean
}

const FEATURE_CARDS: FeatureCardData[] = [
  { key: 'find',      href: '/find',      icon: Search,        color: 'text-navy',    bgColor: 'bg-navy/10',    primary: true  },
  { key: 'tenders',   href: '/tenders',   icon: FileText,      color: 'text-orange',  bgColor: 'bg-orange/10',  primary: true  },
  { key: 'bid',       href: '/bid',       icon: MessageSquare, color: 'text-gold',    bgColor: 'bg-gold/10',    primary: true  },
  { key: 'alerts',    href: '/alerts',    icon: Bell,          color: 'text-success', bgColor: 'bg-success/10', primary: false },
  { key: 'documents', href: '/documents', icon: FolderOpen,    color: 'text-navy',    bgColor: 'bg-navy/10',    primary: false },
  { key: 'orders',    href: '/orders',    icon: ShoppingBag,   color: 'text-orange',  bgColor: 'bg-orange/10',  primary: false },
]

interface FeatureCardsProps {
  isNewUser: boolean
  locale: string
}

export function FeatureCards({ isNewUser, locale }: FeatureCardsProps) {
  const [expanded, setExpanded] = useState(!isNewUser)
  const t = useTranslations('dashboard')
  const navT = useTranslations('nav')

  const visibleCards = expanded
    ? FEATURE_CARDS
    : FEATURE_CARDS.filter(c => c.primary)

  // Build nav labels using direct function calls
  const NAV_LABELS: Record<string, string> = {
    find: navT('find'),
    tenders: navT('tenders'),
    bid: navT('bid'),
    alerts: navT('alerts'),
    documents: navT('documents'),
    orders: navT('orders'),
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 tablet:grid-cols-3 gap-3">
        {visibleCards.map(card => {
          const Icon = card.icon
          return (
            <Link key={card.key} href={`/${locale}${card.href}`}>
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className={`w-10 h-10 rounded-xl ${card.bgColor} flex items-center justify-center mb-3`}>
                  <Icon className={card.color} size={20} />
                </div>
                <p className="font-semibold text-navy text-sm">{NAV_LABELS[card.key] ?? card.key}</p>
              </Card>
            </Link>
          )
        })}
      </div>

      {isNewUser && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-sm text-orange font-medium hover:underline"
        >
          {t('discoverMore')}
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}

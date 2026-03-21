# Subsystem 8 — Learning Center Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Learning Center — a free-for-all screen at `/learn` where GeM vendors read short Hindi articles and watch embedded YouTube guides on tendering topics.

**Architecture:** All article content lives as static typed data in `src/lib/learn-content.ts` (offline-ready, zero Firestore cost). Pure utility functions in `learn-utils.ts` handle filtering and grouping. Two UI components (`ArticleCard`, `CategoryTabs`) compose the `/learn` list page; a dedicated `/learn/[articleId]` page renders the full article with YouTube embed. No new npm packages needed.

**Tech Stack:** Next.js 16 + Tailwind v4 + shadcn/ui + next-intl (11 locales) + Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Append `ArticleCategory`, `Article` types |
| Create | `src/lib/learn-content.ts` | Static array of 6 seed articles (bilingual EN + HI) |
| Create | `src/lib/learn-utils.ts` | Pure functions: `filterByCategory`, `getArticleById`, `getReadMinutes` |
| Create | `tests/unit/learn-utils.test.ts` | Unit tests (12 tests) |
| Create | `src/components/learn/article-card.tsx` | Card: title, category badge, read time, video chip |
| Create | `src/components/learn/category-tabs.tsx` | Horizontally scrollable category filter chips |
| Modify | `src/app/[locale]/(app)/learn/page.tsx` | Replace placeholder; article list with category filter |
| Create | `src/app/[locale]/(app)/learn/[articleId]/page.tsx` | Article detail: YouTube iframe + body paragraphs |
| Modify | `messages/en.json` + 10 locale files | Add `learn` namespace (17 keys) |

---

## Chunk 1: Foundation — Types, Content, Utilities

### Task 1: Add Article types and seed content

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/learn-content.ts`

- [ ] **Step 1: Append Article types to types.ts**

Open `src/lib/types.ts` and append after the `isValidOrderStatus` block at the end of the file:

```typescript
// --- Learning Center types ---

export type ArticleCategory =
  | 'getting_started'
  | 'bidding_strategy'
  | 'finance_compliance'
  | 'post_win'

export interface Article {
  id: string
  category: ArticleCategory
  readMinutes: number
  youtubeId: string | null  // YouTube video ID, e.g. 'dQw4w9WgXcQ' — null if no video
  titleEn: string
  titleHi: string
  summaryEn: string
  summaryHi: string
  bodyEn: string[]   // paragraphs (plain text)
  bodyHi: string[]
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | head -10
```
Expected: 0 errors

- [ ] **Step 3: Create src/lib/learn-content.ts with 6 seed articles**

Create `src/lib/learn-content.ts`:

```typescript
import type { Article } from './types'

export const ARTICLES: Article[] = [
  {
    id: 'gem-registration',
    category: 'getting_started',
    readMinutes: 3,
    youtubeId: null,
    titleEn: 'How to Register on GeM Portal',
    titleHi: 'GeM Portal पर Register कैसे करें',
    summaryEn: 'A step-by-step guide to creating your seller account on the Government e-Marketplace.',
    summaryHi: 'Government e-Marketplace पर seller account बनाने की step-by-step guide।',
    bodyEn: [
      'GeM (Government e-Marketplace) is India\'s official portal for government procurement. To start selling, you need a valid Aadhaar, PAN, and a registered business entity.',
      'Step 1: Visit gem.gov.in and click "Seller Registration". Select your entity type — Individual, Proprietorship, Partnership, or Private Limited. Enter your Aadhaar number and verify with OTP.',
      'Step 2: Enter your PAN and verify. Step 3: Add your bank account details for payment. Step 4: Set up your seller profile — add your business category, service area, and catalogue. Your account will be reviewed and activated within 2–3 working days.',
    ],
    bodyHi: [
      'GeM (Government e-Marketplace) भारत सरकार का official खरीदी portal है। यहाँ sell करने के लिए आपको valid Aadhaar, PAN और registered business entity चाहिए।',
      'Step 1: gem.gov.in पर जाएं और "Seller Registration" click करें। अपना entity type चुनें — Individual, Proprietorship, Partnership, या Private Limited। Aadhaar number enter करें और OTP से verify करें।',
      'Step 2: PAN enter और verify करें। Step 3: Payment के लिए bank account details add करें। Step 4: Seller profile setup करें — business category, service area और catalogue add करें। 2–3 कार्यदिवस में आपका account review होकर activate हो जाएगा।',
    ],
  },
  {
    id: 'reading-tenders',
    category: 'getting_started',
    readMinutes: 4,
    youtubeId: null,
    titleEn: 'How to Read a Tender Document',
    titleHi: 'Tender Document कैसे पढ़ें',
    summaryEn: 'Understand the key sections of a GeM tender before placing your bid.',
    summaryHi: 'Bid लगाने से पहले GeM tender के important sections समझें।',
    bodyEn: [
      'Every GeM tender has four key sections you must read before bidding: Scope of Work, Eligibility Criteria, Technical Specifications, and Financial Terms.',
      'Scope of Work tells you exactly what the buyer needs — quantity, delivery location, and timeline. Check if it matches your capacity before proceeding. Eligibility Criteria lists mandatory qualifications such as turnover, experience years, or certifications.',
      'Technical Specifications define the exact product or service standards. Your offering must meet every point — partial matches lead to rejection. Financial Terms cover the Earnest Money Deposit (EMD), payment schedule, and penalty clauses. Read these carefully before quoting your rate.',
    ],
    bodyHi: [
      'हर GeM tender में चार important sections होते हैं जो bid लगाने से पहले पढ़ने जरूरी हैं: Scope of Work, Eligibility Criteria, Technical Specifications, और Financial Terms।',
      'Scope of Work बताता है कि buyer को exactly क्या चाहिए — quantity, delivery location, और timeline। Bidding से पहले check करें कि यह आपकी capacity से match करता है। Eligibility Criteria में mandatory qualifications होती हैं जैसे turnover, experience years, या certifications।',
      'Technical Specifications बताती हैं कि product या service किस standard का होना चाहिए। आपकी offering हर point meet करनी चाहिए — partial match से rejection होती है। Financial Terms में EMD, payment schedule, और penalty clauses होते हैं। Rate quote करने से पहले इन्हें ध्यान से पढ़ें।',
    ],
  },
  {
    id: 'bid-rejection',
    category: 'bidding_strategy',
    readMinutes: 3,
    youtubeId: null,
    titleEn: 'How to Avoid Bid Rejection',
    titleHi: 'Bid Rejection से कैसे बचें',
    summaryEn: 'The most common reasons GeM bids are rejected — and how to avoid each one.',
    summaryHi: 'GeM bids reject होने के सबसे common कारण — और उनसे कैसे बचें।',
    bodyEn: [
      'Over 40% of GeM bids are rejected for avoidable reasons. The top three are: incomplete documents, ineligible rates, and missing EMD payment.',
      'Documents: Always attach the exact documents listed in the tender — GST certificate, PAN, experience certificates, and any sector-specific permits. Missing even one document triggers automatic rejection. Rates: Your quoted rate must be within the GeM-verified price range. Rates more than 10% above the benchmark price are automatically flagged.',
      'EMD: Pay the Earnest Money Deposit before the submission deadline — not at the time of submission. Late EMD payments are the single most common rejection reason. Set a reminder 48 hours before the EMD deadline.',
    ],
    bodyHi: [
      'GeM पर 40% से ज्यादा bids avoid किए जा सकने वाले कारणों से reject होती हैं। Top तीन कारण हैं: incomplete documents, ineligible rates, और missing EMD payment।',
      'Documents: Tender में जो documents listed हों वही exactly attach करें — GST certificate, PAN, experience certificates, और sector-specific permits। एक भी document missing होने पर automatic rejection होती है। Rates: आपका quoted rate GeM-verified price range के अंदर होना चाहिए। Benchmark price से 10% से ज्यादा ऊपर rates automatically flag होती हैं।',
      'EMD: Earnest Money Deposit submission deadline से पहले pay करें — submission के time नहीं। Late EMD payment सबसे common rejection reason है। EMD deadline से 48 घंटे पहले reminder set करें।',
    ],
  },
  {
    id: 'emd-explained',
    category: 'finance_compliance',
    readMinutes: 3,
    youtubeId: null,
    titleEn: 'EMD and Bid Security Explained',
    titleHi: 'EMD क्या होता है — पूरी जानकारी',
    summaryEn: 'Everything you need to know about Earnest Money Deposit on GeM tenders.',
    summaryHi: 'GeM tenders पर Earnest Money Deposit के बारे में सब कुछ जानें।',
    bodyEn: [
      'EMD (Earnest Money Deposit) is a refundable security deposit you pay to the buyer before submitting your bid. It shows you are a serious bidder and will honour the contract if selected.',
      'How much? EMD is typically 2–5% of the estimated contract value. It is specified in the tender document. Payment methods on GeM: NEFT/RTGS to the buyer\'s designated bank account, or through the GeM portal\'s online payment gateway.',
      'Refund: If you lose the bid, EMD is refunded within 15–30 days. If you win and complete the contract, EMD is refunded after work acceptance. EMD is forfeited if you withdraw your bid after selection or fail to sign the contract. Always save the EMD payment receipt — you will need it for submission proof.',
    ],
    bodyHi: [
      'EMD (Earnest Money Deposit) एक refundable security deposit है जो आप bid submit करने से पहले buyer को pay करते हैं। यह दिखाता है कि आप serious bidder हैं और select होने पर contract fulfill करेंगे।',
      'कितना? EMD आमतौर पर estimated contract value का 2–5% होता है। यह tender document में specify होता है। GeM पर payment methods: buyer के designated bank account में NEFT/RTGS, या GeM portal के online payment gateway से।',
      'Refund: Bid lose होने पर EMD 15–30 दिनों में refund होता है। Win करने और contract complete करने पर work acceptance के बाद EMD refund होता है। Selection के बाद bid withdraw करने या contract sign न करने पर EMD forfeit होता है। EMD payment receipt हमेशा save करें — submission proof के लिए जरूरी होगी।',
    ],
  },
  {
    id: 'l1-pricing',
    category: 'bidding_strategy',
    readMinutes: 4,
    youtubeId: null,
    titleEn: 'L1 Pricing Strategy',
    titleHi: 'L1 Rate कैसे तय करें — Winning Strategy',
    summaryEn: 'How to quote the right price to win the bid without underselling yourself.',
    summaryHi: 'Bid जीतने के लिए सही price quote करें — खुद को undervalue किए बिना।',
    bodyEn: [
      'In GeM tenders, the L1 (Lowest 1) bidder wins. But winning at any cost is a trap — many vendors win bids at prices too low to profit, leading to cash flow problems and poor delivery.',
      'Your price floor: Add up all your direct costs — materials, labour, transport, taxes, and EMD cost (opportunity cost of blocked funds). Add your overheads (15–20% of direct costs). This is your break-even price. Never quote below this.',
      'Research the market rate: Check GeM\'s price comparison tool for similar items. Look at past tender award prices in your category on GeM. Aim to quote 3–8% below the current market rate — enough to win, not so low you lose money. If your cost structure is higher than L1, improve efficiency before bidding rather than racing to the bottom.',
    ],
    bodyHi: [
      'GeM tenders में L1 (Lowest 1) bidder जीतता है। लेकिन हर हाल में जीतना एक trap है — कई vendors इतनी कम कीमत पर जीतते हैं कि profit नहीं होता, जिससे cash flow problems और poor delivery होती है।',
      'आपका price floor: सभी direct costs जोड़ें — materials, labour, transport, taxes, और EMD cost (blocked funds का opportunity cost)। Overheads add करें (direct costs का 15–20%)। यही आपका break-even price है। इससे नीचे कभी quote न करें।',
      'Market rate research करें: Similar items के लिए GeM की price comparison tool check करें। अपनी category में past tender award prices देखें। Current market rate से 3–8% नीचे quote करने की कोशिश करें — जीतने के लिए enough, लेकिन नुकसान न हो। अगर आपकी cost structure L1 से ज्यादा है, तो race to the bottom में भाग लेने से पहले efficiency improve करें।',
    ],
  },
  {
    id: 'post-win-invoice',
    category: 'post_win',
    readMinutes: 3,
    youtubeId: null,
    titleEn: 'How to Submit an Invoice After Winning',
    titleHi: 'GeM पर Invoice कैसे Submit करें',
    summaryEn: 'Step-by-step guide to raising and submitting your invoice on GeM after delivery.',
    summaryHi: 'Delivery के बाद GeM पर invoice raise और submit करने की step-by-step guide।',
    bodyEn: [
      'After completing delivery, you must raise an invoice on GeM within the timeline specified in your contract (usually 7–15 days). Late invoices delay payment and can attract penalties.',
      'Step 1: Log into GeM → Orders → My Orders. Find the relevant order and click "Raise Invoice". Step 2: Enter the invoice number, date, and amount. Attach the delivery challan/proof of delivery. If a MSME, attach your Udyam certificate to ensure faster payment under MSME payment rules.',
      'Step 3: Submit the invoice. The buyer will then inspect/accept the delivery. Step 4: Once the buyer accepts, GeM processes payment within 10 working days to your registered bank account. Track payment status in GeM → Payments. If payment is delayed beyond 45 days, you can charge interest under the MSMED Act.',
    ],
    bodyHi: [
      'Delivery complete करने के बाद आपको contract में specified timeline के अंदर GeM पर invoice raise करना होगा (आमतौर पर 7–15 दिन)। Late invoices payment delay करती हैं और penalty attract कर सकती हैं।',
      'Step 1: GeM में login करें → Orders → My Orders। Relevant order ढूंढें और "Raise Invoice" click करें। Step 2: Invoice number, date और amount enter करें। Delivery challan/proof of delivery attach करें। MSME होने पर MSME payment rules के तहत faster payment के लिए Udyam certificate attach करें।',
      'Step 3: Invoice submit करें। Buyer delivery inspect/accept करेगा। Step 4: Buyer accept करने के बाद GeM 10 working days में आपके registered bank account में payment process करता है। Payment status GeM → Payments में track करें। 45 दिनों से ज्यादा payment delay होने पर MSMED Act के तहत आप interest charge कर सकते हैं।',
    ],
  },
]
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | head -10
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/types.ts src/lib/learn-content.ts
git commit -m "feat(learn): add Article types and 6 seed articles"
```

---

### Task 2: learn-utils.ts + unit tests

**Files:**
- Create: `src/lib/learn-utils.ts`
- Create: `tests/unit/learn-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/learn-utils.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && npx vitest run tests/unit/learn-utils.test.ts 2>&1 | tail -10
```
Expected: FAIL — "Cannot find module '@/lib/learn-utils'"

- [ ] **Step 3: Create src/lib/learn-utils.ts**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && npx vitest run tests/unit/learn-utils.test.ts 2>&1 | tail -15
```
Expected: 12 tests passing

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd app && npx vitest run 2>&1 | tail -8
```
Expected: All tests passing (133+ total)

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/learn-utils.ts tests/unit/learn-utils.test.ts
git commit -m "feat(learn): add learn-utils with 12 unit tests"
```

---

## Chunk 2: UI Components + Pages

### Task 3: ArticleCard and CategoryTabs components

**Files:**
- Create: `src/components/learn/article-card.tsx`
- Create: `src/components/learn/category-tabs.tsx`

**IMPORTANT: Read these files first before writing any code:**
- `src/components/orders/order-card.tsx` — existing card pattern (Card, CardContent, CardFooter, badge styling, cn())
- `src/components/tenders/tender-card.tsx` — existing list-item card with status badge
- `src/lib/learn-content.ts` — to see Article shape
- `src/lib/types.ts` — to see ArticleCategory type
- `messages/en.json` — `learn` namespace does NOT exist yet (Task 6 adds it). Use hardcoded English with `// TODO: i18n` comments.

- [ ] **Step 1: Create src/components/learn/article-card.tsx**

```tsx
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
  getting_started:   { label: 'Getting Started',    className: 'bg-blue-100 text-blue-700' },
  bidding_strategy:  { label: 'Bidding Strategy',   className: 'bg-orange-100 text-orange-700' },
  finance_compliance:{ label: 'Finance & Compliance',className: 'bg-green-100 text-green-700' },
  post_win:          { label: 'Post Win',            className: 'bg-purple-100 text-purple-700' },
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
              <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
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
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {summary}
          </p>

          {/* Read time */}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={11} />
            <span>{article.readMinutes} min read{/* TODO: i18n */}</span>
            <BookOpen size={11} className="ml-auto" />
          </div>
        </CardContent>
      </Card>
    </button>
  )
}
```

- [ ] **Step 2: Create src/components/learn/category-tabs.tsx**

```tsx
'use client'

import type { ArticleCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

// TODO: i18n — replace hardcoded strings once learn namespace is added (Task 6)

type FilterCategory = ArticleCategory | 'all'

interface CategoryTabsProps {
  active: FilterCategory
  onChange: (category: FilterCategory) => void
  counts: Record<FilterCategory, number>
}

const TABS: { value: FilterCategory; label: string }[] = [
  { value: 'all',               label: 'All' },
  { value: 'getting_started',   label: 'Getting Started' },
  { value: 'bidding_strategy',  label: 'Bidding Strategy' },
  { value: 'finance_compliance',label: 'Finance' },
  { value: 'post_win',          label: 'Post Win' },
]

export function CategoryTabs({ active, onChange, counts }: CategoryTabsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4"
      role="tablist"
      aria-label="Article categories"
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
            active === tab.value
              ? 'bg-navy text-white'
              : 'bg-white text-muted-foreground border border-gray-200 hover:border-navy/30'
          )}
        >
          {tab.label}{/* TODO: i18n */}
          {counts[tab.value] !== undefined && (
            <span className={cn(
              'ml-1',
              active === tab.value ? 'opacity-70' : 'opacity-50'
            )}>
              ({counts[tab.value]})
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd app && git add src/components/learn/
git commit -m "feat(learn): add ArticleCard and CategoryTabs components"
```

---

### Task 4: /learn list page

**Files:**
- Modify: `src/app/[locale]/(app)/learn/page.tsx`

**IMPORTANT: Read these files first:**
- `src/app/[locale]/(app)/orders/page.tsx` — most recent page (pattern to follow: 'use client', useFirebase, useUserProfile, early skeleton return, useCallback hooks before conditionals)
- `src/lib/learn-content.ts` — ARTICLES array
- `src/lib/learn-utils.ts` — filterByCategory, getArticleById
- `src/components/learn/article-card.tsx`
- `src/components/learn/category-tabs.tsx`
- `src/app/[locale]/(app)/learn/page.tsx` — current placeholder to replace

NOTE: Learning Center is FREE FOR ALL users — no Pro gate. But the page still needs `useUserProfile` to get the locale for bilingual content.

- [ ] **Step 1: Replace placeholder with full implementation**

Replace the entire contents of `src/app/[locale]/(app)/learn/page.tsx`:

```tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
          <p className="text-muted-foreground text-sm">No articles in this category yet.</p>
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
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd app && git add "src/app/[locale]/(app)/learn/page.tsx"
git commit -m "feat(learn): implement Learning Center list page with category filter"
```

---

### Task 5: /learn/[articleId] detail page

**Files:**
- Create: `src/app/[locale]/(app)/learn/[articleId]/page.tsx`

**IMPORTANT: Read these files first:**
- `src/lib/learn-content.ts` — ARTICLES array
- `src/lib/learn-utils.ts` — getArticleById
- `src/app/[locale]/(app)/learn/page.tsx` — parent page (pattern for locale, router, profile)
- `src/lib/types.ts` — Article interface (note: bodyHi/bodyEn are string[])

NOTE: Next.js 16 params are `Promise<{locale: string, articleId: string}>` — must be `await`ed. However this page is `'use client'` (same as all app pages), so use `useParams()` hook, NOT async `params` prop.

- [ ] **Step 1: Create article detail page directory and file**

```bash
mkdir -p "app/src/app/[locale]/(app)/learn/[articleId]"
```

Create `src/app/[locale]/(app)/learn/[articleId]/page.tsx`:

```tsx
'use client'

import { useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { ARTICLES } from '@/lib/learn-content'
import { getArticleById } from '@/lib/learn-utils'
import { ArrowLeft, Clock, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// TODO: i18n — replace hardcoded strings once learn namespace is added (Task 6)

const CATEGORY_LABEL: Record<string, string> = {
  getting_started:   'Getting Started',
  bidding_strategy:  'Bidding Strategy',
  finance_compliance:'Finance & Compliance',
  post_win:          'Post Win',
}

const CATEGORY_CLASS: Record<string, string> = {
  getting_started:   'bg-blue-100 text-blue-700',
  bidding_strategy:  'bg-orange-100 text-orange-700',
  finance_compliance:'bg-green-100 text-green-700',
  post_win:          'bg-purple-100 text-purple-700',
}

export default function ArticleDetailPage() {
  const params     = useParams<{ locale: string; articleId: string }>()
  const locale     = params?.locale ?? 'en'
  const articleId  = params?.articleId ?? ''
  const { profile } = useUserProfile()
  const router     = useRouter()

  const article = getArticleById(ARTICLES, articleId)
  const isHindi = locale !== 'en'

  const handleBack = useCallback(() => {
    router.push(`/${locale}/learn`)
  }, [locale, router])

  // Loading skeleton
  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-32 bg-navy/5 rounded animate-pulse" />
        <div className="h-8 w-3/4 bg-navy/5 rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-navy/5 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

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
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 3: Run full test suite**

```bash
cd app && npx vitest run 2>&1 | tail -8
```
Expected: All 133+ tests passing

- [ ] **Step 4: Commit**

```bash
cd app && git add "src/app/[locale]/(app)/learn/[articleId]/"
git commit -m "feat(learn): add article detail page with YouTube embed"
```

---

## Chunk 3: i18n + Memory

### Task 6: Add learn namespace to all 11 locale files

**Files:**
- Modify: `messages/en.json` and 10 Indic locale files

**IMPORTANT:** In every locale file, the existing last key is `"orders"`. Add a comma after the closing brace of `"orders"` and append the `"learn"` block before the final `}`.

- [ ] **Step 1: Add learn namespace to all 11 locale files using Node script**

Run this Node script from `app/`:

```bash
cd app && node -e "
const fs = require('fs');

const enLearn = {
  title: 'Learning Center',
  subtitle: 'GeM tendering guides and tips',
  allArticles: 'All',
  category_getting_started: 'Getting Started',
  category_bidding_strategy: 'Bidding Strategy',
  category_finance_compliance: 'Finance & Compliance',
  category_post_win: 'Post Win',
  readMinutes: '{minutes} min read',
  hasVideo: 'Video',
  backToLearn: 'Back to Learning Center',
  articleNotFound: 'Article not found',
  noArticles: 'No articles in this category yet',
  offlineAvailable: 'Available offline',
  watchVideo: 'Watch Video',
  minRead: 'min read',
  guidesAndTips: 'Guides and tips for GeM vendors',
  articles: 'articles',
};

const hiLearn = {
  title: '\u0938\u0940\u0916\u0928\u0947 \u0915\u093e \u0915\u0947\u0902\u0926\u094d\u0930',
  subtitle: 'GeM tendering \u0915\u0940 guides \u0914\u0930 tips',
  allArticles: '\u0938\u092d\u0940',
  category_getting_started: '\u0936\u0941\u0930\u0941\u0906\u0924',
  category_bidding_strategy: 'Bidding Strategy',
  category_finance_compliance: '\u0935\u093f\u0924\u094d\u0924 \u0914\u0930 Compliance',
  category_post_win: '\u091c\u0940\u0924\u0928\u0947 \u0915\u0947 \u092c\u093e\u0926',
  readMinutes: '{minutes} \u092e\u093f\u0928\u091f \u092e\u0947\u0902 \u092a\u0922\u093c\u0947\u0902',
  hasVideo: '\u0935\u0940\u0921\u093f\u092f\u094b',
  backToLearn: '\u0938\u0940\u0916\u0928\u0947 \u0915\u0947\u0902\u0926\u094d\u0930 \u092a\u0930 \u0935\u093e\u092a\u0938',
  articleNotFound: '\u0932\u0947\u0916 \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u093e',
  noArticles: '\u0907\u0938 category \u092e\u0947\u0902 \u0905\u092d\u0940 \u0915\u094b\u0908 \u0932\u0947\u0916 \u0928\u0939\u0940\u0902',
  offlineAvailable: 'Offline \u0909\u092a\u0932\u092c\u094d\u0927',
  watchVideo: '\u0935\u0940\u0921\u093f\u092f\u094b \u0926\u0947\u0916\u0947\u0902',
  minRead: '\u092e\u093f\u0928\u091f',
  guidesAndTips: 'GeM vendors \u0915\u0947 \u0932\u093f\u090f guides \u0914\u0930 tips',
  articles: '\u0932\u0947\u0916',
};

const mrLearn = {
  title: '\u0936\u093f\u0915\u094d\u0937\u0923 \u0915\u0947\u0902\u0926\u094d\u0930',
  subtitle: 'GeM tendering \u091a\u094d\u092f\u093e guides \u0906\u0923\u093f tips',
  allArticles: '\u0938\u0930\u094d\u0935',
  category_getting_started: '\u0938\u0941\u0930\u0941\u0935\u093e\u0924',
  category_bidding_strategy: 'Bidding Strategy',
  category_finance_compliance: '\u0935\u093f\u0924\u094d\u0924 \u0906\u0923\u093f Compliance',
  category_post_win: '\u091c\u093f\u0902\u0915\u0932\u094d\u092f\u093e\u0928\u0902\u0924\u0930',
  readMinutes: '{minutes} \u092e\u093f\u0928\u093f\u091f\u093e\u0902\u0924 \u0935\u093e\u091a\u093e',
  hasVideo: '\u0935\u094d\u0939\u093f\u0921\u093f\u0913',
  backToLearn: '\u0936\u093f\u0915\u094d\u0937\u0923 \u0915\u0947\u0902\u0926\u094d\u0930\u093e\u0935\u0930 \u092a\u0930\u0924',
  articleNotFound: '\u0932\u0947\u0916 \u0938\u093e\u092a\u0921\u0932\u093e \u0928\u093e\u0939\u0940',
  noArticles: '\u092f\u093e category \u092e\u0927\u094d\u092f\u0947 \u0905\u091c\u0942\u0928 \u0915\u094b\u0923\u0924\u0947\u0939\u0940 \u0932\u0947\u0916 \u0928\u093e\u0939\u0940',
  offlineAvailable: 'Offline \u0909\u092a\u0932\u092c\u094d\u0927',
  watchVideo: '\u0935\u094d\u0939\u093f\u0921\u093f\u0913 \u092a\u0939\u093e',
  minRead: '\u092e\u093f\u0928\u093f\u091f',
  guidesAndTips: 'GeM vendors \u0938\u093e\u0920\u0940 guides \u0906\u0923\u093f tips',
  articles: '\u0932\u0947\u0916',
};

// bn, ta, te, gu, kn, pa, or, ml all use Hindi translations (existing codebase pattern)
const hindiLocales = ['bn','ta','te','gu','kn','pa','or','ml'];
const localeMap = { en: enLearn, hi: hiLearn, mr: mrLearn };
hindiLocales.forEach(l => { localeMap[l] = hiLearn; });

Object.entries(localeMap).forEach(([locale, learn]) => {
  const path = 'messages/' + locale + '.json';
  const data = JSON.parse(require('fs').readFileSync(path, 'utf8'));
  data.learn = learn;
  require('fs').writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(locale, 'OK -', Object.keys(learn).length, 'learn keys');
});
"
```

Expected output: all 11 locales printed with `OK - 17 learn keys`

- [ ] **Step 2: Verify all locale files parse as valid JSON with correct key count**

```bash
cd app && node -e "
const fs = require('fs');
['en','hi','mr','bn','ta','te','gu','kn','pa','or','ml'].forEach(l => {
  const data = JSON.parse(fs.readFileSync('messages/' + l + '.json', 'utf8'));
  const keys = Object.keys(data.learn || {});
  console.log(l, 'OK -', keys.length, 'learn keys');
});
"
```
Expected: `en OK - 17 learn keys` × 11

- [ ] **Step 3: TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | head -10
```
Expected: 0 errors

- [ ] **Step 4: Run full test suite**

```bash
cd app && npx vitest run 2>&1 | tail -8
```
Expected: All 133+ tests passing

- [ ] **Step 5: Commit**

```bash
cd app && git add messages/
git commit -m "feat(learn): add learn i18n namespace for all 11 locales (17 keys each)"
```

---

### Task 7: Update memory

- [ ] **Step 1: Update project_tendersarthi.md**

In `/Users/adityaraj0421/.claude/projects/-Users-adityaraj0421-Cool-Projects-Tender/memory/project_tendersarthi.md`:

In `## Implementation Status`, add after Subsystem 7 line:
```
- Subsystem 8 (Learning Center): ✅ Complete — 133+ tests passing, 0 TS errors
```

Add new section after `## Subsystem 7 Key Decisions`:
```
## Subsystem 8 Key Decisions
- Article content is static data in `src/lib/learn-content.ts` (not Firestore) — offline-ready via JS bundle cache, zero Firestore cost; Subsystem 11 Admin CMS can migrate to Firestore
- 6 seed articles covering PRD topics: GeM registration, reading tenders, bid rejection, EMD, L1 pricing, post-win invoice
- Bilingual content per article (titleEn/titleHi, summaryEn/summaryHi, bodyEn[]/bodyHi[]) — locale !== 'en' shows Hindi
- Article detail at /learn/[articleId] — `useParams()` hook (not async params prop), consistent with Next.js 16 'use client' pages
- YouTube embed: plain iframe (no react-youtube package) — avoids extra dependency
- No Pro gate — Learning Center is free for all users
- CategoryTabs uses `role="tablist"` + `aria-selected` + `role="tab"` for accessibility
- `getReadMinutes` uses 200 wpm, Math.max(1, ...) ensures minimum 1 min
```

- [ ] **Step 2: Commit (from app/ directory)**

No git commit needed for memory — memory files are outside the repo.

---

## Summary

| Chunk | Tasks | New Tests | Commits |
|-------|-------|-----------|---------|
| 1 — Foundation | 2 (types + content + utils) | 12 unit tests | 2 |
| 2 — UI | 3 (components + list page + detail page) | TS check only | 3 |
| 3 — i18n + memory | 2 (11 locales + memory) | JSON parse verify | 1 |
| **Total** | **7** | **12 new + 121 prior = 133+** | **6** |

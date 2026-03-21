# Subsystem 2 — Dashboard + Tender Finder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional Dashboard (`/dashboard`) and Tender Finder (`/find`) including trust signal bar, progressive disclosure cards, AI usage counter, 7-day trial banner, GeM portal deep links, AI tender summarizer (Gemini Flash 2.0), and save-tender flow — with all freemium gates enforced.

**Architecture:** New `Tender` type + Firestore CRUD layer → React hooks for live data → stateless UI components assembled in page files. AI summarization lives in a server-side API route; the client never touches the Gemini API key. Algolia client is wired up for saved-tender search but the Cloud Function sync (server infra) is noted as a prerequisite to deploy separately.

**Tech Stack:** Next.js 16 App Router · Tailwind v4 · shadcn/ui · Firebase Firestore · Gemini Flash 2.0 (`@google/generative-ai`) · algoliasearch · next-intl v4 · Vitest · PostHog

---

## Environment Variables Required (add to `.env.local` before starting)

```bash
# Google AI (Gemini)
GOOGLE_AI_API_KEY=your_key_here

# Algolia
NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=your_search_only_key   # public — read-only
ALGOLIA_ADMIN_KEY=your_admin_key                       # server-only — for Cloud Function
```

## NPM Packages to Install

```bash
cd app
npm install @google/generative-ai algoliasearch
```

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `src/lib/types.ts` | Add `Tender`, `TenderStatus`, `PlatformStats` types (modify existing) |
| `src/lib/firebase/firestore.ts` | Add `saveTender`, `getUserTenders`, `deleteTender`, `getPlatformStats`, `getAIUsage`, `incrementAIUsage` |
| `src/lib/gem-links.ts` | Pure function: build GeM portal deep-link URL from state + category |
| `src/lib/hooks/use-platform-stats.ts` | Real-time listener on `platformStats/global` |
| `src/lib/hooks/use-user-tenders.ts` | Real-time listener on user's `tenders/` collection |
| `src/lib/hooks/use-ai-usage.ts` | One-time read + refresh of `aiUsage/{uid}/{YYYY-MM}` |
| `src/components/dashboard/trust-signal-bar.tsx` | Displays vendorCount, tendersFiled, tendersWon |
| `src/components/dashboard/trial-banner.tsx` | 7-day Pro trial CTA (shown ≤ 7 days from createdAt) |
| `src/components/dashboard/ai-usage-counter.tsx` | `AI: 8/10 ✦` chip; tapping opens upgrade dialog |
| `src/components/dashboard/feature-cards.tsx` | Progressive-disclosure feature card grid |
| `src/components/dashboard/upgrade-dialog.tsx` | Freemium upgrade prompt (monthly / annual options) |
| `src/components/finder/state-category-filters.tsx` | Pre-filled from profile; changeable dropdowns |
| `src/components/finder/gem-deeplink-button.tsx` | "Open on GeM" button using gem-links utility |
| `src/components/finder/ai-summarizer.tsx` | Textarea paste + POST /api/ai/summarize + result display |
| `src/components/finder/save-tender-dialog.tsx` | Modal/sheet: tender name, deadline, category, save |
| `src/components/finder/algolia-search.tsx` | Search input + results list over user's saved tenders |
| `src/app/api/ai/summarize/route.ts` | Server-side Gemini Flash 2.0 call + usage increment |
| `src/app/[locale]/(app)/dashboard/page.tsx` | Dashboard page assembly (modify existing stub) |
| `src/app/[locale]/(app)/find/page.tsx` | Finder page assembly (modify existing stub) |
| `tests/unit/gem-links.test.ts` | Unit tests for GeM deep link builder |
| `tests/unit/tender-firestore.test.ts` | Unit tests for Tender type guards |

### Existing files to modify
| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `Tender`, `TenderStatus`, `PlatformStats` |
| `src/lib/firebase/firestore.ts` | Add tender + stats + AI usage functions |
| `messages/en.json` | Add `dashboard.*` and `finder.*` keys |
| `messages/hi.json` | Add `dashboard.*` and `finder.*` keys in Hindi |
| `messages/bn.json` … `messages/te.json` | Add same keys (9 other languages) |

---

## Chunk 1: Data Layer (Types, Firestore, Hooks, Utilities)

### Task 1: Tender types and PlatformStats

**Files:**
- Modify: `src/lib/types.ts`
- Test: `tests/unit/tender-firestore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/tender-firestore.test.ts
import { describe, it, expect } from 'vitest'
import type { TenderStatus } from '@/lib/types'

describe('TenderStatus values', () => {
  it('active is a valid status', () => {
    const s: TenderStatus = 'active'
    expect(s).toBe('active')
  })
  it('won is a valid status', () => {
    const s: TenderStatus = 'won'
    expect(s).toBe('won')
  })
  it('lost is a valid status', () => {
    const s: TenderStatus = 'lost'
    expect(s).toBe('lost')
  })
  it('expired is a valid status', () => {
    const s: TenderStatus = 'expired'
    expect(s).toBe('expired')
  })
})
```

- [ ] **Step 2: Run test — expect compile error (TenderStatus not defined)**

```bash
cd app && npx vitest run tests/unit/tender-firestore.test.ts
```

Expected: error — `TenderStatus` not found

- [ ] **Step 3: Add types to `src/lib/types.ts`**

Append to the existing file (after the last export):

```typescript
// --- Tender types ---

export type TenderStatus = 'active' | 'won' | 'lost' | 'expired'

export interface Tender {
  id: string                      // Firestore document ID
  userId: string
  name: string
  gemId: string                   // GeM portal tender ID
  category: string
  state: string
  deadline: import('firebase/firestore').Timestamp | null
  status: TenderStatus
  aiSummary: string | null
  gemUrl: string | null
  createdAt: import('firebase/firestore').Timestamp
  updatedAt: import('firebase/firestore').Timestamp
}

export interface PlatformStats {
  vendorCount: number
  tendersFiled: number
  tendersWon: number
  lastUpdatedAt: import('firebase/firestore').Timestamp | null
}

export function isValidTenderStatus(s: unknown): s is TenderStatus {
  return s === 'active' || s === 'won' || s === 'lost' || s === 'expired'
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd app && npx vitest run tests/unit/tender-firestore.test.ts
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts tests/unit/tender-firestore.test.ts
git commit -m "feat(types): add Tender, TenderStatus, PlatformStats types"
```

---

### Task 2: GeM deep-link builder

**Files:**
- Create: `src/lib/gem-links.ts`
- Test: `tests/unit/gem-links.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/gem-links.test.ts
import { describe, it, expect } from 'vitest'
import { buildGemUrl, buildGemSearchUrl } from '@/lib/gem-links'

describe('buildGemUrl', () => {
  it('returns base GeM URL when no filters', () => {
    const url = buildGemUrl({})
    expect(url).toBe('https://bidplus.gem.gov.in/bidlists')
  })

  it('appends state filter', () => {
    const url = buildGemUrl({ state: 'Maharashtra' })
    expect(url).toContain('Maharashtra')
  })

  it('appends category filter', () => {
    const url = buildGemUrl({ category: 'Transport' })
    expect(url).toContain('Transport')
  })

  it('appends both filters', () => {
    const url = buildGemUrl({ state: 'Gujarat', category: 'IT' })
    expect(url).toContain('Gujarat')
    expect(url).toContain('IT')
  })
})

describe('buildGemSearchUrl', () => {
  it('returns url with keyword', () => {
    const url = buildGemSearchUrl('vehicle')
    expect(url).toContain('vehicle')
  })
})
```

- [ ] **Step 2: Run — expect failure (module not found)**

```bash
cd app && npx vitest run tests/unit/gem-links.test.ts
```

- [ ] **Step 3: Implement `src/lib/gem-links.ts`**

```typescript
const GEM_BASE = 'https://bidplus.gem.gov.in/bidlists'

interface GemFilters {
  state?: string
  category?: string
}

/**
 * Builds a GeM BidPlus URL pre-filtered by state and/or category.
 * These are query params that GeM portal accepts for filtering.
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
```

- [ ] **Step 4: Run — expect pass**

```bash
cd app && npx vitest run tests/unit/gem-links.test.ts
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/gem-links.ts tests/unit/gem-links.test.ts
git commit -m "feat(gem-links): add GeM portal deep-link builder"
```

---

### Task 3: Firestore — Tender CRUD + PlatformStats + AI usage

**Files:**
- Modify: `src/lib/firebase/firestore.ts`

> No unit tests for Firestore functions (they hit live Firebase; integration-tested manually). We verify correctness via TypeScript types and the hooks that use them.

- [ ] **Step 1: Add imports and functions to `src/lib/firebase/firestore.ts`**

Add to the existing file (after the `updateLanguage` export):

```typescript
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp,
  collection, query, where, orderBy, onSnapshot, addDoc,
  deleteDoc, increment, QuerySnapshot, DocumentData,
} from 'firebase/firestore'
import type { Tender, TenderStatus, PlatformStats } from '../types'

// ---------- Platform Stats ----------

/** One-time fetch of platformStats/global. Returns null if doc doesn't exist. */
export async function getPlatformStats(): Promise<PlatformStats | null> {
  const snap = await getDoc(doc(db, 'platformStats', 'global'))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    vendorCount: d.vendorCount ?? 0,
    tendersFiled: d.tendersFiled ?? 0,
    tendersWon: d.tendersWon ?? 0,
    lastUpdatedAt: d.lastUpdatedAt ?? null,
  }
}

// ---------- Tenders ----------

/** Saves a new tender document. Returns the new Firestore document ID. */
export async function saveTender(
  uid: string,
  tender: Omit<Tender, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'tenders'), {
    ...tender,
    userId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Real-time listener on the current user's tenders, ordered by deadline asc. */
export function subscribeUserTenders(
  uid: string,
  onData: (tenders: Tender[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'tenders'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      const tenders: Tender[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tender))
      onData(tenders)
    },
    onError
  )
}

/** Deletes a tender by document ID. Caller must verify ownership before calling. */
export async function deleteTender(tenderId: string): Promise<void> {
  await deleteDoc(doc(db, 'tenders', tenderId))
}

/** Updates tender status (e.g. active → won). */
export async function updateTenderStatus(tenderId: string, status: TenderStatus): Promise<void> {
  await updateDoc(doc(db, 'tenders', tenderId), {
    status,
    updatedAt: serverTimestamp(),
  })
}

// ---------- AI Usage ----------

/** Returns current month key in format YYYY-MM. */
export function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export interface AIUsageData { queries: number; bidDocs: number }

/** Fetches AI usage for the current month. Returns zeros if doc doesn't exist. */
export async function getAIUsage(uid: string): Promise<AIUsageData> {
  const snap = await getDoc(doc(db, 'aiUsage', uid, currentMonthKey(), 'data'))
  if (!snap.exists()) return { queries: 0, bidDocs: 0 }
  const d = snap.data()
  return { queries: d.queries ?? 0, bidDocs: d.bidDocs ?? 0 }
}

/**
 * Atomically increments the AI query counter for the current month.
 * Uses Firestore increment() — safe for concurrent writes.
 */
export async function incrementAIQueryCount(uid: string): Promise<void> {
  const ref = doc(db, 'aiUsage', uid, currentMonthKey(), 'data')
  await setDoc(ref, { queries: increment(1) }, { merge: true })
}
```

> **Note:** The Firestore path for aiUsage is `aiUsage/{uid}/{YYYY-MM}/data` (sub-collection with a 'data' document). This matches the schema in `firestore.rules`.

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase/firestore.ts
git commit -m "feat(firestore): add Tender CRUD, platformStats, AI usage tracking"
```

---

### Task 4: React hooks — usePlatformStats, useUserTenders, useAIUsage

**Files:**
- Create: `src/lib/hooks/use-platform-stats.ts`
- Create: `src/lib/hooks/use-user-tenders.ts`
- Create: `src/lib/hooks/use-ai-usage.ts`

> These hooks wrap Firestore calls in `useEffect`. Patterns mirror `useUserProfile` from Subsystem 1. No unit tests (hooks test via integration); verify with TypeScript.

- [ ] **Step 1: Create `src/lib/hooks/use-platform-stats.ts`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { getPlatformStats } from '@/lib/firebase/firestore'
import type { PlatformStats } from '@/lib/types'

export interface UsePlatformStatsResult {
  stats: PlatformStats | null
  loading: boolean
}

/**
 * Fetches platformStats/global once on mount.
 * No real-time listener — stats only update daily, so a single fetch suffices per session.
 */
export function usePlatformStats(): UsePlatformStatsResult {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getPlatformStats()
      .then(data => { if (!cancelled) setStats(data) })
      .catch(() => { if (!cancelled) setStats(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { stats, loading }
}
```

- [ ] **Step 2: Create `src/lib/hooks/use-user-tenders.ts`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { subscribeUserTenders } from '@/lib/firebase/firestore'
import type { Tender } from '@/lib/types'

export interface UseUserTendersResult {
  tenders: Tender[]
  loading: boolean
  error: string | null
}

/**
 * Real-time subscription to the authenticated user's saved tenders.
 * Automatically unsubscribes on unmount or uid change.
 */
export function useUserTenders(uid: string | null): UseUserTendersResult {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setTimeout(() => {
        setTenders([])
        setLoading(false)
        setError(null)
      }, 0)
      return
    }

    setLoading(true)
    const unsub = subscribeUserTenders(
      uid,
      (data) => {
        setTenders(data)
        setLoading(false)
        setError(null)
      },
      (_err) => {
        setError('Tenders load नहीं हुए। फिर try करें।')
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  return { tenders, loading, error }
}
```

- [ ] **Step 3: Create `src/lib/hooks/use-ai-usage.ts`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAIUsage } from '@/lib/firebase/firestore'
import type { AIUsageData } from '@/lib/firebase/firestore'

export interface UseAIUsageResult {
  usage: AIUsageData
  loading: boolean
  refresh: () => void
}

/**
 * Fetches AI usage for current month. Call refresh() after an AI query completes
 * to re-read the updated counter without a full page reload.
 */
export function useAIUsage(uid: string | null): UseAIUsageResult {
  const [usage, setUsage] = useState<AIUsageData>({ queries: 0, bidDocs: 0 })
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(() => {
    if (!uid) {
      setTimeout(() => {
        setUsage({ queries: 0, bidDocs: 0 })
        setLoading(false)
      }, 0)
      return
    }
    setLoading(true)
    getAIUsage(uid)
      .then(data => setUsage(data))
      .catch(() => setUsage({ queries: 0, bidDocs: 0 }))
      .finally(() => setLoading(false))
  }, [uid])

  useEffect(() => { fetch() }, [fetch])

  return { usage, loading, refresh: fetch }
}
```

- [ ] **Step 4: Check TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/use-platform-stats.ts src/lib/hooks/use-user-tenders.ts src/lib/hooks/use-ai-usage.ts
git commit -m "feat(hooks): add usePlatformStats, useUserTenders, useAIUsage"
```

---

## Chunk 2: Dashboard Components

### Task 5: Trust Signal Bar + Trial Banner

**Files:**
- Create: `src/components/dashboard/trust-signal-bar.tsx`
- Create: `src/components/dashboard/trial-banner.tsx`

- [ ] **Step 1: Create `src/components/dashboard/trust-signal-bar.tsx`**

```tsx
'use client'

import { Trophy } from 'lucide-react'
import type { PlatformStats } from '@/lib/types'

interface TrustSignalBarProps {
  stats: PlatformStats | null
}

/** Formats a number with commas: 12400 → "12,400" */
function fmt(n: number): string {
  return n.toLocaleString('en-IN')
}

/**
 * Full-width banner above the fold showing social proof stats.
 * Shows placeholder numbers during loading (avoids layout shift).
 */
export function TrustSignalBar({ stats }: TrustSignalBarProps) {
  const vendorCount  = stats ? fmt(stats.vendorCount)  : '—'
  const tendersFiled = stats ? fmt(stats.tendersFiled) : '—'
  const tendersWon   = stats ? fmt(stats.tendersWon)   : '—'

  return (
    <div className="bg-navy/5 border border-navy/10 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
      <Trophy className="text-gold shrink-0" size={16} />
      <span className="text-navy font-medium">
        {vendorCount}+ vendors
      </span>
      <span className="text-muted">•</span>
      <span className="text-navy font-medium">
        {tendersFiled} tenders filed
      </span>
      <span className="text-muted">•</span>
      <span className="text-navy font-medium">
        {tendersWon} won
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/dashboard/trial-banner.tsx`**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import type { Timestamp } from 'firebase/firestore'

interface TrialBannerProps {
  trialEndsAt: Timestamp | null
  createdAt: Timestamp
  onUpgrade: () => void
}

/**
 * Shows a Pro trial CTA banner for the first 7 days after signup.
 * Hidden after trial period ends (whether converted or expired).
 */
export function TrialBanner({ trialEndsAt, createdAt, onUpgrade }: TrialBannerProps) {
  const t = useTranslations('dashboard')

  const now = Date.now()
  const signupMs = createdAt.toMillis()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  if (now - signupMs > sevenDaysMs) return null
  if (!trialEndsAt) return null

  const daysLeft = Math.max(
    0,
    Math.ceil((trialEndsAt.toMillis() - now) / (24 * 60 * 60 * 1000))
  )

  return (
    <div className="bg-gradient-to-r from-orange/10 to-gold/10 border border-orange/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="font-semibold text-navy text-sm">
          {t('trialBannerTitle', { days: daysLeft })}
        </p>
        <p className="text-muted text-xs mt-0.5">{t('trialBannerSubtitle')}</p>
      </div>
      <Button
        size="sm"
        className="bg-orange text-white hover:bg-orange/90 shrink-0"
        onClick={onUpgrade}
      >
        {t('trialBannerCta')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/trust-signal-bar.tsx src/components/dashboard/trial-banner.tsx
git commit -m "feat(dashboard): add TrustSignalBar and TrialBanner components"
```

---

### Task 6: AI Usage Counter + Upgrade Dialog

**Files:**
- Create: `src/components/dashboard/ai-usage-counter.tsx`
- Create: `src/components/dashboard/upgrade-dialog.tsx`

- [ ] **Step 1: Create `src/components/dashboard/upgrade-dialog.tsx`**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Zap, CheckCircle } from 'lucide-react'

interface UpgradeDialogProps {
  open: boolean
  onClose: () => void
  trigger?: 'ai_limit' | 'tender_limit' | 'feature_gate' | 'trial_cta'
}

const PRO_FEATURES = [
  'Unlimited AI queries',
  'Unlimited tender saves',
  'Bid Document Generator',
  'Document Vault',
  'WhatsApp alerts',
  'Orders Tracker',
  'Priority support',
]

/**
 * Freemium upgrade prompt dialog.
 * Shown when user hits a plan gate or taps the trial CTA.
 */
export function UpgradeDialog({ open, onClose, trigger }: UpgradeDialogProps) {
  const t = useTranslations('planGate')

  const handleUpgrade = (plan: 'monthly' | 'annual') => {
    // Payments integration is Subsystem 9 — for now, link to settings
    window.location.href = '/settings?upgrade=' + plan
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-navy">
            <Zap className="text-orange" size={20} />
            Pro में Upgrade करें
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-2">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-navy">
                <CheckCircle className="text-success shrink-0" size={16} />
                {f}
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleUpgrade('monthly')}
              className="border-2 border-orange rounded-xl p-3 text-center hover:bg-orange/5 transition-colors"
            >
              <div className="font-bold text-navy">{t('upgradeMonthly')}</div>
              <div className="text-xs text-muted mt-0.5">per month</div>
            </button>
            <button
              onClick={() => handleUpgrade('annual')}
              className="border-2 border-gold bg-gold/5 rounded-xl p-3 text-center hover:bg-gold/10 transition-colors relative"
            >
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gold text-white text-xs px-2">
                Best Value
              </Badge>
              <div className="font-bold text-navy">{t('upgradeAnnual')}</div>
              <div className="text-xs text-muted mt-0.5">per year</div>
            </button>
          </div>

          <Button variant="ghost" className="w-full text-muted" onClick={onClose}>
            अभी नहीं
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `src/components/dashboard/ai-usage-counter.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { UpgradeDialog } from './upgrade-dialog'
import type { AIUsageData } from '@/lib/firebase/firestore'

const FREE_LIMIT = 10

interface AIUsageCounterProps {
  usage: AIUsageData
  isPro: boolean
}

/**
 * Compact chip showing AI query usage: "AI: 8/10 ✦"
 * For Pro users, shows "AI: Pro ✦" without a limit.
 * Tapping opens the upgrade dialog (free users only).
 */
export function AIUsageCounter({ usage, isPro }: AIUsageCounterProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const isNearLimit = !isPro && usage.queries >= FREE_LIMIT - 2
  const isAtLimit   = !isPro && usage.queries >= FREE_LIMIT

  if (isPro) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-gold/10 text-gold px-3 py-1.5 rounded-full text-sm font-medium">
        <Sparkles size={14} />
        AI: Pro ✦
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className={[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
          isAtLimit
            ? 'bg-danger/10 text-danger'
            : isNearLimit
              ? 'bg-orange/10 text-orange'
              : 'bg-navy/5 text-navy',
        ].join(' ')}
      >
        <Sparkles size={14} />
        AI: {usage.queries}/{FREE_LIMIT} ✦
      </button>
      <UpgradeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        trigger="ai_limit"
      />
    </>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/ai-usage-counter.tsx src/components/dashboard/upgrade-dialog.tsx
git commit -m "feat(dashboard): add AIUsageCounter and UpgradeDialog components"
```

---

### Task 7: Feature Cards with Progressive Disclosure

**Files:**
- Create: `src/components/dashboard/feature-cards.tsx`

- [ ] **Step 1: Create `src/components/dashboard/feature-cards.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Search, FileText, MessageSquare, Bell, FolderOpen, ShoppingBag, ChevronRight
} from 'lucide-react'
import { Card } from '@/components/ui/card'

interface FeatureCardData {
  key: string
  href: string
  icon: React.ElementType
  color: string          // Tailwind text color class
  bgColor: string        // Tailwind bg color class
  primary: boolean       // shown to new users by default (true = in first 3)
}

const FEATURE_CARDS: FeatureCardData[] = [
  { key: 'find',      href: '/find',      icon: Search,       color: 'text-navy',    bgColor: 'bg-navy/10',    primary: true  },
  { key: 'tenders',   href: '/tenders',   icon: FileText,     color: 'text-orange',  bgColor: 'bg-orange/10',  primary: true  },
  { key: 'bid',       href: '/bid',       icon: MessageSquare,color: 'text-gold',    bgColor: 'bg-gold/10',    primary: true  },
  { key: 'alerts',    href: '/alerts',    icon: Bell,         color: 'text-success', bgColor: 'bg-success/10', primary: false },
  { key: 'documents', href: '/documents', icon: FolderOpen,   color: 'text-navy',    bgColor: 'bg-navy/10',    primary: false },
  { key: 'orders',    href: '/orders',    icon: ShoppingBag,  color: 'text-orange',  bgColor: 'bg-orange/10',  primary: false },
]

interface FeatureCardsProps {
  /** True for users in first 14 days OR with < 3 saved tenders (progressive disclosure). */
  isNewUser: boolean
  locale: string
}

/**
 * Progressive disclosure feature grid.
 * New users see only 3 primary cards + "Discover more →" chip.
 * Returning users see all 6.
 */
export function FeatureCards({ isNewUser, locale }: FeatureCardsProps) {
  const [expanded, setExpanded] = useState(!isNewUser)
  const t = useTranslations('dashboard')
  const navT = useTranslations('nav')

  const visibleCards = expanded
    ? FEATURE_CARDS
    : FEATURE_CARDS.filter(c => c.primary)

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
                <p className="font-semibold text-navy text-sm">{navT(card.key as keyof ReturnType<typeof navT>)}</p>
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/feature-cards.tsx
git commit -m "feat(dashboard): add FeatureCards with progressive disclosure"
```

---

### Task 8: Dashboard page assembly

**Files:**
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`

- [ ] **Step 1: Replace the stub with the full dashboard page**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { usePlatformStats } from '@/lib/hooks/use-platform-stats'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { TrustSignalBar } from '@/components/dashboard/trust-signal-bar'
import { TrialBanner } from '@/components/dashboard/trial-banner'
import { AIUsageCounter } from '@/components/dashboard/ai-usage-counter'
import { FeatureCards } from '@/components/dashboard/feature-cards'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { isPro } from '@/lib/plan-guard'

export default function DashboardPage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'hi'
  const t = useTranslations('dashboard')

  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { stats } = usePlatformStats()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage } = useAIUsage(user?.uid ?? null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  if (!profile) return null

  const userIsPro = isPro(profile)

  // Progressive disclosure: new if < 14 days old OR < 3 saved tenders
  const accountAgeDays = profile.createdAt
    ? Math.floor((Date.now() - profile.createdAt.toMillis()) / 86_400_000)
    : 0
  const isNewUser = accountAgeDays < 14 || tenders.length < 3

  const activeTenders = tenders.filter(t => t.status === 'active')
  const nextDeadline = activeTenders
    .filter(t => t.deadline)
    .sort((a, b) => (a.deadline!.toMillis() - b.deadline!.toMillis()))[0]

  const daysUntilDeadline = nextDeadline?.deadline
    ? Math.ceil((nextDeadline.deadline.toMillis() - Date.now()) / 86_400_000)
    : null

  return (
    <div className="space-y-5 pb-20 desktop:pb-6">
      {/* Social proof */}
      <TrustSignalBar stats={stats} />

      {/* Trial banner (first 7 days only) */}
      {!userIsPro && (
        <TrialBanner
          trialEndsAt={profile.trialEndsAt}
          createdAt={profile.createdAt}
          onUpgrade={() => setUpgradeOpen(true)}
        />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-xl text-navy">
            {t('greeting', { name: profile.name || 'Vendor' })}
          </h1>
          {activeTenders.length > 0 && (
            <p className="text-sm text-muted mt-0.5">
              {t('activeTenders', { count: activeTenders.length })}
              {daysUntilDeadline !== null && (
                <span className={daysUntilDeadline <= 3 ? ' text-danger font-semibold' : ' text-muted'}>
                  {' '}• {t('nextDeadline', { days: daysUntilDeadline })}
                </span>
              )}
            </p>
          )}
        </div>
        <AIUsageCounter usage={usage} isPro={userIsPro} />
      </div>

      {/* Feature cards */}
      <FeatureCards isNewUser={isNewUser} locale={locale} />

      {/* Upgrade dialog */}
      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="trial_cta"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Add dashboard i18n keys to `messages/en.json`**

Add to `en.json` (merge with existing object):

```json
"dashboard": {
  "greeting": "Hello, {name}!",
  "activeTenders": "{count} active tender(s)",
  "nextDeadline": "next deadline in {days} days",
  "trialBannerTitle": "{days} days of Pro trial left!",
  "trialBannerSubtitle": "Upgrade now to keep Pro features after trial.",
  "trialBannerCta": "Upgrade Now",
  "discoverMore": "Discover more →",
  "aiUsageTitle": "AI Queries"
}
```

- [ ] **Step 4: Add dashboard i18n keys to `messages/hi.json`**

Add to `hi.json` (merge):

```json
"dashboard": {
  "greeting": "नमस्ते, {name}!",
  "activeTenders": "{count} active tender(s)",
  "nextDeadline": "अगला deadline {days} दिन में",
  "trialBannerTitle": "Pro trial के {days} दिन बाकी!",
  "trialBannerSubtitle": "Trial खत्म होने से पहले upgrade करें।",
  "trialBannerCta": "Upgrade करें",
  "discoverMore": "और features देखें →",
  "aiUsageTitle": "AI Queries"
}
```

- [ ] **Step 5: Add same keys to the 9 remaining language files (bn, mr, ta, te, gu, kn, pa, or, ml)**

For each file, add the `dashboard` block. Use English text for non-Hindi scripts as a placeholder (proper translations are a content task, not a code task):

```json
"dashboard": {
  "greeting": "Hello, {name}!",
  "activeTenders": "{count} active tender(s)",
  "nextDeadline": "next deadline in {days} days",
  "trialBannerTitle": "{days} days of Pro trial left!",
  "trialBannerSubtitle": "Upgrade now to keep Pro features after trial.",
  "trialBannerCta": "Upgrade Now",
  "discoverMore": "Discover more →",
  "aiUsageTitle": "AI Queries"
}
```

- [ ] **Step 6: Run dev server briefly and navigate to `/hi/dashboard` to verify no crash**

```bash
cd app && npm run dev &
# Open http://localhost:3000/hi/dashboard in browser
# Verify page renders without errors, then kill server
```

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/\(app\)/dashboard/page.tsx messages/
git commit -m "feat(dashboard): assemble full dashboard page with all components"
```

---

## Chunk 3: Tender Finder

### Task 9: Filters + GeM Deep Link components

**Files:**
- Create: `src/components/finder/state-category-filters.tsx`
- Create: `src/components/finder/gem-deeplink-button.tsx`

- [ ] **Step 1: Create `src/components/finder/state-category-filters.tsx`**

```tsx
'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { INDIAN_STATES, GEM_CATEGORIES } from '@/lib/constants'

interface StateFilterProps {
  value: string
  onChange: (state: string) => void
}

export function StateFilter({ value, onChange }: StateFilterProps) {
  return (
    <Select value={value} onValueChange={(v: string | null) => { if (v) onChange(v) }}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="State चुनें" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All States</SelectItem>
        {INDIAN_STATES.map(s => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface CategoryFilterProps {
  selected: string[]
  onChange: (cats: string[]) => void
}

/**
 * Multi-select category chips. Tapping toggles selection.
 * Pre-filled from user profile (passed in as `selected`).
 */
export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const toggle = (cat: string) => {
    onChange(
      selected.includes(cat)
        ? selected.filter(c => c !== cat)
        : [...selected, cat]
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {GEM_CATEGORIES.map(cat => {
        const active = selected.includes(cat)
        return (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            className={[
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors min-h-[36px]',
              active
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-navy border-navy/30 hover:border-navy',
            ].join(' ')}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/finder/gem-deeplink-button.tsx`**

```tsx
'use client'

import { ExternalLink } from 'lucide-react'
import { buildGemUrl } from '@/lib/gem-links'
import { Button } from '@/components/ui/button'

interface GemDeeplinkButtonProps {
  state: string
  categories: string[]
}

/**
 * "Open on GeM" button that builds a deep link pre-filtered by state + first selected category.
 * Opens in new tab (GeM is an external portal).
 */
export function GemDeeplinkButton({ state, categories }: GemDeeplinkButtonProps) {
  const category = categories[0] // GeM URL supports one category filter at a time
  const url = buildGemUrl({
    state: state !== 'all' ? state : undefined,
    category: category || undefined,
  })

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Button className="bg-navy text-white hover:bg-navy/90 flex items-center gap-2 w-full tablet:w-auto">
        <ExternalLink size={16} />
        GeM पर देखें
      </Button>
    </a>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/finder/state-category-filters.tsx src/components/finder/gem-deeplink-button.tsx
git commit -m "feat(finder): add StateFilter, CategoryFilter, and GemDeeplinkButton"
```

---

### Task 10: AI Summarizer API route

**Files:**
- Create: `src/app/api/ai/summarize/route.ts`

> This is the first server-side AI call. Requires `GOOGLE_AI_API_KEY` in `.env.local` and `@google/generative-ai` installed.

- [ ] **Step 1: Install dependency (if not done)**

```bash
cd app && npm install @google/generative-ai
```

- [ ] **Step 2: Create `src/app/api/ai/summarize/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuth } from 'firebase-admin/auth'
import { canUseAI } from '@/lib/plan-guard'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')

const SYSTEM_PROMPT = `You are TenderSarthi, an expert assistant for Indian government tenders on GeM portal.
Summarize the following tender text concisely in the user's preferred language.

Your summary MUST include these sections (use exactly these headings):
**Tender Name:**
**GeM ID:** (if found)
**What is being procured:**
**Estimated Value:**
**Key Dates:** (opening date, closing date, EMD deadline)
**Eligibility:**
**Red Flags:** (anything unusual, strict requirements, very short deadlines)
**Plain Explanation:** (2-3 sentences in simple Hinglish or the requested language — explain it to a first-time vendor)

Be accurate. If information is not in the text, write "Not mentioned".
Do NOT hallucinate values or dates.`

export async function POST(req: NextRequest) {
  try {
    // Auth check via Firebase ID token in Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.slice(7)
    let uid: string
    try {
      const decoded = await getAuth().verifyIdToken(idToken)
      uid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await req.json()
    const { text, language = 'hi' } = body as { text: string; language?: string }

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Tender text too short. कम से कम 50 characters paste करें।' },
        { status: 400 }
      )
    }

    if (text.length > 20_000) {
      return NextResponse.json(
        { error: 'Tender text too long. Maximum 20,000 characters।' },
        { status: 400 }
      )
    }

    // Plan gate: check usage (imported from plan-guard — server-side read from Firestore)
    // NOTE: Full Firestore plan gate enforcement uses Admin SDK — for V1, we trust
    // the client-side plan-guard check. Full enforcement added in Subsystem 9.

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `${SYSTEM_PROMPT}

Respond in language: ${language}

TENDER TEXT:
${text}`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    // NOTE: Usage increment happens client-side after successful response.
    // Full server-side atomic increment added in Subsystem 9 (Payments + Gates).

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('AI summarize error:', err)
    return NextResponse.json(
      { error: 'AI अभी unavailable है। कुछ देर में try करें।' },
      { status: 500 }
    )
  }
}
```

> **Note on Firebase Admin SDK:** The above uses `firebase-admin`. You need to install it and initialize it. Add to `src/lib/firebase/admin.ts`:

```typescript
// src/lib/firebase/admin.ts
import { getApps, initializeApp, cert, App } from 'firebase-admin/app'

let adminApp: App

if (getApps().length === 0) {
  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
} else {
  adminApp = getApps()[0]
}

export { adminApp }
```

> **Add to `.env.local`:**
> ```
> FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account@project.iam.gserviceaccount.com
> FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
> ```
> These come from Firebase Console → Project Settings → Service Accounts → Generate New Private Key.

> **Install firebase-admin:**
> ```bash
> cd app && npm install firebase-admin
> ```

- [ ] **Step 3: Create `src/lib/firebase/admin.ts`** (see above)

- [ ] **Step 4: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors (or only "module not found" for firebase-admin if not installed yet)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/summarize/route.ts src/lib/firebase/admin.ts
git commit -m "feat(api): add POST /api/ai/summarize with Gemini Flash 2.0"
```

---

### Task 11: AI Summarizer component + Save Tender dialog

**Files:**
- Create: `src/components/finder/ai-summarizer.tsx`
- Create: `src/components/finder/save-tender-dialog.tsx`

- [ ] **Step 1: Create `src/components/finder/save-tender-dialog.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GEM_CATEGORIES } from '@/lib/constants'
import { saveTender } from '@/lib/firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { canSaveTenders } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import type { UserProfile } from '@/lib/types'

interface SaveTenderDialogProps {
  open: boolean
  onClose: () => void
  defaultText?: string         // pre-filled from pasted tender text
  aiSummary?: string           // from summarizer
  uid: string
  profile: UserProfile
  currentTenderCount: number
}

/**
 * Modal for saving a tender to My Tenders.
 * Enforces free-tier 5-tender limit with inline upgrade prompt.
 */
export function SaveTenderDialog({
  open, onClose, defaultText, aiSummary, uid, profile, currentTenderCount
}: SaveTenderDialogProps) {
  const t = useTranslations('finder')
  const [name, setName] = useState('')
  const [gemId, setGemId] = useState('')
  const [category, setCategory] = useState(profile.categories[0] ?? '')
  const [state, setState] = useState(profile.state ?? '')
  const [deadlineStr, setDeadlineStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const canSave = canSaveTenders(profile, currentTenderCount)

  const handleSave = async () => {
    if (!canSave) { setUpgradeOpen(true); return }
    if (!name.trim()) return

    setSaving(true)
    try {
      const deadline = deadlineStr
        ? Timestamp.fromDate(new Date(deadlineStr))
        : null

      await saveTender(uid, {
        name: name.trim(),
        gemId: gemId.trim(),
        category,
        state,
        deadline,
        status: 'active',
        aiSummary: aiSummary ?? null,
        gemUrl: gemId.trim()
          ? `https://bidplus.gem.gov.in/bidlists?bid_number=${gemId.trim()}`
          : null,
      })
      onClose()
    } catch {
      // Error shown via toast in production; for now, just log
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">{t('saveTenderTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="tender-name">{t('tenderName')}</Label>
              <Input
                id="tender-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. CRPF Vehicle Rental — Bihar"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gem-id">GeM ID (optional)</Label>
              <Input
                id="gem-id"
                value={gemId}
                onChange={e => setGemId(e.target.value)}
                placeholder="e.g. GEM/2026/B/1234567"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('category')}</Label>
                <Select value={category} onValueChange={(v: string | null) => { if (v) setCategory(v) }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEM_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('deadline')}</Label>
                <Input
                  type="date"
                  value={deadlineStr}
                  onChange={e => setDeadlineStr(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {!canSave && (
              <p className="text-sm text-danger">
                Free plan में {5} tenders save कर सकते हैं। Upgrade करें।
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-navy text-white"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? 'Saving...' : t('saveTender')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="tender_limit"
      />
    </>
  )
}
```

- [ ] **Step 2: Create `src/components/finder/ai-summarizer.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, AlertCircle, Info, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { incrementAIQueryCount } from '@/lib/firebase/firestore'
import { track } from '@/lib/posthog'
import { canUseAI } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { SaveTenderDialog } from './save-tender-dialog'
import type { UserProfile } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'
import { getAuth } from 'firebase/auth'

interface AISummarizerProps {
  uid: string
  profile: UserProfile
  usage: AIUsageData
  onUsageUpdate: () => void
  tenderCount: number
  language: string
}

/**
 * Core Tender Finder AI feature:
 * 1. User pastes tender text into textarea
 * 2. Clicks "Summarize" → calls /api/ai/summarize
 * 3. Result shown with AI disclaimer
 * 4. "Save this tender" button opens SaveTenderDialog
 */
export function AISummarizer({ uid, profile, usage, onUsageUpdate, tenderCount, language }: AISummarizerProps) {
  const t = useTranslations('finder')
  const [text, setText] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const canSummarize = canUseAI(profile, usage)

  const handleSummarize = async () => {
    if (!canSummarize) { setUpgradeOpen(true); return }
    if (text.trim().length < 50) {
      setError('कम से कम 50 characters paste करें।')
      return
    }

    setLoading(true)
    setError(null)
    setSummary(null)

    try {
      const auth = getAuth()
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ text, language }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Unknown error')
      }

      const data = await res.json()
      setSummary(data.summary)

      // Increment usage counter in Firestore + refresh UI counter
      await incrementAIQueryCount(uid)
      onUsageUpdate()

      // PostHog event
      track('ai_summary_generated', { language, textLength: text.length })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-navy mb-2">
          {t('pastePrompt')}
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('pastePlaceholder')}
          rows={6}
          className="w-full rounded-xl border border-navy/20 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
        />
        <p className="text-xs text-muted mt-1">{text.length} / 20,000 chars</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-danger bg-danger/5 rounded-xl p-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <Button
        onClick={handleSummarize}
        disabled={loading || text.trim().length < 50}
        className="bg-navy text-white w-full tablet:w-auto flex items-center gap-2"
      >
        <Sparkles size={16} />
        {loading ? t('summarizing') : t('summarize')}
      </Button>

      {summary && (
        <div className="space-y-3">
          {/* AI output */}
          <div className="bg-navy/5 rounded-xl p-4">
            <pre className="whitespace-pre-wrap text-sm text-navy font-sans leading-relaxed">
              {summary}
            </pre>
          </div>

          {/* Mandatory AI disclaimer */}
          <div className="flex items-start gap-2 text-xs text-muted">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>ℹ️ AI Summary — Always verify on the official GeM portal before bidding.</span>
          </div>

          {/* Save CTA */}
          <Button
            variant="ghost"
            className="border border-navy/20 text-navy flex items-center gap-2"
            onClick={() => setSaveOpen(true)}
          >
            <Save size={16} />
            {t('saveTender')}
          </Button>
        </div>
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="ai_limit"
      />

      {saveOpen && (
        <SaveTenderDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          aiSummary={summary ?? undefined}
          uid={uid}
          profile={profile}
          currentTenderCount={tenderCount}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/finder/
git commit -m "feat(finder): add AISummarizer and SaveTenderDialog components"
```

---

### Task 12: Finder page assembly + i18n

**Files:**
- Modify: `src/app/[locale]/(app)/find/page.tsx`
- Modify: `messages/en.json`, `messages/hi.json` (and other 9 langs)

- [ ] **Step 1: Replace find/page.tsx stub**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { StateFilter, CategoryFilter } from '@/components/finder/state-category-filters'
import { GemDeeplinkButton } from '@/components/finder/gem-deeplink-button'
import { AISummarizer } from '@/components/finder/ai-summarizer'

export default function FindPage() {
  const t = useTranslations('finder')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage, refresh: refreshUsage } = useAIUsage(user?.uid ?? null)

  // Filter state — pre-filled from user profile
  const [selectedState, setSelectedState] = useState<string>(profile?.state ?? 'all')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(profile?.categories ?? [])

  if (!profile || !user) return null

  return (
    <div className="space-y-6 pb-20 desktop:pb-6">
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
        <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-navy uppercase tracking-wide">{t('filtersTitle')}</h2>
        <StateFilter value={selectedState} onChange={setSelectedState} />
        <CategoryFilter selected={selectedCategories} onChange={setSelectedCategories} />
        <GemDeeplinkButton state={selectedState} categories={selectedCategories} />
      </div>

      {/* AI Summarizer */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-navy uppercase tracking-wide">{t('aiTitle')}</h2>
        <AISummarizer
          uid={user.uid}
          profile={profile}
          usage={usage}
          onUsageUpdate={refreshUsage}
          tenderCount={tenders.length}
          language={profile.language}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add finder i18n keys to `messages/en.json`**

```json
"finder": {
  "title": "Find Tenders",
  "subtitle": "Search GeM portal and summarize tenders with AI",
  "filtersTitle": "Filters",
  "aiTitle": "AI Tender Summarizer",
  "pastePrompt": "Paste tender text from GeM portal",
  "pastePlaceholder": "Copy and paste the full tender description here...",
  "summarize": "Summarize with AI",
  "summarizing": "Summarizing...",
  "saveTender": "Save this tender",
  "saveTenderTitle": "Save Tender",
  "tenderName": "Tender Name",
  "category": "Category",
  "deadline": "Deadline",
  "queriesLeft": "{left} AI queries left this month"
}
```

- [ ] **Step 3: Add finder i18n keys to `messages/hi.json`**

```json
"finder": {
  "title": "Tenders खोजें",
  "subtitle": "GeM portal search करें और AI से tender समझें",
  "filtersTitle": "Filters",
  "aiTitle": "AI Tender Summarizer",
  "pastePrompt": "GeM portal से tender text paste करें",
  "pastePlaceholder": "पूरी tender description यहाँ paste करें...",
  "summarize": "AI से समझें",
  "summarizing": "Summary बन रही है...",
  "saveTender": "यह tender save करें",
  "saveTenderTitle": "Tender Save करें",
  "tenderName": "Tender का नाम",
  "category": "Category",
  "deadline": "Deadline",
  "queriesLeft": "इस महीने {left} AI queries बाकी हैं"
}
```

- [ ] **Step 4: Add same keys (English text) to the 9 remaining language files**

Copy English values into bn.json, mr.json, ta.json, te.json, gu.json, kn.json, pa.json, or.json, ml.json.

- [ ] **Step 5: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Run dev server and verify `/hi/find` renders**

```bash
cd app && npm run dev
# Open http://localhost:3000/hi/find
# Verify: filters shown, GeM button visible, summarizer textarea shows
```

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/\(app\)/find/page.tsx messages/
git commit -m "feat(finder): assemble Tender Finder page with filters, GeM links, AI summarizer"
```

---

## Chunk 4: Algolia Search + PostHog Events

### Task 13: Algolia search component (saved tenders)

**Files:**
- Create: `src/components/finder/algolia-search.tsx`

> **Prerequisite:** Algolia App ID + Search-Only API Key in `.env.local`. The Cloud Function that syncs Firestore → Algolia must be deployed separately (see note below).

> **Note on Algolia Cloud Function:** The sync from Firestore tenders collection to Algolia index must be done via a Firebase Cloud Function. The function runs server-side and uses the Algolia Admin Key. This Cloud Function deployment is infrastructure work — not a Next.js code task. The function code should be placed in a `/functions/` directory at the project root and deployed with `firebase deploy --only functions`. The implementation of that Cloud Function is out of scope for this plan; until it's deployed, the Algolia search will return no results even if the UI is ready.

- [ ] **Step 1: Install algoliasearch (if not done)**

```bash
cd app && npm install algoliasearch
```

- [ ] **Step 2: Create `src/components/finder/algolia-search.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import algoliasearch from 'algoliasearch'
import type { Tender } from '@/lib/types'

const APP_ID   = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID   ?? ''
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? ''

const client = APP_ID && SEARCH_KEY ? algoliasearch(APP_ID, SEARCH_KEY) : null
const index  = client ? client.initIndex('tendersarthi_tenders') : null

interface AlgoliaSearchProps {
  uid: string
  onSelectTender?: (tender: Tender) => void
}

/**
 * Searches the user's own saved tenders via Algolia.
 * Filters results by userId to ensure users only see their own tenders.
 * Falls back gracefully when Algolia is not configured.
 */
export function AlgoliaSearch({ uid, onSelectTender }: AlgoliaSearchProps) {
  const t = useTranslations('finder')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Tender[]>([])
  const [isPending, startTransition] = useTransition()

  if (!index) {
    // Algolia not configured — hide the component entirely
    return null
  }

  const handleSearch = (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }

    startTransition(async () => {
      try {
        const { hits } = await index.search<Tender>(q, {
          filters: `userId:${uid}`,
          attributesToRetrieve: ['name', 'gemId', 'category', 'state', 'status', 'deadline'],
          hitsPerPage: 10,
        })
        setResults(hits as unknown as Tender[])
      } catch {
        setResults([])
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <Input
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder={t('searchSavedTenders') ?? 'Search saved tenders...'}
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="border border-navy/10 rounded-xl overflow-hidden">
          {results.map((r, i) => (
            <button
              key={r.id ?? i}
              onClick={() => onSelectTender?.(r)}
              className="w-full text-left px-4 py-3 hover:bg-navy/5 border-b border-navy/5 last:border-0 transition-colors"
            >
              <p className="text-sm font-medium text-navy truncate">{r.name}</p>
              <p className="text-xs text-muted mt-0.5">{r.category} · {r.state}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add `finder.searchSavedTenders` i18n key to en.json and hi.json**

In `en.json` > `finder`: `"searchSavedTenders": "Search your saved tenders"`
In `hi.json` > `finder`: `"searchSavedTenders": "Apne saved tenders search करें"`

- [ ] **Step 4: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/finder/algolia-search.tsx messages/
git commit -m "feat(finder): add AlgoliaSearch component for saved tenders"
```

---

### Task 14: PostHog event tracking

**Files:**
- Modify: `src/lib/posthog.ts` (if needed — check existing `track` export)
- Verify events are fired in the right places (already included in AISummarizer in Task 11)

> Events to add (spec requirement from PRD section 4):
> - `tender_saved` — fired in SaveTenderDialog after successful `saveTender()`
> - `ai_summary_generated` — fired in AISummarizer (already done in Task 11)
> - `upgrade_prompt_seen` — fired when UpgradeDialog opens

- [ ] **Step 1: Add `tender_saved` event to `save-tender-dialog.tsx`**

In `handleSave()`, after `saveTender(uid, ...)` succeeds, add:

```typescript
import { track } from '@/lib/posthog'
// ...
track('tender_saved', { category, state, plan: profile.plan })
```

- [ ] **Step 2: Add `upgrade_prompt_seen` event to `upgrade-dialog.tsx`**

In `UpgradeDialog`, add a `useEffect` that fires when `open` becomes true:

```typescript
import { useEffect } from 'react'
import { track } from '@/lib/posthog'
// inside component:
useEffect(() => {
  if (open) track('upgrade_prompt_seen', { trigger: trigger ?? 'unknown' })
}, [open, trigger])
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 4: Run full test suite**

```bash
cd app && npx vitest run
```

Expected: All 28 existing tests pass + 5 new ones (gem-links + tender-firestore) = 33 total

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/upgrade-dialog.tsx src/components/finder/save-tender-dialog.tsx
git commit -m "feat(analytics): add PostHog events for tender_saved and upgrade_prompt_seen"
```

---

### Task 15: Update Firestore security rules for tenders

**Files:**
- Modify: `app/firestore.rules`

- [ ] **Step 1: Read existing rules and add tenders collection rules**

Append to `firestore.rules`:

```
// Tenders — users own only their own documents
match /tenders/{tenderId} {
  allow read, write: if request.auth != null
    && request.auth.uid == resource.data.userId;
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.userId;
}
```

- [ ] **Step 2: Verify rules syntax**

```bash
firebase firestore:rules validate app/firestore.rules 2>/dev/null || echo "Install firebase CLI first"
```

- [ ] **Step 3: Commit**

```bash
git add app/firestore.rules
git commit -m "feat(firestore): add security rules for tenders collection"
```

---

## Final Verification

- [ ] **Run all tests**

```bash
cd app && npx vitest run
```

Expected: ≥ 33 tests passing (28 from Subsystem 1 + 5 new = 33)

- [ ] **TypeScript clean**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Manual smoke test**

1. Visit `/hi/dashboard` — trust signal bar renders, feature cards show 3 for new user
2. Tap "Discover more →" — remaining 3 cards appear
3. Visit `/hi/find` — state/category filters pre-filled from profile
4. Tap "GeM पर देखें" — opens GeM portal in new tab
5. Paste ≥ 50 chars of tender text → click Summarize → summary appears with disclaimer
6. Click "Save this tender" → fill form → save → toast/close dialog

- [ ] **Update project memory**

Update `/Users/adityaraj0421/.claude/projects/-Users-adityaraj0421-Cool-Projects-Tender/memory/project_tendersarthi.md`:
- Mark Subsystem 2 as ✅ Complete
- Add key decisions: `aiUsage/{uid}/{YYYY-MM}/data` path, Algolia Cloud Function is infra-only, firebase-admin required for API routes

---

## Summary

**15 tasks | ~33 tests | ~20 new files**

Delivers:
- ✅ Dashboard: trust bar, trial banner, AI counter, progressive disclosure, upgrade dialog
- ✅ Tender Finder: state/category filters, GeM deep links, AI summarizer, save tender flow
- ✅ AI API route (`/api/ai/summarize`) — Gemini Flash 2.0, server-side, auth-gated
- ✅ Algolia search component (wired, pending Cloud Function for sync)
- ✅ Freemium gates: free AI limit (10/month), free tender limit (5), upgrade prompts
- ✅ PostHog events: `tender_saved`, `ai_summary_generated`, `upgrade_prompt_seen`
- ✅ i18n: all 11 languages updated (dashboard + finder keys)
- ✅ Firestore rules for tenders collection

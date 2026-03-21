# Subsystem 3 — My Tenders + Deadline Tracker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional My Tenders screen (`/tenders`) listing saved tenders with color-coded deadline urgency, swipe-to-reveal actions, inline status updates, filter chips, and a FAB to add new tenders — all within the free-tier 5-tender cap.

**Architecture:** Pure deadline-utility layer first (fully unit-tested) → TenderCard with swipe gesture (pure React touch events) → TenderFilters for in-memory client-side filtering → page assembly. All data from the existing `useUserTenders` real-time hook. No new Firestore functions needed.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · shadcn/ui · Firebase Firestore (hooks already built) · next-intl v4 · Vitest

---

## What's Reused From Subsystem 2

| What | Where |
|------|-------|
| `useUserTenders(uid)` | `src/lib/hooks/use-user-tenders.ts` |
| `updateTenderStatus`, `deleteTender` | `src/lib/firebase/firestore.ts` |
| `SaveTenderDialog` | `src/components/finder/save-tender-dialog.tsx` |
| `AlgoliaSearch` | `src/components/finder/algolia-search.tsx` |
| `UpgradeDialog` | `src/components/dashboard/upgrade-dialog.tsx` |
| `canSaveTenders` | `src/lib/plan-guard.ts` |
| `Tender`, `TenderStatus` types | `src/lib/types.ts` |

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/lib/deadline-utils.ts` | Pure: `getDeadlineUrgency`, `getDeadlineDaysLeft`, `formatDeadlineLabel` |
| `tests/unit/deadline-utils.test.ts` | 18 unit tests covering all urgency levels and edge cases |
| `src/components/tenders/tender-card.tsx` | Single card: urgency dot, status badge, swipe-to-reveal, desktop menu |
| `src/components/tenders/tender-filters.tsx` | Filter bar + `applyTenderFilters` pure function |
| `src/components/tenders/tender-status-dialog.tsx` | Bottom sheet to update tender status |
| `src/components/tenders/tender-list.tsx` | List container: empty state, free-tier warning, renders cards |
| `src/components/tenders/tender-fab.tsx` | Floating "+ Add Tender" FAB |
| `src/app/[locale]/(app)/tenders/page.tsx` | Page assembly |
| `messages/*.json` (11 files) | Add `tenders.*` namespace |

---

## Chunk 1: Utilities

### Task 1: Deadline utilities and tests

**Files:**
- Create: `src/lib/deadline-utils.ts`
- Create: `tests/unit/deadline-utils.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/deadline-utils.test.ts
import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import {
  getDeadlineUrgency,
  getDeadlineDaysLeft,
  formatDeadlineLabel,
} from '@/lib/deadline-utils'

function daysFromNow(n: number): Timestamp {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return Timestamp.fromDate(d)
}

describe('getDeadlineDaysLeft', () => {
  it('returns null for null deadline', () => {
    expect(getDeadlineDaysLeft(null)).toBeNull()
  })
  it('returns 0 for deadline that is today', () => {
    expect(getDeadlineDaysLeft(daysFromNow(0))).toBe(0)
  })
  it('returns 3 for deadline 3 days away', () => {
    expect(getDeadlineDaysLeft(daysFromNow(3))).toBe(3)
  })
  it('returns 10 for deadline 10 days away', () => {
    expect(getDeadlineDaysLeft(daysFromNow(10))).toBe(10)
  })
  it('returns negative for overdue deadline', () => {
    expect(getDeadlineDaysLeft(daysFromNow(-2))).toBeLessThan(0)
  })
})

describe('getDeadlineUrgency', () => {
  it('returns none for null deadline', () => {
    expect(getDeadlineUrgency(null)).toBe('none')
  })
  it('returns red for overdue', () => {
    expect(getDeadlineUrgency(daysFromNow(-1))).toBe('red')
  })
  it('returns red for 0 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(0))).toBe('red')
  })
  it('returns red for 2 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(2))).toBe('red')
  })
  it('returns amber for 3 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(3))).toBe('amber')
  })
  it('returns amber for 7 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(7))).toBe('amber')
  })
  it('returns green for 8 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(8))).toBe('green')
  })
  it('returns green for 30 days left', () => {
    expect(getDeadlineUrgency(daysFromNow(30))).toBe('green')
  })
})

describe('formatDeadlineLabel', () => {
  it('returns empty string for null', () => {
    expect(formatDeadlineLabel(null)).toBe('')
  })
  it('returns Today for 0 days', () => {
    expect(formatDeadlineLabel(daysFromNow(0))).toBe('Today')
  })
  it('returns Tomorrow for 1 day', () => {
    expect(formatDeadlineLabel(daysFromNow(1))).toBe('Tomorrow')
  })
  it('returns X days left for > 1 day', () => {
    expect(formatDeadlineLabel(daysFromNow(5))).toBe('5 days left')
  })
  it('returns Overdue for past deadline', () => {
    expect(formatDeadlineLabel(daysFromNow(-3))).toBe('Overdue')
  })
})
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
cd app && npx vitest run tests/unit/deadline-utils.test.ts
```

- [ ] **Step 3: Implement `src/lib/deadline-utils.ts`**

```typescript
import type { Timestamp } from 'firebase/firestore'

export type DeadlineUrgency = 'red' | 'amber' | 'green' | 'none'

/** How many whole days until the deadline. Negative = overdue. Null = no deadline. */
export function getDeadlineDaysLeft(deadline: Timestamp | null): number | null {
  if (!deadline) return null
  const msLeft = deadline.toMillis() - Date.now()
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24))
}

/**
 * Color urgency per PRD 7.3:
 *   red   = < 3 days (including overdue)
 *   amber = 3-7 days
 *   green = > 7 days
 *   none  = no deadline
 */
export function getDeadlineUrgency(deadline: Timestamp | null): DeadlineUrgency {
  const days = getDeadlineDaysLeft(deadline)
  if (days === null) return 'none'
  if (days < 3)  return 'red'
  if (days <= 7) return 'amber'
  return 'green'
}

/** Human-readable label for deadline badge. */
export function formatDeadlineLabel(deadline: Timestamp | null): string {
  const days = getDeadlineDaysLeft(deadline)
  if (days === null) return ''
  if (days < 0)   return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days left`
}
```

- [ ] **Step 4: Run tests — expect 18 passed**

```bash
cd app && npx vitest run tests/unit/deadline-utils.test.ts
```

- [ ] **Step 5: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/deadline-utils.ts tests/unit/deadline-utils.test.ts
git commit -m "feat(deadline): add deadline urgency utilities with 18 tests"
```

---

## Chunk 2: Tender Components

### Task 2: TenderCard with swipe-to-reveal actions

**Files:**
- Create: `src/components/tenders/tender-card.tsx`

- [ ] **Step 1: Create `src/components/tenders/tender-card.tsx`**

```tsx
'use client'

import { useState, useRef } from 'react'
import { MoreHorizontal, Trophy, XCircle, Archive, ExternalLink } from 'lucide-react'
import { getDeadlineUrgency, formatDeadlineLabel } from '@/lib/deadline-utils'
import { updateTenderStatus, deleteTender } from '@/lib/firebase/firestore'
import type { Tender, TenderStatus } from '@/lib/types'

interface TenderCardProps {
  tender: Tender
}

const STATUS_CONFIG: Record<TenderStatus, { label: string; className: string }> = {
  active:  { label: 'Active',  className: 'bg-navy/10 text-navy' },
  won:     { label: 'Won',     className: 'bg-success/10 text-success' },
  lost:    { label: 'Lost',    className: 'bg-danger/10 text-danger' },
  expired: { label: 'Expired', className: 'bg-muted/20 text-muted' },
}

const URGENCY_DOT: Record<string, string> = {
  red:   'bg-danger',
  amber: 'bg-orange',
  green: 'bg-success',
  none:  '',
}

const URGENCY_TEXT: Record<string, string> = {
  red:   'text-danger',
  amber: 'text-orange',
  green: 'text-success',
  none:  'text-muted',
}

const SWIPE_THRESHOLD = 80
const SWIPE_REVEAL    = 168

export function TenderCard({ tender }: TenderCardProps) {
  const [swipeX, setSwipeX]     = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy]         = useState(false)
  const startXRef               = useRef<number>(0)
  const dragging                = useRef(false)

  const urgency        = getDeadlineUrgency(tender.deadline)
  const deadlineLabel  = formatDeadlineLabel(tender.deadline)
  const statusCfg      = STATUS_CONFIG[tender.status]

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    dragging.current  = true
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const delta = startXRef.current - e.touches[0].clientX
    if (delta > 0) setSwipeX(Math.min(delta, SWIPE_REVEAL))
  }
  const handleTouchEnd = () => {
    dragging.current = false
    if (swipeX >= SWIPE_THRESHOLD) { setSwipeX(SWIPE_REVEAL); setRevealed(true) }
    else { setSwipeX(0); setRevealed(false) }
  }
  const closeSwipe = () => { setSwipeX(0); setRevealed(false) }

  const doStatus = async (status: TenderStatus) => {
    setBusy(true)
    try { await updateTenderStatus(tender.id, status) } catch { /* hook reconciles */ }
    finally { setBusy(false); closeSwipe(); setMenuOpen(false) }
  }
  const doDelete = async () => {
    if (!confirm('इस tender को delete करें?')) return
    setBusy(true)
    try { await deleteTender(tender.id) } catch { /* silent */ }
    finally { setBusy(false); closeSwipe(); setMenuOpen(false) }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action panel behind card */}
      <div className="absolute right-0 top-0 bottom-0 flex" style={{ width: SWIPE_REVEAL }}>
        <button onClick={() => doStatus('won')}  disabled={busy} className="flex-1 h-full flex flex-col items-center justify-center gap-1 bg-success text-white text-xs font-medium">
          <Trophy size={16} /> Won
        </button>
        <button onClick={() => doStatus('lost')} disabled={busy} className="flex-1 h-full flex flex-col items-center justify-center gap-1 bg-danger text-white text-xs font-medium">
          <XCircle size={16} /> Lost
        </button>
        <button onClick={doDelete}               disabled={busy} className="flex-1 h-full flex flex-col items-center justify-center gap-1 bg-navy/20 text-navy text-xs font-medium">
          <Archive size={16} /> Delete
        </button>
      </div>

      {/* Main card */}
      <div
        className="relative bg-white border border-navy/10 rounded-xl p-4 transition-transform duration-150"
        style={{ transform: `translateX(-${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={revealed ? closeSwipe : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {urgency !== 'none' && (
              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${URGENCY_DOT[urgency]}`} />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-navy text-sm leading-snug truncate">{tender.name}</p>
              <p className="text-xs text-muted mt-0.5">{tender.category} · {tender.state}</p>
              {tender.gemId && <p className="text-xs text-muted/60 mt-0.5 font-mono">{tender.gemId}</p>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
            {deadlineLabel && (
              <span className={`text-xs font-medium ${URGENCY_TEXT[urgency]}`}>{deadlineLabel}</span>
            )}

            {/* Desktop context menu */}
            <div className="hidden desktop:block relative">
              <button onClick={() => setMenuOpen(v => !v)} className="p-1 text-muted hover:text-navy rounded">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-6 bg-white border border-navy/10 rounded-xl shadow-lg z-10 w-40 overflow-hidden">
                  {(['won','lost','expired'] as TenderStatus[]).map(s => (
                    <button key={s} onClick={() => doStatus(s)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy/5 capitalize">
                      Mark {s}
                    </button>
                  ))}
                  {tender.gemUrl && (
                    <a href={tender.gemUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-navy/5 border-t border-navy/5 text-navy">
                      <ExternalLink size={14} /> Open on GeM
                    </a>
                  )}
                  <button onClick={doDelete} className="w-full text-left px-4 py-2.5 text-sm hover:bg-danger/5 text-danger border-t border-navy/5">
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check — expect 0 errors**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tenders/tender-card.tsx
git commit -m "feat(tenders): add TenderCard with swipe-to-reveal actions"
```

---

### Task 3: TenderFilters component

**Files:**
- Create: `src/components/tenders/tender-filters.tsx`

- [ ] **Step 1: Create `src/components/tenders/tender-filters.tsx`**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import type { TenderStatus, Tender } from '@/lib/types'

export interface TenderFilterState {
  status: TenderStatus | 'all'
  category: string
  state: string
}

export const DEFAULT_FILTERS: TenderFilterState = { status: 'all', category: '', state: '' }

interface TenderFiltersProps {
  filters: TenderFilterState
  onChange: (f: TenderFilterState) => void
  availableCategories: string[]
  availableStates: string[]
}

const STATUS_OPTIONS: { value: TenderStatus | 'all'; label: string }[] = [
  { value: 'all',     label: 'All'     },
  { value: 'active',  label: 'Active'  },
  { value: 'won',     label: 'Won'     },
  { value: 'lost',    label: 'Lost'    },
  { value: 'expired', label: 'Expired' },
]

export function TenderFilters({ filters, onChange, availableCategories, availableStates }: TenderFiltersProps) {
  const t = useTranslations('tenders')
  const isFiltered = filters.status !== 'all' || filters.category !== '' || filters.state !== ''

  return (
    <div className="space-y-2">
      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, status: opt.value })}
            className={[
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              filters.status === opt.value
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-navy border-navy/20 hover:border-navy',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Category/state selects + clear */}
      {(availableCategories.length > 1 || availableStates.length > 1 || isFiltered) && (
        <div className="flex gap-2 flex-wrap items-center">
          {availableCategories.length > 1 && (
            <select
              value={filters.category}
              onChange={e => onChange({ ...filters, category: e.target.value })}
              className="text-sm border border-navy/20 rounded-lg px-2 py-1.5 text-navy bg-white"
            >
              <option value="">{t('allCategories')}</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {availableStates.length > 1 && (
            <select
              value={filters.state}
              onChange={e => onChange({ ...filters, state: e.target.value })}
              className="text-sm border border-navy/20 rounded-lg px-2 py-1.5 text-navy bg-white"
            >
              <option value="">{t('allStates')}</option>
              {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {isFiltered && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="flex items-center gap-1 text-sm text-muted hover:text-navy"
            >
              <X size={14} />{t('clearFilters')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Pure filter function — apply filter state to a tender array. */
export function applyTenderFilters(tenders: Tender[], filters: TenderFilterState): Tender[] {
  return tenders.filter(tender => {
    if (filters.status !== 'all' && tender.status !== filters.status) return false
    if (filters.category && tender.category !== filters.category) return false
    if (filters.state && tender.state !== filters.state) return false
    return true
  })
}
```

- [ ] **Step 2: TypeScript check — expect 0 errors**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tenders/tender-filters.tsx
git commit -m "feat(tenders): add TenderFilters with status/category/state chips"
```

---

### Task 4: TenderStatusDialog + TenderList

**Files:**
- Create: `src/components/tenders/tender-status-dialog.tsx`
- Create: `src/components/tenders/tender-list.tsx`

- [ ] **Step 1: Create `src/components/tenders/tender-status-dialog.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Trophy, XCircle, Archive, RefreshCw } from 'lucide-react'
import { updateTenderStatus } from '@/lib/firebase/firestore'
import type { Tender, TenderStatus } from '@/lib/types'

interface TenderStatusDialogProps {
  tender: Tender | null
  onClose: () => void
}

const OPTIONS: { value: TenderStatus; label: string; Icon: React.ElementType; cls: string }[] = [
  { value: 'active',  label: 'Mark Active',  Icon: RefreshCw, cls: 'text-navy'    },
  { value: 'won',     label: 'Mark Won',     Icon: Trophy,    cls: 'text-success'  },
  { value: 'lost',    label: 'Mark Lost',    Icon: XCircle,   cls: 'text-danger'   },
  { value: 'expired', label: 'Mark Expired', Icon: Archive,   cls: 'text-muted'    },
]

export function TenderStatusDialog({ tender, onClose }: TenderStatusDialogProps) {
  const t = useTranslations('tenders')
  const [busy, setBusy] = useState(false)

  const handleSelect = async (status: TenderStatus) => {
    if (!tender) return
    setBusy(true)
    try { await updateTenderStatus(tender.id, status) } catch { /* hook reconciles */ }
    finally { setBusy(false); onClose() }
  }

  return (
    <Sheet open={!!tender} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-navy text-left text-base">{tender?.name ?? ''}</SheetTitle>
          <p className="text-sm text-muted text-left">{t('updateStatus')}</p>
        </SheetHeader>
        <div className="space-y-2">
          {OPTIONS.filter(o => o.value !== tender?.status).map(({ value, label, Icon, cls }) => (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={busy}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-navy/10 hover:bg-navy/5 transition-colors ${cls}`}
            >
              <Icon size={18} />
              <span className="font-medium text-sm">{label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Create `src/components/tenders/tender-list.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText } from 'lucide-react'
import { TenderCard } from './tender-card'
import { TenderStatusDialog } from './tender-status-dialog'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import type { Tender } from '@/lib/types'

const FREE_LIMIT = 5

interface TenderListProps {
  tenders: Tender[]
  totalCount: number
  isPro: boolean
}

export function TenderList({ tenders, totalCount, isPro }: TenderListProps) {
  const t = useTranslations('tenders')
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const showWarning = !isPro && totalCount >= FREE_LIMIT - 1

  if (tenders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-navy/5 rounded-2xl flex items-center justify-center mb-4">
          <FileText className="text-navy/30" size={28} />
        </div>
        <p className="font-semibold text-navy">{t('emptyTitle')}</p>
        <p className="text-sm text-muted mt-1 max-w-xs">{t('emptySubtitle')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showWarning && (
        <div className="bg-orange/5 border border-orange/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-orange">
            {t('limitWarning', { used: totalCount, limit: FREE_LIMIT })}
          </p>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="text-sm font-semibold text-orange underline shrink-0"
          >
            {t('upgrade')}
          </button>
        </div>
      )}

      {tenders.map(tender => (
        <TenderCard key={tender.id} tender={tender} />
      ))}

      <TenderStatusDialog tender={selectedTender} onClose={() => setSelectedTender(null)} />
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="tender_limit" />
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check — expect 0 errors**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tenders/tender-status-dialog.tsx src/components/tenders/tender-list.tsx
git commit -m "feat(tenders): add TenderStatusDialog and TenderList components"
```

---

## Chunk 3: Page Assembly

### Task 5: TenderFab + i18n + page

**Files:**
- Create: `src/components/tenders/tender-fab.tsx`
- Modify: `src/app/[locale]/(app)/tenders/page.tsx`
- Modify: `messages/*.json` (all 11 locale files)

- [ ] **Step 1: Create `src/components/tenders/tender-fab.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SaveTenderDialog } from '@/components/finder/save-tender-dialog'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { canSaveTenders } from '@/lib/plan-guard'
import type { UserProfile } from '@/lib/types'

interface TenderFabProps {
  uid: string
  profile: UserProfile
  currentTenderCount: number
}

/** Floating action button fixed bottom-right. Mobile: above bottom nav (bottom-24). Desktop: bottom-6. */
export function TenderFab({ uid, profile, currentTenderCount }: TenderFabProps) {
  const [saveOpen, setSaveOpen]       = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const handleTap = () => {
    if (!canSaveTenders(profile, currentTenderCount)) { setUpgradeOpen(true); return }
    setSaveOpen(true)
  }

  return (
    <>
      <button
        onClick={handleTap}
        aria-label="Add tender"
        className="fixed bottom-24 right-4 desktop:bottom-6 desktop:right-6 z-50 w-14 h-14 bg-orange text-white rounded-full shadow-lg flex items-center justify-center hover:bg-orange/90 active:scale-95 transition-all"
      >
        <Plus size={24} />
      </button>

      <SaveTenderDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        uid={uid}
        profile={profile}
        currentTenderCount={currentTenderCount}
      />

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="tender_limit"
      />
    </>
  )
}
```

- [ ] **Step 2: Add `tenders` keys to `messages/en.json`**

Merge into the existing JSON object:

```json
"tenders": {
  "title": "My Tenders",
  "subtitle": "Track your saved tenders and deadlines",
  "emptyTitle": "No tenders yet",
  "emptySubtitle": "Use the + button or Find Tenders to save your first tender.",
  "updateStatus": "Update status",
  "allCategories": "All Categories",
  "allStates": "All States",
  "clearFilters": "Clear filters",
  "limitWarning": "{used}/{limit} tenders used — upgrade for unlimited",
  "upgrade": "Upgrade"
}
```

- [ ] **Step 3: Add `tenders` keys to `messages/hi.json`**

```json
"tenders": {
  "title": "मेरे Tenders",
  "subtitle": "Saved tenders और deadlines track करें",
  "emptyTitle": "अभी कोई tender नहीं है",
  "emptySubtitle": "+ button या Find Tenders से पहला tender save करें।",
  "updateStatus": "Status update करें",
  "allCategories": "सभी Categories",
  "allStates": "सभी States",
  "clearFilters": "Filters हटाएं",
  "limitWarning": "{used}/{limit} tenders use हुए — unlimited के लिए upgrade करें",
  "upgrade": "Upgrade करें"
}
```

- [ ] **Step 4: Add English `tenders` keys to remaining 9 locale files**

Files: `bn.json`, `mr.json`, `ta.json`, `te.json`, `gu.json`, `kn.json`, `pa.json`, `or.json`, `ml.json`. Use English values from Step 2.

- [ ] **Step 5: Replace `src/app/[locale]/(app)/tenders/page.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { AlgoliaSearch } from '@/components/finder/algolia-search'
import { TenderFilters, applyTenderFilters, DEFAULT_FILTERS } from '@/components/tenders/tender-filters'
import { TenderList } from '@/components/tenders/tender-list'
import { TenderFab } from '@/components/tenders/tender-fab'
import { isPro } from '@/lib/plan-guard'
import type { TenderFilterState } from '@/components/tenders/tender-filters'

export default function TendersPage() {
  const t = useTranslations('tenders')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders, loading } = useUserTenders(user?.uid ?? null)
  const [filters, setFilters] = useState<TenderFilterState>(DEFAULT_FILTERS)

  if (!profile || !user) return null

  const userIsPro = isPro(profile)

  const availableCategories = useMemo(
    () => [...new Set(tenders.map(tender => tender.category).filter(Boolean))].sort(),
    [tenders]
  )
  const availableStates = useMemo(
    () => [...new Set(tenders.map(tender => tender.state).filter(Boolean))].sort(),
    [tenders]
  )
  const filteredTenders = useMemo(
    () => applyTenderFilters(tenders, filters),
    [tenders, filters]
  )

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('subtitle')}</p>
      </div>

      <AlgoliaSearch uid={user.uid} />

      {tenders.length > 0 && (
        <TenderFilters
          filters={filters}
          onChange={setFilters}
          availableCategories={availableCategories}
          availableStates={availableStates}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-navy/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <TenderList
          tenders={filteredTenders}
          totalCount={tenders.length}
          isPro={userIsPro}
        />
      )}

      <TenderFab uid={user.uid} profile={profile} currentTenderCount={tenders.length} />
    </div>
  )
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Run full test suite**

```bash
cd app && npx vitest run
```

Expected: 55 tests passing (37 + 18 new).

- [ ] **Step 8: Commit**

```bash
git add src/components/tenders/tender-fab.tsx \
        src/app/[locale]/\(app\)/tenders/page.tsx \
        messages/
git commit -m "feat(tenders): assemble My Tenders page with FAB, filters, deadline tracker"
```

---

## Final Verification

- [ ] **All 55 tests pass:** `cd app && npx vitest run`
- [ ] **TypeScript clean:** `cd app && npx tsc --noEmit`
- [ ] **Update project memory:** Mark Subsystem 3 complete in `project_tendersarthi.md`

---

## Summary

**5 tasks | 55 tests | 8 new files**

- deadline utilities (18 unit tests)
- TenderCard with swipe-to-reveal + desktop context menu
- TenderFilters with status/category/state chips + `applyTenderFilters` pure fn
- TenderStatusDialog bottom sheet
- TenderList with empty state + free-tier limit warning
- TenderFab floating action button
- `/tenders` page assembled with Algolia search, filters, skeleton loading, FAB
- i18n: 11 languages updated with `tenders.*`

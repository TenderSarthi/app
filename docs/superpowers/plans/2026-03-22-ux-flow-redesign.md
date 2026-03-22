# UX Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken "More → Settings" mobile nav with a proper Menu sheet, add an adaptive getting-started / active-dashboard view, and de-clutter the Find page.

**Architecture:** Four independent layers committed in sequence: (1) i18n keys across all 11 locale files, (2) `dashboard-utils.ts` pure helpers + tests, (3) `MenuSheet` + `BottomNav` + `AppLayout` changes, (4) new dashboard sub-components + `dashboard/page.tsx` rewrite, (5) `CategoryFilter` maxVisible + `find/page.tsx` cleanup.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, next-intl, Tailwind CSS, Base UI (`@base-ui/react/dialog` via `@/components/ui/sheet`), lucide-react, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-03-22-ux-flow-redesign.md`

---

## Chunk 1: i18n Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/hi.json`
- Modify: `messages/bn.json`, `messages/gu.json`, `messages/kn.json`, `messages/ml.json`, `messages/mr.json`, `messages/or.json`, `messages/pa.json`, `messages/ta.json`, `messages/te.json`

---

### Task 1: Add new keys to `en.json`

Open `messages/en.json`. Find the `"nav"` object and add one key. Find the `"dashboard"` object and add 14 new keys.

- [ ] **Step 1: Add `nav.menu` to `en.json`**

In `messages/en.json`, inside the top-level `"nav"` object (which already has `dashboard`, `find`, `tenders`, `bid`, `more`), add:

```json
"menu": "Menu"
```

- [ ] **Step 2: Add new `dashboard.*` keys to `en.json`**

In `messages/en.json`, inside the top-level `"dashboard"` object (which already has `greeting`, `activeTenders`, `nextDeadline`), add these keys at the end of the object:

```json
"gettingStartedTitle": "शुरू करें",
"step1Done": "Account बना लिया",
"step2": "पहला Tender खोजें",
"step2Sub": "Live tenders में अपनी category search करें",
"step3": "AI से Bid बनाएं",
"step3Sub": "Tender save करने के बाद unlock होगा",
"tipLabel": "💡 Tip",
"tipBody": "{category} category में सबसे ज़्यादा tenders आते हैं — {state} में। Find tab से शुरू करें।",
"quickActions": "Quick Actions",
"statsActive": "Active",
"statsWon": "Won",
"statsBids": "Bids Sent",
"noActiveTenders": "No active tenders",
"findNewTender": "Find a new tender →",
"nextDeadlineLabel": "Next Deadline",
"latestActiveLabel": "Latest Active"
```

---

### Task 2: Add translated keys to `hi.json`

- [ ] **Step 1: Add `nav.menu` and `dashboard.*` keys to `hi.json`**

In `messages/hi.json`, inside the existing `"nav"` object add:
```json
"menu": "Menu"
```

Inside the existing `"dashboard"` object add all 14 keys:
```json
"gettingStartedTitle": "शुरू करें",
"step1Done": "Account बना लिया",
"step2": "पहला Tender खोजें",
"step2Sub": "Live tenders में अपनी category search करें",
"step3": "AI से Bid बनाएं",
"step3Sub": "Tender save करने के बाद unlock होगा",
"tipLabel": "💡 Tip",
"tipBody": "{category} category में सबसे ज़्यादा tenders आते हैं — {state} में। Find tab से शुरू करें।",
"quickActions": "Quick Actions",
"statsActive": "Active",
"statsWon": "जीते",
"statsBids": "Bids भेजे",
"noActiveTenders": "कोई active tender नहीं",
"findNewTender": "नया Tender खोजें →",
"nextDeadlineLabel": "Next Deadline",
"latestActiveLabel": "Latest Active"
```

---

### Task 3: Add keys to the remaining 9 locale files

The remaining 9 locales (`bn`, `gu`, `kn`, `ml`, `mr`, `or`, `pa`, `ta`, `te`) use English strings as fallback. All 9 files already have `"nav"` and `"dashboard"` objects (confirmed). Add the following keys to each file.

- [ ] **Step 1: In each of the 9 locale files, add inside the existing `"nav"` object:**

```json
"menu": "Menu"
```

- [ ] **Step 2: In each of the 9 locale files, add inside the existing `"dashboard"` object:**

```json
"gettingStartedTitle": "शुरू करें",
"step1Done": "Account बना लिया",
"step2": "पहला Tender खोजें",
"step2Sub": "Live tenders में अपनी category search करें",
"step3": "AI से Bid बनाएं",
"step3Sub": "Tender save करने के बाद unlock होगा",
"tipLabel": "💡 Tip",
"tipBody": "{category} category में सबसे ज़्यादा tenders आते हैं — {state} में। Find tab से शुरू करें।",
"quickActions": "Quick Actions",
"statsActive": "Active",
"statsWon": "Won",
"statsBids": "Bids Sent",
"noActiveTenders": "No active tenders",
"findNewTender": "Find a new tender →",
"nextDeadlineLabel": "Next Deadline",
"latestActiveLabel": "Latest Active"
```

---

### Task 4: Verify i18n and commit

- [ ] **Step 1: Validate JSON syntax for all 11 files**

Run from the `app/` directory (do not `cd` anywhere first):

```bash
for f in messages/*.json; do python3 -c "import json,sys; json.load(open('$f'))" && echo "$f OK" || echo "$f BROKEN"; done && echo "---" && ls messages/*.json | wc -l | xargs -I{} echo "{} files found (expect 11)"
```

Expected: All 11 files print `OK`, final line prints `11 files found`.

- [ ] **Step 2: Commit**

```bash
git add messages/
git commit -m "feat: add nav.menu and dashboard.* i18n keys to all 11 locales"
```

---

## Chunk 2: Dashboard Utility Helpers (TDD)

Extracting two pure functions makes the business logic independently testable and reusable across components.

**Files:**
- Create: `src/lib/dashboard-utils.ts`
- Create: `tests/unit/dashboard-utils.test.ts`

---

### Task 5: Write failing tests first

- [ ] **Step 1: Create `tests/unit/dashboard-utils.test.ts`**

```typescript
// tests/unit/dashboard-utils.test.ts
import { describe, it, expect } from 'vitest'
import { getPlanBadge, deriveDeadlineInfo } from '@/lib/dashboard-utils'
import type { UserProfile, Tender } from '@/lib/types'
import type { Timestamp } from 'firebase/firestore'

// Minimal Timestamp mock — only toMillis() is used by our helpers
function ts(ms: number): Timestamp {
  return { toMillis: () => ms } as unknown as Timestamp
}

const baseProfile: UserProfile = {
  uid: 'u1',
  name: 'Test User',
  businessName: '',
  phone: null,
  email: null,
  gstin: null,
  udyamNumber: null,
  state: 'Maharashtra',
  categories: ['Transport & Vehicles'],
  language: 'hi',
  plan: 'free',
  trialUsed: false,
  trialEndsAt: null,
  proSince: null,
  proRenewsAt: null,
  razorpayCustomerId: null,
  razorpaySubscriptionId: null,
  experienceYears: null,
  fcmToken: null,
  notificationsDeclined: false,
  scheduledDowngradeAt: null,
  deletionRequested: false,
  deletionRequestedAt: null,
  createdAt: ts(0),
  lastActiveAt: null,
}

const baseTender: Tender = {
  id: 't1',
  userId: 'u1',
  name: 'Test Tender',
  gemId: '',
  category: 'Transport & Vehicles',
  state: 'Maharashtra',
  deadline: null,
  status: 'active',
  aiSummary: null,
  gemUrl: null,
  createdAt: ts(1_000),
  updatedAt: ts(1_000),
}

// ─── getPlanBadge ─────────────────────────────────────────────────────────────

describe('getPlanBadge', () => {
  it('returns "Pro" for a pro plan user', () => {
    expect(getPlanBadge({ ...baseProfile, plan: 'pro' })).toBe('Pro')
  })

  it('returns "Free" when on free plan with no trial', () => {
    expect(getPlanBadge({ ...baseProfile, plan: 'free', trialEndsAt: null })).toBe('Free')
  })

  it('returns "Pro Trial · N days left" when trial is active', () => {
    const futureMs = Date.now() + 3 * 86_400_000 // 3 days from now
    const result = getPlanBadge({ ...baseProfile, plan: 'free', trialEndsAt: ts(futureMs) })
    expect(result).toBe('Pro Trial · 3 days left')
  })

  it('returns "Free" when trial timestamp is in the past', () => {
    const pastMs = Date.now() - 86_400_000 // 1 day ago
    const result = getPlanBadge({ ...baseProfile, plan: 'free', trialEndsAt: ts(pastMs) })
    expect(result).toBe('Free')
  })
})

// ─── deriveDeadlineInfo ───────────────────────────────────────────────────────

describe('deriveDeadlineInfo', () => {
  it('returns undefined nextDeadlineTender and null daysUntilDeadline when no tenders have deadlines', () => {
    const { nextDeadlineTender, daysUntilDeadline } = deriveDeadlineInfo([baseTender])
    expect(nextDeadlineTender).toBeUndefined()
    expect(daysUntilDeadline).toBeNull()
  })

  it('returns the most recently created tender as fallback when no deadlines', () => {
    const t1 = { ...baseTender, id: 't1', createdAt: ts(1_000) }
    const t2 = { ...baseTender, id: 't2', createdAt: ts(5_000) }
    const { fallbackTender } = deriveDeadlineInfo([t1, t2])
    expect(fallbackTender?.id).toBe('t2')
  })

  it('picks the earliest deadline from multiple tenders with deadlines', () => {
    const t1 = { ...baseTender, id: 't1', deadline: ts(3_000) }
    const t2 = { ...baseTender, id: 't2', deadline: ts(1_000) }
    const { nextDeadlineTender } = deriveDeadlineInfo([t1, t2])
    expect(nextDeadlineTender?.id).toBe('t2')
  })

  it('does not mutate the input array when deriving fallback', () => {
    const tenders = [baseTender, { ...baseTender, id: 't2', createdAt: ts(5_000) }]
    const original = [...tenders]
    deriveDeadlineInfo(tenders)
    expect(tenders).toEqual(original) // no mutation
  })

  it('returns all undefined/null for empty list', () => {
    const { nextDeadlineTender, fallbackTender, daysUntilDeadline } = deriveDeadlineInfo([])
    expect(nextDeadlineTender).toBeUndefined()
    expect(fallbackTender).toBeUndefined()
    expect(daysUntilDeadline).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail (module not found)**

```bash
npx vitest run tests/unit/dashboard-utils.test.ts
```

Expected: Test runner fails with a module-not-found resolution error for `@/lib/dashboard-utils`.

---

### Task 6: Create `src/lib/dashboard-utils.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/dashboard-utils.ts
import type { Timestamp } from 'firebase/firestore'
import type { UserProfile, Tender } from '@/lib/types'

/**
 * Returns the user-facing plan badge text for the MenuSheet user strip.
 * Priority: pro > active trial > free.
 */
export function getPlanBadge(profile: UserProfile): string {
  if (profile.plan === 'pro') return 'Pro'
  if (profile.trialEndsAt && profile.trialEndsAt.toMillis() > Date.now()) {
    const daysLeft = Math.ceil(
      (profile.trialEndsAt.toMillis() - Date.now()) / 86_400_000
    )
    return `Pro Trial · ${daysLeft} days left`
  }
  return 'Free'
}

export interface DeadlineInfo {
  /** The active tender with the earliest deadline, or undefined if none have deadlines. */
  nextDeadlineTender: (Tender & { deadline: Timestamp }) | undefined
  /** Most recently created active tender — used as fallback when no deadlines are set. */
  fallbackTender: Tender | undefined
  /** Days until nextDeadlineTender's deadline, or null when no deadlines exist. */
  daysUntilDeadline: number | null
}

/**
 * Derives the deadline card data from a list of active tenders.
 * Does NOT mutate the input array.
 */
export function deriveDeadlineInfo(activeTenders: Tender[]): DeadlineInfo {
  const withDeadline = activeTenders
    .filter((t): t is Tender & { deadline: Timestamp } => !!t.deadline)
    .sort((a, b) => a.deadline.toMillis() - b.deadline.toMillis())

  const nextDeadlineTender = withDeadline[0]

  // .slice() prevents mutation of the original activeTenders array
  const fallbackTender = activeTenders
    .slice()
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]

  const daysUntilDeadline = nextDeadlineTender
    ? Math.ceil((nextDeadlineTender.deadline.toMillis() - Date.now()) / 86_400_000)
    : null

  return { nextDeadlineTender, fallbackTender, daysUntilDeadline }
}
```

---

### Task 7: Run tests and confirm they pass

- [ ] **Step 1: Run tests**

```bash
npx vitest run tests/unit/dashboard-utils.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 2: Commit**

```bash
git add src/lib/dashboard-utils.ts tests/unit/dashboard-utils.test.ts
git commit -m "feat: add dashboard-utils helpers (getPlanBadge, deriveDeadlineInfo) with tests"
```

---

## Chunk 3: BottomNav + MenuSheet

**Files:**
- Create: `src/components/layout/menu-sheet.tsx`
- Modify: `src/components/layout/bottom-nav.tsx`
- Modify: `src/app/[locale]/(app)/layout.tsx`

---

### Task 8: Create `MenuSheet` component

- [ ] **Step 1: Create `src/components/layout/menu-sheet.tsx`**

```typescript
// src/components/layout/menu-sheet.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell, BookOpen, Folder, Package, Settings, LogOut } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/firebase/auth'
import { getPlanBadge } from '@/lib/dashboard-utils'
import type { UserProfile } from '@/lib/types'

interface MenuSheetProps {
  open: boolean
  onClose: () => void
  locale: string
  profile: UserProfile | null
}

const NAV_ITEMS = [
  { key: 'alerts',    icon: Bell,     href: '/alerts'    },
  { key: 'learn',     icon: BookOpen, href: '/learn'     },
  { key: 'documents', icon: Folder,   href: '/documents' },
  { key: 'orders',    icon: Package,  href: '/orders'    },
  { key: 'settings',  icon: Settings, href: '/settings'  },
] as const

export function MenuSheet({ open, onClose, locale, profile }: MenuSheetProps) {
  const router = useRouter()
  const tNav = useTranslations('nav')
  const tSettings = useTranslations('settings')

  async function handleLogOut() {
    await signOut()
    router.replace(`/${locale}/auth`)
  }

  function navigate(href: string) {
    onClose()
    router.push(`/${locale}${href}`)
  }

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) onClose() }}>
      <SheetContent side="bottom" showCloseButton={false} className="px-4 pb-8 pt-3 rounded-t-2xl max-h-[85vh]">

        {/* Drag handle — visual affordance only; close via tap-outside or X */}
        <div className="w-10 h-1 rounded bg-gray-200 mx-auto mb-4" />

        {/* User strip */}
        {profile && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-navy/5 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {profile.name ? profile.name.slice(0, 2).toUpperCase() : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy text-sm truncate">{profile.name}</p>
              <span
                className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full',
                  profile.plan === 'pro'
                    ? 'bg-orange/10 text-orange'
                    : 'bg-navy/10 text-navy/60'
                )}
              >
                {getPlanBadge(profile)}
              </span>
            </div>
          </div>
        )}

        {/* 2×3 nav grid */}
        <div className="grid grid-cols-3 gap-2">
          {NAV_ITEMS.map(({ key, icon: Icon, href }) => (
            <button
              key={key}
              onClick={() => navigate(href)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-navy/5 active:bg-navy/10 transition-colors"
            >
              <Icon size={22} className="text-navy" aria-hidden="true" />
              <span className="text-[11px] font-medium text-navy">{tNav(key)}</span>
            </button>
          ))}

          {/* Log Out — sixth cell, danger colour */}
          <button
            onClick={handleLogOut}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-danger/5 active:bg-danger/10 transition-colors"
          >
            <LogOut size={22} className="text-danger" aria-hidden="true" />
            <span className="text-[11px] font-medium text-danger">{tSettings('logout')}</span>
          </button>
        </div>

      </SheetContent>
    </Sheet>
  )
}
```

---

### Task 9: Modify `bottom-nav.tsx`

Replace the fifth NAV entry with a `<button>` + `MenuSheet`.

- [ ] **Step 1: Rewrite `src/components/layout/bottom-nav.tsx`**

```typescript
// src/components/layout/bottom-nav.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, FileText, Hammer, Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { MenuSheet } from '@/components/layout/menu-sheet'
import type { UserProfile } from '@/lib/types'

const NAV = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'find',      href: '/find',      icon: Search },
  { key: 'tenders',   href: '/tenders',   icon: FileText },
  { key: 'bid',       href: '/bid',        icon: Hammer },
] as const

interface BottomNavProps {
  locale: string
  profile: UserProfile | null
}

export function BottomNav({ locale, profile }: BottomNavProps) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 desktop:hidden">
        <div className="flex items-center justify-around h-16">
          {NAV.map(({ key, href, icon: Icon }) => {
            const full = `/${locale}${href}`
            const active = pathname.startsWith(full)
            return (
              <Link
                key={key}
                href={full}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 min-w-[48px] min-h-[48px] justify-center',
                  active ? 'text-orange' : 'text-muted'
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} aria-hidden="true" />
                <span className="text-[10px] font-medium">{t(key)}</span>
              </Link>
            )
          })}

          {/* Tab 5: Menu button — never highlighted as "active" */}
          <button
            onClick={() => setSheetOpen(true)}
            aria-label={t('menu')}
            className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[48px] min-h-[48px] justify-center text-muted"
          >
            <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
            <span className="text-[10px] font-medium">{t('menu')}</span>
          </button>
        </div>
      </nav>

      <MenuSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        locale={locale}
        profile={profile}
      />
    </>
  )
}
```

---

### Task 10: Pass `profile` from `AppLayout` to `BottomNav`

`AppLayout` already calls `useUserProfile()` and has `profile`. Add the prop.

- [ ] **Step 1: Update `BottomNav` call in `src/app/[locale]/(app)/layout.tsx`**

Find this line:
```tsx
<BottomNav locale={locale} />
```

Replace with:
```tsx
<BottomNav locale={locale} profile={profile} />
```

The `profile` variable is already available on line 14 of `layout.tsx` from `const { profile, loading: profileLoading } = useUserProfile()`. No other changes needed in this file.

---

### Task 11: TypeScript check and commit

- [ ] **Step 1: Run tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/menu-sheet.tsx src/components/layout/bottom-nav.tsx src/app/[locale]/\(app\)/layout.tsx
git commit -m "feat: replace More tab with Menu sheet (MenuSheet + BottomNav + layout profile prop)"
```

- [ ] **Step 3: Manual verification**

Start the dev server (`npm run dev`) and open the app on a mobile viewport (or browser devtools at 375px). Tap the "Menu" tab — the bottom sheet should slide up showing the user strip and 2×3 nav grid. Tap each of the 6 items and verify routes. Tap outside to close.

---

## Chunk 4: Adaptive Dashboard

**Files:**
- Create: `src/components/dashboard/getting-started.tsx`
- Create: `src/components/dashboard/active-dashboard.tsx`
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`

---

### Task 12: Create `GettingStarted` component

- [ ] **Step 1: Create `src/components/dashboard/getting-started.tsx`**

```typescript
// src/components/dashboard/getting-started.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle, ArrowRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserProfile, Tender } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'

interface GettingStartedProps {
  locale: string
  profile: UserProfile
  tenders: Tender[]
  usage: AIUsageData
}

interface StepItemProps {
  state: 'done' | 'active' | 'locked'
  label: string
  sub?: string
  onClick?: () => void
}

function StepItem({ state, label, sub, onClick }: StepItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={state !== 'active'}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors',
        state === 'active' && 'bg-white border-2 border-navy shadow-sm',
        state === 'done'   && 'bg-white border border-navy/10',
        state === 'locked' && 'bg-white border border-navy/10 opacity-50 pointer-events-none'
      )}
    >
      {state === 'done' && (
        <CheckCircle2 size={20} className="text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      {state === 'locked' && (
        <Lock size={20} className="text-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      {state === 'active' && (
        <Circle size={20} className="text-navy flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', state === 'done' ? 'text-navy/60 line-through' : 'text-navy')}>
          {label}
        </p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>

      {state === 'active' && (
        <ArrowRight size={18} className="text-navy flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
    </button>
  )
}

export function GettingStarted({ locale, profile, tenders, usage }: GettingStartedProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')

  const step2Complete = tenders.length > 0
  const step3Complete = (usage.bidDocs ?? 0) > 0

  const showTip = !!profile.categories[0] && !!profile.state

  return (
    <div className="space-y-4">
      <h2 className="font-heading font-bold text-lg text-navy">{t('gettingStartedTitle')}</h2>

      <div className="space-y-2">
        {/* Step 1: always done */}
        <StepItem state="done" label={t('step1Done')} />

        {/* Step 2: active CTA — navigates to /find */}
        <StepItem
          state={step2Complete ? 'done' : 'active'}
          label={t('step2')}
          sub={step2Complete ? undefined : t('step2Sub')}
          onClick={() => router.push(`/${locale}/find`)}
        />

        {/* Step 3: locked until step 2 complete (on this view always locked) */}
        <StepItem
          state={step3Complete ? 'done' : 'locked'}
          label={t('step3')}
          sub={t('step3Sub')}
        />
      </div>

      {/* Tip card */}
      {showTip && (
        <div className="bg-orange/5 border border-orange/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-orange mb-1">{t('tipLabel')}</p>
          <p className="text-sm text-navy/80 leading-relaxed">
            {t('tipBody', { category: profile.categories[0], state: profile.state })}
          </p>
        </div>
      )}
    </div>
  )
}
```

---

### Task 13: Create `ActiveDashboard` component

- [ ] **Step 1: Create `src/components/dashboard/active-dashboard.tsx`**

```typescript
// src/components/dashboard/active-dashboard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, FileText, Bell, BookOpen } from 'lucide-react'
import { deriveDeadlineInfo } from '@/lib/dashboard-utils'
import type { Tender } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'

function formatDeadlineDate(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

interface ActiveDashboardProps {
  locale: string
  tenders: Tender[]
  activeTenders: Tender[]
  usage: AIUsageData
}

export function ActiveDashboard({ locale, tenders, activeTenders, usage }: ActiveDashboardProps) {
  const router   = useRouter()
  const t        = useTranslations('dashboard')
  const tNav     = useTranslations('nav')

  const { nextDeadlineTender, fallbackTender, daysUntilDeadline } = deriveDeadlineInfo(activeTenders)

  const wonCount  = tenders.filter(tender => tender.status === 'won').length
  const bidsCount = usage.bidDocs ?? 0

  const QUICK_ACTIONS = [
    { labelKey: 'find'   as const, icon: Search,   href: '/find'   },
    { labelKey: 'bid'    as const, icon: FileText,  href: '/bid'    },
    { labelKey: 'alerts' as const, icon: Bell,      href: '/alerts' },
    { labelKey: 'learn'  as const, icon: BookOpen,  href: '/learn'  },
  ]

  return (
    <div className="space-y-4">

      {/* ── Deadline card ──────────────────────────────── */}
      <div className="bg-navy rounded-2xl p-4 text-white">
        {activeTenders.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-white/70">{t('noActiveTenders')}</p>
            <button
              onClick={() => router.push(`/${locale}/find`)}
              className="mt-2 text-sm font-semibold text-orange underline underline-offset-2"
            >
              {t('findNewTender')}
            </button>
          </div>
        ) : nextDeadlineTender ? (
          <>
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">{t('nextDeadlineLabel')}</p>
            <p className="font-semibold text-base leading-snug line-clamp-2 mb-2">
              {nextDeadlineTender.name}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/70">
                {formatDeadlineDate(nextDeadlineTender.deadline.toMillis())}
              </p>
              {daysUntilDeadline !== null && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  daysUntilDeadline <= 3 ? 'bg-danger text-white' : 'bg-white/20 text-white'
                }`}>
                  {daysUntilDeadline}d left
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">{t('latestActiveLabel')}</p>
            <p className="font-semibold text-base leading-snug line-clamp-2">
              {fallbackTender?.name}
            </p>
          </>
        )}
      </div>

      {/* ── Stats row ──────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: t('statsActive'), value: activeTenders.length },
          { label: t('statsWon'),    value: wonCount },
          { label: t('statsBids'),   value: bidsCount },
        ] as const).map(({ label, value }) => (
          <div key={label} className="bg-white border border-navy/10 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-navy">{value}</p>
            <p className="text-[10px] text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ──────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-navy uppercase tracking-wide mb-2">
          {t('quickActions')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map(({ labelKey, icon: Icon, href }) => (
            <button
              key={href}
              onClick={() => router.push(`/${locale}${href}`)}
              className="flex items-center gap-2 p-3 bg-white border border-navy/10 rounded-xl hover:bg-navy/5 transition-colors"
            >
              <Icon size={18} className="text-navy flex-shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-navy">{tNav(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
```

---

### Task 14: Rewrite `dashboard/page.tsx`

- [ ] **Step 1: Replace `src/app/[locale]/(app)/dashboard/page.tsx`**

```typescript
// src/app/[locale]/(app)/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { usePlatformStats } from '@/lib/hooks/use-platform-stats'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { touchLastActive } from '@/lib/firebase/firestore'
import { TrustSignalBar } from '@/components/dashboard/trust-signal-bar'
import { TrialBanner } from '@/components/dashboard/trial-banner'
import { AIUsageCounter } from '@/components/dashboard/ai-usage-counter'
import { GettingStarted } from '@/components/dashboard/getting-started'
import { ActiveDashboard } from '@/components/dashboard/active-dashboard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { isPro } from '@/lib/plan-guard'

export default function DashboardPage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'hi'
  const t = useTranslations('dashboard')

  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { stats } = usePlatformStats()
  const { tenders, loading: tendersLoading, error: tendersError } = useUserTenders(user?.uid ?? null)
  const { usage } = useAIUsage(user?.uid ?? null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    if (user?.uid) touchLastActive(user.uid).catch(() => {})
  }, [user?.uid])

  // Guard 1: profile must be loaded before we render anything that reads it
  if (!profile) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <p className="text-sm text-muted">Could not load your profile. Please refresh the page.</p>
    </div>
  )

  // Guard 2: wait for tenders snapshot to avoid flashing Getting Started
  if (tendersLoading) return (
    <div className="space-y-3 mt-4">
      <div className="h-20 bg-navy/5 rounded-xl animate-pulse" />
      <div className="h-20 bg-navy/5 rounded-xl animate-pulse" />
    </div>
  )

  const userIsPro     = isPro(profile)
  const activeTenders = tenders.filter(tender => tender.status === 'active')
  const isNewUser     = tenders.length === 0   // single source of truth

  return (
    <div className="space-y-5 pb-20 desktop:pb-6">
      <TrustSignalBar stats={stats} />

      {!userIsPro && (
        <TrialBanner
          trialEndsAt={profile.trialEndsAt}
          createdAt={profile.createdAt}
          onUpgrade={() => setUpgradeOpen(true)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-xl text-navy">
            {t('greeting', { name: profile.name || 'Vendor' })}
          </h1>
          {activeTenders.length > 0 && (
            <p className="text-sm text-muted mt-0.5">
              {t('activeTenders', { count: activeTenders.length })}
            </p>
          )}
        </div>
        <AIUsageCounter usage={usage} isPro={userIsPro} />
      </div>

      {tendersError && (
        <p className="text-sm text-danger">{tendersError}</p>
      )}

      {/* Adaptive section — replaces <FeatureCards> */}
      {isNewUser ? (
        <GettingStarted
          locale={locale}
          profile={profile}
          tenders={tenders}
          usage={usage}
        />
      ) : (
        <ActiveDashboard
          locale={locale}
          tenders={tenders}
          activeTenders={activeTenders}
          usage={usage}
        />
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="trial_cta"
      />
    </div>
  )
}
```

> **Note:** `FeatureCards` import is removed entirely — the file `src/components/dashboard/feature-cards.tsx` is left untouched (it still exists, just no longer imported from the dashboard page). The `accountAgeDays` calculation is also removed.

---

### Task 15: TypeScript check and commit

- [ ] **Step 1: Run tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/getting-started.tsx src/components/dashboard/active-dashboard.tsx src/app/[locale]/\(app\)/dashboard/page.tsx
git commit -m "feat: adaptive dashboard — GettingStarted (0 tenders) + ActiveDashboard (1+ tenders)"
```

- [ ] **Step 3: Manual verification**

Open the app as a new user (or clear Firestore tenders for your test account). Dashboard should show the Getting Started checklist. Tap "पहला Tender खोजें" — should navigate to `/find`. Save a tender on Find page, return to Dashboard — should now show the Active Dashboard with deadline card and stats.

---

## Chunk 5: Find Page Cleanup

**Files:**
- Modify: `src/components/finder/state-category-filters.tsx`
- Modify: `src/app/[locale]/(app)/find/page.tsx`

---

### Task 16: Add `maxVisible` prop to `CategoryFilter`

`CategoryFilter` renders all ~20 `GEM_CATEGORIES`. Adding `maxVisible` truncates the visible count.

- [ ] **Step 1: Update `src/components/finder/state-category-filters.tsx`**

Replace the `CategoryFilterProps` interface and `CategoryFilter` function (lines 27–62). Everything else in the file (imports, `StateFilterProps`, `StateFilter`) stays unchanged.

```typescript
interface CategoryFilterProps {
  selected: string[]
  onChange: (cats: string[]) => void
  maxVisible?: number   // limits total GEM_CATEGORIES pills rendered; undefined = show all
}

export function CategoryFilter({ selected, onChange, maxVisible }: CategoryFilterProps) {
  const toggle = (cat: string) => {
    onChange(
      selected.includes(cat)
        ? selected.filter(c => c !== cat)
        : [...selected, cat]
    )
  }

  const visibleCategories = maxVisible !== undefined
    ? GEM_CATEGORIES.slice(0, maxVisible)
    : GEM_CATEGORIES

  const hiddenCount = maxVisible !== undefined
    ? Math.max(0, GEM_CATEGORIES.length - maxVisible)
    : 0

  return (
    <div className="flex flex-wrap gap-2">
      {visibleCategories.map(cat => {
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

      {hiddenCount > 0 && (
        <span className="px-2 py-0.5 bg-navy/10 text-navy/60 rounded-full text-[10px] pointer-events-none">
          +{hiddenCount} more
        </span>
      )}
    </div>
  )
}
```

---

### Task 17: Rewrite `find/page.tsx`

Remove `AlgoliaSearch`, compact the filter rows, wrap `AISummarizer` in a collapsible accordion.

- [ ] **Step 1: Replace `src/app/[locale]/(app)/find/page.tsx`**

```typescript
// src/app/[locale]/(app)/find/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { StateFilter, CategoryFilter } from '@/components/finder/state-category-filters'
import { GemDeeplinkButton } from '@/components/finder/gem-deeplink-button'
import { AISummarizer } from '@/components/finder/ai-summarizer'
import { GemLiveFeed } from '@/components/finder/gem-live-feed'

export default function FindPage() {
  const t = useTranslations('finder')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage, refresh: refreshUsage } = useAIUsage(user?.uid ?? null)

  const [selectedState, setSelectedState]           = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  const [summarizerOpen, setSummarizerOpen]         = useState(false)

  // Seed filters from profile once on first load — do not remove
  useEffect(() => {
    if (profile && !filtersInitialized) {
      setSelectedState(profile.state || 'all')
      setSelectedCategories(profile.categories)
      setFiltersInitialized(true)
    }
  }, [profile, filtersInitialized])

  if (!profile || !user) return null

  return (
    <div className="space-y-6 pb-20 desktop:pb-6">
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
        <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
      </div>

      {/* Compact filter rows — AlgoliaSearch removed (lives on Tenders page) */}
      <div className="space-y-2">
        {/* Row 1: state picker + GeM deeplink side by side */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <StateFilter value={selectedState || 'all'} onChange={setSelectedState} />
          </div>
          <GemDeeplinkButton state={selectedState || 'all'} categories={selectedCategories} />
        </div>

        {/* Row 2: category pills — show 8 of 20, rest as "+N more" badge */}
        <CategoryFilter
          selected={selectedCategories}
          onChange={setSelectedCategories}
          maxVisible={8}
        />
      </div>

      {/* Live government tenders feed — primary content */}
      <GemLiveFeed
        state={selectedState}
        categories={selectedCategories}
        profile={profile}
        tenderCount={tenders.length}
      />

      {/* AI Summarizer — collapsed by default */}
      <div className="border border-navy/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setSummarizerOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-navy/5 transition-colors"
          aria-expanded={summarizerOpen}
        >
          <span className="text-sm font-semibold text-navy">
            🤖 {t('aiTitle')}
          </span>
          {summarizerOpen
            ? <ChevronUp size={16} className="text-muted" aria-hidden="true" />
            : <ChevronDown size={16} className="text-muted" aria-hidden="true" />
          }
        </button>

        {summarizerOpen && (
          <div className="px-4 pb-4 pt-2">
            <AISummarizer
              uid={user.uid}
              profile={profile}
              usage={usage}
              onUsageUpdate={refreshUsage}
              tenderCount={tenders.length}
              language={profile.language}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### Task 18: TypeScript check and commit

- [ ] **Step 1: Run tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run all unit tests**

```bash
npx vitest run
```

Expected: All tests PASS (including the new dashboard-utils tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/finder/state-category-filters.tsx src/app/[locale]/\(app\)/find/page.tsx
git commit -m "feat: find page cleanup — remove AlgoliaSearch, compact filters, AI summarizer accordion"
```

- [ ] **Step 4: Manual verification**

Open Find page at 375px viewport. Verify:
- Row 1: StateFilter and GeM button on a single horizontal line with no overflow
- Row 2: 8 category pills visible, `+12 more` badge at end
- AlgoliaSearch is gone from this page (confirm it still works on Tenders page)
- AI Summarizer header visible and collapsed; tap to expand works
- Live feed loads correctly with filters applied

---

## Final Acceptance Check

Run through the spec's acceptance criteria:

```bash
npx tsc --noEmit && npx vitest run
```

Then manually verify each item in `docs/superpowers/specs/2026-03-22-ux-flow-redesign.md` under **Acceptance Criteria**.

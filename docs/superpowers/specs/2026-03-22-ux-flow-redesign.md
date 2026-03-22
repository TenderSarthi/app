# UX Flow Redesign — TenderSarthi

**Date:** 2026-03-22
**Status:** Draft — approved for implementation
**Scope:** Mobile navigation, adaptive dashboard, Find page cleanup

---

## Problem

The app has 9 screens but mobile users can only reach 5 of them. The bottom nav's "More" tab routes directly to `/settings` instead of a menu — a significant mislabelling that exposes users to the account deletion danger zone. New users land on a dashboard with no clear next action. The Find page stacks 5 unrelated UI sections with no visual hierarchy, and the Algolia saved-tender search sits on the wrong page.

---

## Goals

1. Make all 9 screens reachable from mobile
2. Give new users (0 tenders saved) a clear guided first step
3. Give returning users (1+ tenders) an at-a-glance status view
4. Reduce Find page cognitive load — one clear job per page
5. Keep the desktop sidebar and all existing screen internals untouched

---

## What We Are Changing

### 1. Bottom Nav — "More" → "Menu"

**Current `NAV` array (bottom-nav.tsx):**
```ts
{ key: 'more', href: '/settings', icon: MoreHorizontal }
```

**Change:** Remove the fifth entry from the `NAV` array entirely. Render the first four tabs via the existing `map()` loop unchanged. Add the fifth tab **outside** the map as a standalone `<button>` element (not a `Link`) that opens `MenuSheet` via a local `sheetOpen` boolean state:

```tsx
const [sheetOpen, setSheetOpen] = useState(false)

// after the map:
<button onClick={() => setSheetOpen(true)} aria-label={t('menu')} className={...}>
  <Menu size={22} />
  <span>{t('menu')}</span>
</button>

<MenuSheet open={sheetOpen} onClose={() => setSheetOpen(false)} locale={locale} />
```

The `MoreHorizontal` icon is replaced with `Menu` (hamburger) from lucide-react to signal a menu, not a "more" overflow.

**Active state:** The Menu button never highlights as "active" — none of the 6 sheet destinations should make it appear selected. Apply the same base styling as the other tabs but without the `pathname.startsWith()` active-color logic.

**i18n:** Add `nav.menu` key to **all 11 locale files** (en, hi, gu, mr, bn, ta, te, kn, pa, or, ml). The existing `nav.more` key becomes unused — leave it in place to avoid churn; it produces no warning if unreferenced.

**Profile prop:** `AppLayout` (`src/app/[locale]/(app)/layout.tsx`) already calls `useUserProfile()` and has `profile` available. Pass `profile` down to `BottomNav` so `MenuSheet` can use it without mounting its own listener:

```tsx
// layout.tsx — change BottomNav call:
<BottomNav locale={locale} profile={profile} />
```

Update `BottomNav` props to `{ locale: string; profile: UserProfile | null }` and thread the prop through to `<MenuSheet>`. This avoids a second `onSnapshot` listener to the same Firestore document.

**File modified:** `src/components/layout/bottom-nav.tsx`

---

### 2. MenuSheet Component (new)

A bottom sheet that slides up when the Menu tab is tapped. Use the **Base UI `Sheet`** component already in the project (`@/components/ui/sheet`) with `side="bottom"` — no new animation library needed. The `sheet.tsx` wrapper is built on `@base-ui/react/dialog`, not Radix UI. Base UI Dialog closes on tap-outside natively (via `SheetPrimitive.Backdrop`). Drag-down gesture is **not** auto-handled by Base UI — omit it; tap-outside and the built-in X close button are sufficient.

Wire up open state via the `open` and `onOpenChange` props on the root `Sheet`:
```tsx
<Sheet open={open} onOpenChange={(val) => { if (!val) onClose() }}>
  <SheetContent side="bottom" showCloseButton={true}>
    ...
  </SheetContent>
</Sheet>
```

**Props:**
```ts
interface MenuSheetProps {
  open: boolean
  onClose: () => void
  locale: string          // passed from BottomNav
  profile: UserProfile | null   // passed from BottomNav (sourced from AppLayout's useUserProfile)
}
```

**Layout (top to bottom inside the sheet):**

1. **Drag handle** — `w-10 h-1 rounded bg-gray-200 mx-auto mb-4`
2. **User strip** — avatar (initials from `profile.name`), display name, plan badge. Use the `profile` prop — do NOT call `useUserProfile()` inside `MenuSheet`. If `profile` is null, skip the user strip. Plan badge text:
   - `profile.plan === 'free'` and no active trial → "Free"
   - Active trial (`profile.trialEndsAt?.toMillis() > Date.now()`) → "Pro Trial · N days left"
   - `profile.plan === 'pro'` → "Pro"
3. **2×3 nav grid** — six items:

| Item | Icon | Route | Gate |
|------|------|-------|------|
| Alerts | Bell | `/alerts` | none (page handles gate) |
| Learn | BookOpen | `/learn` | none |
| Documents | Folder | `/documents` | none (page handles gate) |
| Orders | Package | `/orders` | none (page handles gate) |
| Settings | Settings | `/settings` | none |
| Log Out | LogOut | — | calls `signOut()` from `@/lib/firebase/auth` then `router.replace(`/${locale}/auth`)` |

Pro-gated items navigate normally — the existing lock screens on those pages handle the upgrade gate. No lock badges needed in the sheet.

**File:** `src/components/layout/menu-sheet.tsx`

---

### 3. Adaptive Dashboard

**Condition that drives the switch:**

Replace the existing compound condition:
```ts
// OLD — remove this:
const isNewUser = accountAgeDays < 14 || tenders.length < 3
```

With a single check:
```ts
// NEW:
const isNewUser = tenders.length === 0
```

This means: any user who has saved at least one tender — regardless of account age — sees the active dashboard. The `accountAgeDays` variable and `profile.createdAt` usage are removed from this page.

**Loading guard:** Do not render either dashboard state until `useUserTenders` has resolved. The hook already exposes a `loading` boolean. While `loading === true`, render a skeleton (two `h-20 bg-navy/5 rounded-xl animate-pulse` blocks) to avoid flashing Getting Started on users who have tenders.

The existing `if (!profile)` guard on line 36 of `dashboard/page.tsx` **must remain in place**. The new `tendersLoading` guard goes immediately after it. Order matters:

```ts
const { tenders, loading: tendersLoading } = useUserTenders(user?.uid ?? null)

// keep existing guard first:
if (!profile) return <ProfileErrorView />

// new guard second (inline, no new component file needed):
if (tendersLoading) return (
  <div className="space-y-3 mt-4">
    <div className="h-20 bg-navy/5 rounded-xl animate-pulse" />
    <div className="h-20 bg-navy/5 rounded-xl animate-pulse" />
  </div>
)
```

`profile` and `tenders` are independent fetches — the `!profile` guard protects downstream JSX that reads `profile.name`, `profile.trialEndsAt`, etc. The `tendersLoading` skeleton is inlined directly in `dashboard/page.tsx` — no separate `DashboardSkeleton` component file needed.

---

#### 3a. Getting Started View (`tenders.length === 0`)

Replaces the `<FeatureCards>` section. Everything above it (TrustSignalBar, TrialBanner, greeting + AIUsageCounter row) stays unchanged.

**Three steps — evaluated from existing data:**

| # | Label | Sub-label | Complete when |
|---|-------|-----------|---------------|
| 1 | Account बना लिया | — | Always `true` |
| 2 | पहला Tender खोजें | "Live tenders में अपनी category search करें" | `tenders.length > 0` |
| 3 | AI से Bid बनाएं | "Tender save करने के बाद unlock होगा" | `(usage?.bidDocs ?? 0) > 0` |

- Step 2 is the active CTA — tapping it calls `router.push(`/${locale}/find`)`.
- Step 3 is visually dimmed (`opacity-50 pointer-events-none`) until step 2 is complete (`tenders.length > 0`). Since the dashboard shows Getting Started only when `tenders.length === 0`, step 3 in practice is always locked on this view. It exists to show the user the full journey.
- Steps rendered as a vertical list inside a card. Active step has a blue ring border + arrow icon. Done steps have a green checkmark circle. Locked steps have a grey numbered circle.

**Tip card (below the checklist):**

Uses i18n key `dashboard.tipBody` with interpolated values:
```
t('tipBody', { category: profile.categories[0], state: profile.state })
```

English value: `"{category} category में सबसे ज़्यादा tenders आते हैं — {state} में। Find tab से शुरू करें।"` — intentionally Hinglish per the app's language convention. All non-Hindi locales fall back to this Hinglish string, which is the accepted product behaviour for this app's Indian-market audience.

Source fields: `profile.categories[0]` (first onboarding category) and `profile.state`. If either is empty, omit the tip card entirely — do not call `t('tipBody')` in that case.

**New file:** `src/components/dashboard/getting-started.tsx`

---

#### 3b. Active Dashboard View (`tenders.length > 0`)

Replaces `<FeatureCards>`. Everything above it stays unchanged.

**Three sections:**

**Deadline card** (navy gradient)

Implement this derivation inside `ActiveDashboard` (the `nextDeadline` + `daysUntilDeadline` logic from `dashboard/page.tsx` lines 49–56 covers the primary case, but the fallback is new and must be added):

```ts
const tendersWithDeadline = activeTenders
  .filter((t): t is typeof t & { deadline: NonNullable<typeof t['deadline']> } => !!t.deadline)
  .sort((a, b) => a.deadline.toMillis() - b.deadline.toMillis())

const nextDeadlineTender = tendersWithDeadline[0]  // primary: earliest deadline

// Fallback: most recently created active tender when none have deadlines set
// Use .slice() before .sort() to avoid mutating the activeTenders array in place
const fallbackTender = activeTenders
  .slice()
  .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]

const daysUntilDeadline = nextDeadlineTender
  ? Math.ceil((nextDeadlineTender.deadline.toMillis() - Date.now()) / 86_400_000)
  : null
```

- **Primary case** (`nextDeadlineTender` exists): show tender name, closing date as `"DD MMM YYYY, H:MM AM/PM"`, days-remaining pill.
- **Fallback case** (`activeTenders.length > 0` but no deadlines set): show `fallbackTender.name`, omit closing date.
- **No active tenders** (`activeTenders.length === 0`): show `t('noActiveTenders')` + `t('findNewTender')` nudge that navigates to `/${locale}/find`.

**Stats row** (three equal pills)
- Active: `activeTenders.length`
- Won: `tenders.filter(t => t.status === 'won').length`
- Bids sent: `usage?.bidDocs ?? 0` — from `useAIUsage` hook, already called in `dashboard/page.tsx`. Note: `useAIUsage` is a one-time fetch (not a real-time listener) — this stat reflects the value at page load only. No real-time requirement here.

**Quick action grid** (2×2) — rendered under a `t('quickActions')` section heading
- Find Tenders → `router.push(`/${locale}/find`)`
- Generate Bid → `router.push(`/${locale}/bid`)` (lands on Chat tab by default; URL-based tab deep-linking is a separate future enhancement)
- Set Alerts → `router.push(`/${locale}/alerts`)`
- Learn → `router.push(`/${locale}/learn`)`

**New file:** `src/components/dashboard/active-dashboard.tsx`

---

### 4. Find Page Cleanup

**Remove from Find page:** `<AlgoliaSearch uid={user.uid} />` — this component is **already present on the Tenders page** (`tenders/page.tsx` line 57). No change to Tenders page is needed. Only remove from Find.

**Find page new layout (top to bottom):**

1. **Compact filter rows** — two JSX changes only in `find/page.tsx`; no new wrapper components needed:

   **Row 1** — `<div className="flex items-center gap-2">`:
   - `<StateFilter value={selectedState || 'all'} onChange={setSelectedState} />` takes `flex-1` (expands to fill remaining space)
   - `<GemDeeplinkButton state={selectedState || 'all'} categories={selectedCategories} />` sits flush right — pass both props as currently in find/page.tsx line 54

   **Row 2** — handled by adding a `maxVisible={8}` prop to `<CategoryFilter>`. `CategoryFilter` currently iterates over ALL `GEM_CATEGORIES` (~20 items). Inside `CategoryFilter` (`src/components/finder/state-category-filters.tsx`), add `maxVisible?: number` to its props. When defined, render only the first `maxVisible` pills from `GEM_CATEGORIES` (not from `selected` — this truncates the full available list, not the selected subset). If `GEM_CATEGORIES.length > maxVisible`, append a trailing read-only `+ {GEM_CATEGORIES.length - maxVisible} more` informational badge (`px-2 py-0.5 bg-navy/10 text-navy/60 rounded-full text-[10px] pointer-events-none`). Tapping the badge does nothing. All rendered pills remain toggleable (selecting/deselecting works normally).

   Remove the section heading `{t('filtersTitle')}` — the layout is self-evident without it.

   Preserve the existing `useEffect` that seeds `selectedState` / `selectedCategories` from `profile` on first load — do not remove it.

2. **Live Tenders feed** (`GemLiveFeed`) — primary content, no section heading change needed; the component already has its own `liveFeedTitle` heading.
3. **AI Summarizer accordion** — wrap `<AISummarizer>` in a collapsible container. Default: collapsed. Header text uses the existing `t('aiTitle')` key (renders as "AI Tender Summarizer") prefixed with a `🤖` emoji in JSX (not in the i18n string). Use a Chevron icon to indicate open/closed state. Expanding/collapsing is local `useState`.

**File modified:** `src/app/[locale]/(app)/find/page.tsx`

---

## What We Are NOT Changing

- Onboarding (4 steps, unchanged)
- Bid page internals (Chat + Generator tabs)
- Alerts, Learn, Documents, Orders, Settings page internals
- Desktop sidebar
- Auth + Landing page
- Plan gates and upgrade dialogs
- Firestore data model
- All existing i18n keys

---

## New i18n Keys Required (add to all 11 locale files)

```json
{
  "nav": {
    "menu": "Menu"
  },
  "dashboard": {
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
    "findNewTender": "Find a new tender →"
  }
}
```

Hindi translations for new keys:
```json
{
  "nav": { "menu": "Menu" },
  "dashboard": {
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
    "findNewTender": "नया Tender खोजें →"
  }
}
```

All other 9 locales use the English strings as fallback.

---

## Component Architecture

```
AppLayout (modified)
  └── <BottomNav locale={locale} profile={profile} />   ← new profile prop

BottomNav (modified)
  ├── tabs 1–4: Link map (unchanged)
  ├── tab 5: <button onClick={openSheet}> Menu </button>
  └── <MenuSheet open={sheetOpen} onClose={...} locale={locale} profile={profile} />

MenuSheet (new) — uses Base UI Sheet side="bottom"
  ├── DragHandle
  ├── UserStrip (reads profile prop — no internal useUserProfile call)
  └── NavGrid (6 buttons: Alerts, Learn, Documents, Orders, Settings, LogOut)

DashboardPage (modified)
  ├── [tendersLoading] → DashboardSkeleton
  ├── [tenders.length === 0] → GettingStarted (new)
  │     ├── StepItem × 3 (step 1 done, step 2 active CTA, step 3 locked)
  │     └── TipCard (profile.categories[0] + profile.state)
  └── [tenders.length > 0]  → ActiveDashboard (new)
        ├── DeadlineCard (nextDeadline or most-recent fallback)
        ├── StatsRow (active count, won count, usage.bidDocs)
        └── QuickActionGrid (Find, Bid, Alerts, Learn)

FindPage (modified)
  ├── CompactFilterRow (state picker + category pills + GeM button, preserves profile seeding)
  ├── GemLiveFeed (unchanged, now primary content)
  └── AISummarizerAccordion (collapsed by default, local useState toggle)
```

---

## Acceptance Criteria

- [ ] Tapping "Menu" tab opens the bottom sheet — does not navigate to `/settings`
- [ ] All 6 items in the sheet navigate to correct routes; Log Out signs out and redirects to `/{locale}/auth`
- [ ] `nav.menu` key exists in all 11 locale JSON files
- [ ] Dashboard shows skeleton while `tendersLoading === true`
- [ ] New user (0 tenders) sees Getting Started checklist, not FeatureCards
- [ ] Step 2 "Find Tender" CTA navigates to `/find`
- [ ] Saving first tender causes dashboard to show active view on next render
- [ ] Active dashboard shows correct next deadline and stats (`usage.bidDocs` for Bids Sent)
- [ ] Deadline card fallback: most-recent active tender shown when no deadlines set
- [ ] Tip card omitted if `profile.categories` is empty or `profile.state` is empty
- [ ] `AlgoliaSearch` is removed from Find page (Tenders page already has it — no duplicate)
- [ ] Find page filter row fits in one horizontal line on 375px viewport
- [ ] Profile state/categories seeding `useEffect` is preserved on Find page
- [ ] AI Summarizer is collapsed by default on Find page, expands on tap
- [ ] Desktop sidebar behaviour is unchanged
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] No hardcoded strings — all text via `useTranslations()`

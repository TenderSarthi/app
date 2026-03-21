# Subsystem 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the complete TenderSarthi Next.js 14 application with Firebase Auth (Google OAuth + Phone OTP), 4-step onboarding, 11-language i18n, PWA support, PostHog analytics, and freemium-gate skeleton — leaving stub screens for all other subsystems.

**Architecture:** Next.js 14 App Router with route groups: `(public)` for landing/auth, `(app)` for authenticated screens, `(admin)` for admin panel. Firebase Auth drives session state via a React context provider that all `(app)` routes consume. next-intl handles locale routing with a locale prefix on all routes.

**Tech Stack:** Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Firebase Auth + Firestore · next-intl · next-pwa · PostHog · Upstash Redis (rate-limit skeleton) · Vitest (unit) · Playwright (E2E)

**PRD Reference:** `/Users/adityaraj0421/Cool Projects/Tender/docs/superpowers/specs/2026-03-20-tendersarthi-prd.md` — Sections 3, 4, 5, 6, 9

**App root:** `/Users/adityaraj0421/Cool Projects/Tender/app/`

---

## File Map

```
app/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx            # Root layout (providers, fonts)
│   │   │   ├── page.tsx              # Redirects to /[locale]/dashboard
│   │   │   ├── (public)/
│   │   │   │   ├── auth/page.tsx     # Sign-in screen (Google + Phone OTP)
│   │   │   │   └── onboarding/page.tsx  # 4-step onboarding wizard
│   │   │   ├── (app)/
│   │   │   │   ├── layout.tsx        # Protected layout (auth check + nav)
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── find/page.tsx
│   │   │   │   ├── tenders/page.tsx
│   │   │   │   ├── documents/page.tsx
│   │   │   │   ├── bid/page.tsx
│   │   │   │   ├── alerts/page.tsx
│   │   │   │   ├── learn/page.tsx
│   │   │   │   ├── orders/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   └── (admin)/admin/page.tsx
│   │   └── api/health/route.ts
│   ├── components/
│   │   ├── providers/
│   │   │   ├── index.tsx             # Composes all providers
│   │   │   ├── firebase-provider.tsx # Firebase auth context
│   │   │   └── posthog-provider.tsx  # Analytics + pageview tracking
│   │   ├── auth/
│   │   │   ├── google-sign-in-button.tsx
│   │   │   └── phone-otp-form.tsx
│   │   ├── onboarding/
│   │   │   ├── onboarding-wizard.tsx # Step controller + progress bar
│   │   │   ├── step1-profile.tsx
│   │   │   ├── step2-state.tsx
│   │   │   ├── step3-categories.tsx
│   │   │   └── step4-notifications.tsx
│   │   └── layout/
│   │       ├── bottom-nav.tsx        # Mobile 5-tab nav
│   │       ├── sidebar.tsx           # Desktop 240px sidebar
│   │       └── language-switcher.tsx # 11-language dropdown
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── config.ts             # Firebase singleton init
│   │   │   ├── auth.ts               # signInWithGoogle, sendOtp, verifyOtp, signOut
│   │   │   └── firestore.ts          # createUser, getUser, saveOnboardingData, updateLanguage
│   │   ├── hooks/
│   │   │   ├── use-auth.ts           # useAuth() — uid, user, isAuthenticated
│   │   │   └── use-user-profile.ts   # useUserProfile() — real-time Firestore listener
│   │   ├── types.ts                  # UserProfile, Plan, OnboardingData + type guards
│   │   ├── constants.ts              # GEM_CATEGORIES, INDIAN_STATES, SUPPORTED_LANGUAGES
│   │   ├── posthog.ts                # PostHog client, track(), identifyUser()
│   │   └── plan-guard.ts             # isPro(), canUseAI(), canSaveTenders(), canUseBidGenerator()
│   ├── middleware.ts                 # next-intl locale detection
│   └── i18n.ts                       # next-intl config
├── messages/
│   ├── en.json                       # English (complete)
│   ├── hi.json                       # Hindi (complete — primary language)
│   └── bn/mr/ta/te/gu/kn/pa/or/ml.json  # Stubs (full translations = content task)
├── public/
│   ├── manifest.json                 # PWA manifest
│   └── icons/icon-192.png + icon-512.png
├── tests/
│   ├── unit/
│   │   ├── constants.test.ts
│   │   ├── types.test.ts
│   │   └── plan-guard.test.ts
│   └── setup.ts
├── .env.example
├── .env.local                        # NEVER commit — gitignored
├── next.config.ts
├── tailwind.config.ts
└── vitest.config.ts
```

---

## Chunk 1: Project Scaffold + Configuration

### Task 1: Create Next.js 14 project

**Files:** Create `app/` (entire Next.js project)

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender"
npx create-next-app@latest app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
cd app
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install \
  firebase \
  next-intl \
  next-pwa \
  posthog-js \
  @upstash/redis \
  @upstash/ratelimit \
  lucide-react \
  class-variance-authority \
  clsx \
  tailwind-merge

npm install -D \
  vitest \
  @vitejs/plugin-react \
  @vitest/coverage-v8 \
  jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @playwright/test \
  sharp
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
# Style: Default, Base color: Slate, CSS variables: Yes

npx shadcn@latest add button input label card progress badge sheet dialog select
```

- [ ] **Step 4: Commit baseline**

```bash
git init && git add . && git commit -m "chore: bootstrap Next.js 14 + shadcn/ui + all deps"
```

---

### Task 2: Constants + brand colors

**Files:**
- Create: `src/lib/constants.ts`
- Modify: `tailwind.config.ts`
- Create: `tests/unit/constants.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/constants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BRAND_COLORS, GEM_CATEGORIES, INDIAN_STATES, SUPPORTED_LANGUAGES, LOCALE_CODES } from '@/lib/constants'

describe('BRAND_COLORS', () => {
  it('has all required colors', () => {
    expect(BRAND_COLORS.navy).toBe('#1A3766')
    expect(BRAND_COLORS.orange).toBe('#F97316')
    expect(BRAND_COLORS.gold).toBe('#D97706')
    expect(BRAND_COLORS.green).toBe('#16A34A')
  })
})

describe('GEM_CATEGORIES', () => {
  it('has at least 10 categories', () => expect(GEM_CATEGORIES.length).toBeGreaterThanOrEqual(10))
})

describe('INDIAN_STATES', () => {
  it('has all 28 states + 8 UTs', () => expect(INDIAN_STATES.length).toBe(36))
})

describe('SUPPORTED_LANGUAGES', () => {
  it('supports all 11 languages', () => expect(SUPPORTED_LANGUAGES.length).toBe(11))
  it('has Hindi in list', () => expect(LOCALE_CODES).toContain('hi'))
  it('has Malayalam in list', () => expect(LOCALE_CODES).toContain('ml'))
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run tests/unit/constants.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/constants'`

- [ ] **Step 3: Create `src/lib/constants.ts`**

```typescript
export const BRAND_COLORS = {
  navy: '#1A3766',
  orange: '#F97316',
  gold: '#D97706',
  green: '#16A34A',
  red: '#DC2626',
  gray: '#6B7280',
  lightbg: '#F0F4FB',
} as const

export const GEM_CATEGORIES = [
  'Transport & Vehicles', 'IT & Electronics', 'Medical & Healthcare',
  'Construction & Infrastructure', 'Stationery & Office Supplies',
  'Furniture & Fixtures', 'Uniforms & Clothing', 'Agriculture & Food',
  'Security Services', 'Printing & Publishing', 'Electrical & Lighting',
  'Plumbing & Sanitation', 'Cleaning & Housekeeping', 'Other',
] as const

export type GeMCategory = (typeof GEM_CATEGORIES)[number]

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli',
  'Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const

export type IndianState = (typeof INDIAN_STATES)[number]

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',   nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi',     nativeLabel: 'हिंदी' },
  { code: 'bn', label: 'Bengali',   nativeLabel: 'বাংলা' },
  { code: 'mr', label: 'Marathi',   nativeLabel: 'मराठी' },
  { code: 'ta', label: 'Tamil',     nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu',    nativeLabel: 'తెలుగు' },
  { code: 'gu', label: 'Gujarati',  nativeLabel: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ' },
  { code: 'pa', label: 'Punjabi',   nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'Odia',      nativeLabel: 'ଓଡ଼ିଆ' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']
export const LOCALE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code)
```

- [ ] **Step 4: Update `tailwind.config.ts` with brand colors**

Replace content:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#1A3766',
        orange:  '#F97316',
        gold:    '#D97706',
        success: '#16A34A',
        danger:  '#DC2626',
        muted:   '#6B7280',
        lightbg: '#F0F4FB',
      },
      fontFamily: {
        heading: ['var(--font-poppins)', 'sans-serif'],
        body:    ['var(--font-inter)', 'sans-serif'],
      },
      screens: {
        tablet: '768px',
        desktop: '1024px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
```

- [ ] **Step 5: Run test — verify it passes**

```bash
npx vitest run tests/unit/constants.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat: constants (GEM_CATEGORIES, STATES, LANGUAGES) + tailwind brand colors"
```

---

### Task 3: TypeScript types

**Files:**
- Create: `src/lib/types.ts`
- Create: `tests/unit/types.test.ts`

- [ ] **Step 1: Write failing type guard tests**

Create `tests/unit/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isProPlan, isValidLanguageCode } from '@/lib/types'

describe('isProPlan', () => {
  it('returns true for pro', () => expect(isProPlan('pro')).toBe(true))
  it('returns false for free', () => expect(isProPlan('free')).toBe(false))
  it('returns false for unknown', () => expect(isProPlan('unknown')).toBe(false))
})

describe('isValidLanguageCode', () => {
  it('accepts valid codes', () => {
    expect(isValidLanguageCode('en')).toBe(true)
    expect(isValidLanguageCode('hi')).toBe(true)
    expect(isValidLanguageCode('ml')).toBe(true)
  })
  it('rejects invalid codes', () => {
    expect(isValidLanguageCode('xx')).toBe(false)
    expect(isValidLanguageCode('')).toBe(false)
    expect(isValidLanguageCode(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run tests/unit/types.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `src/lib/types.ts`**

```typescript
import type { Timestamp } from 'firebase/firestore'
import { LOCALE_CODES } from './constants'

export type Plan = 'free' | 'pro'
export type LanguageCode = (typeof LOCALE_CODES)[number]

export interface UserProfile {
  uid: string
  name: string
  businessName: string
  phone: string | null
  email: string | null
  gstin: string | null
  udyamNumber: string | null
  state: string
  categories: string[]
  language: LanguageCode
  plan: Plan
  trialUsed: boolean
  trialEndsAt: Timestamp | null
  proSince: Timestamp | null
  proRenewsAt: Timestamp | null
  razorpayCustomerId: string | null
  razorpaySubscriptionId: string | null
  experienceYears: number | null
  fcmToken: string | null
  notificationsDeclined: boolean
  scheduledDowngradeAt: Timestamp | null
  deletionRequested: boolean
  deletionRequestedAt: Timestamp | null
  createdAt: Timestamp
}

export type OnboardingData = Pick<
  UserProfile,
  'name' | 'businessName' | 'state' | 'categories' | 'language' |
  'fcmToken' | 'notificationsDeclined'
>

export function isProPlan(plan: unknown): plan is 'pro' {
  return plan === 'pro'
}

export function isValidLanguageCode(code: unknown): code is LanguageCode {
  return typeof code === 'string' && (LOCALE_CODES as readonly string[]).includes(code)
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run tests/unit/types.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: TypeScript types — UserProfile (all 24 fields), type guards"
```

---

### Task 4: Plan guard (freemium gate skeleton)

**Files:**
- Create: `src/lib/plan-guard.ts`
- Create: `tests/unit/plan-guard.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/plan-guard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isPro, canUseAI, canSaveTenders, canUseBidGenerator, getBlockReason } from '@/lib/plan-guard'
import type { UserProfile } from '@/lib/types'

const free = { plan: 'free' } as UserProfile
const pro  = { plan: 'pro'  } as UserProfile

describe('isPro', () => {
  it('true for pro', () => expect(isPro(pro)).toBe(true))
  it('false for free', () => expect(isPro(free)).toBe(false))
})

describe('canUseAI', () => {
  it('allows free user with queries remaining', () => expect(canUseAI(free, { queries: 5, bidDocs: 0 })).toBe(true))
  it('blocks free user at 10 queries', () => expect(canUseAI(free, { queries: 10, bidDocs: 0 })).toBe(false))
  it('always allows pro', () => expect(canUseAI(pro, { queries: 999, bidDocs: 0 })).toBe(true))
})

describe('canSaveTenders', () => {
  it('allows free user with < 5 tenders', () => expect(canSaveTenders(free, 4)).toBe(true))
  it('blocks free user at 5 tenders', () => expect(canSaveTenders(free, 5)).toBe(false))
  it('always allows pro', () => expect(canSaveTenders(pro, 999)).toBe(true))
})

describe('canUseBidGenerator', () => {
  it('blocks free users', () => expect(canUseBidGenerator(free, { queries: 0, bidDocs: 0 })).toBe(false))
  it('allows pro under soft cap', () => expect(canUseBidGenerator(pro, { queries: 0, bidDocs: 10 })).toBe(true))
  it('blocks pro at 30 bid doc soft cap', () => expect(canUseBidGenerator(pro, { queries: 0, bidDocs: 30 })).toBe(false))
})

describe('getBlockReason', () => {
  it('returns a non-empty Hindi string', () => {
    expect(getBlockReason('ai').length).toBeGreaterThan(0)
    expect(getBlockReason('pro').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run tests/unit/plan-guard.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `src/lib/plan-guard.ts`**

```typescript
import type { UserProfile } from './types'

const FREE_AI_QUERY_LIMIT   = 10
const FREE_TENDER_SAVE_LIMIT = 5
const PRO_BID_DOC_SOFT_CAP  = 30

export interface AIUsage { queries: number; bidDocs: number }

export function isPro(user: UserProfile): boolean { return user.plan === 'pro' }

export function canUseAI(user: UserProfile, usage: AIUsage): boolean {
  if (isPro(user)) return true
  return usage.queries < FREE_AI_QUERY_LIMIT
}

export function canSaveTenders(user: UserProfile, currentCount: number): boolean {
  if (isPro(user)) return true
  return currentCount < FREE_TENDER_SAVE_LIMIT
}

export function canUseBidGenerator(user: UserProfile, usage: AIUsage): boolean {
  if (!isPro(user)) return false
  return usage.bidDocs < PRO_BID_DOC_SOFT_CAP
}

export function getBlockReason(feature: 'ai' | 'tenders' | 'bidGenerator' | 'pro'): string {
  switch (feature) {
    case 'ai':           return `आपने इस महीने ${FREE_AI_QUERY_LIMIT}/${FREE_AI_QUERY_LIMIT} AI queries use कर लिए। Pro में upgrade करें।`
    case 'tenders':      return `Free plan में ${FREE_TENDER_SAVE_LIMIT} tenders save कर सकते हैं।`
    case 'bidGenerator': return 'Bid Document Generator Pro feature है।'
    case 'pro':          return 'यह Pro feature है। Upgrade करें।'
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run tests/unit/plan-guard.test.ts
```
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: plan-guard freemium gate — AI limit 10, tender limit 5, bid doc soft cap 30"
```

---

## Chunk 2: Firebase + Auth

### Task 5: Firebase config + environment

**Files:**
- Create: `.env.example`
- Create: `.env.local` (with real values — never commit)
- Create: `src/lib/firebase/config.ts`

- [ ] **Step 1: Create `.env.example`**

```bash
# Firebase — Firebase Console > Project Settings > Your Apps > Web
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# PostHog — posthog.com > Project Settings > API Key
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Upstash Redis — console.upstash.com
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Admin access
ADMIN_EMAIL=
```

- [ ] **Step 2: Set up Firebase project**

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project: **tendersarthi**
3. Add Web App → copy config into `.env.local`
4. Authentication → Sign-in method → Enable **Google** + **Phone**
5. Firestore → Create database → **production mode** → region: **asia-south1 (Mumbai)**
6. Storage → Get started → same region

- [ ] **Step 3: Add Firestore security rules**

In Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /aiUsage/{uid}/{month} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /platformStats/{doc} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

- [ ] **Step 4: Create `src/lib/firebase/config.ts`**

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Singleton — prevents re-init during Next.js hot reload
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)
export default app
```

- [ ] **Step 5: Commit (exclude .env.local)**

```bash
git add .env.example src/lib/firebase/config.ts
git commit -m "feat: Firebase config singleton + Firestore security rules"
```

---

### Task 6: Firestore user helpers

**Files:** Create `src/lib/firebase/firestore.ts`

- [ ] **Step 1: Create `src/lib/firebase/firestore.ts`**

```typescript
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from './config'
import type { UserProfile, OnboardingData, LanguageCode } from '../types'

export async function getUser(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function userExists(uid: string): Promise<boolean> {
  return (await getDoc(doc(db, 'users', uid))).exists()
}

/** Called immediately after first sign-in. Starts 7-day Pro trial. */
export async function createUser(uid: string, email: string | null, phone: string | null): Promise<void> {
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)

  await setDoc(doc(db, 'users', uid), {
    uid, name: '', businessName: '', phone, email,
    gstin: null, udyamNumber: null, state: '', categories: [],
    language: 'hi', plan: 'pro',          // shown as pro during 7-day trial
    trialUsed: true, trialEndsAt: Timestamp.fromDate(trialEnd),
    proSince: null, proRenewsAt: null,
    razorpayCustomerId: null, razorpaySubscriptionId: null,
    experienceYears: null, fcmToken: null,
    notificationsDeclined: false, scheduledDowngradeAt: null,
    deletionRequested: false, deletionRequestedAt: null,
    createdAt: serverTimestamp(),
  })
}

/** Saves all data collected during onboarding wizard. */
export async function saveOnboardingData(uid: string, data: OnboardingData): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    name: data.name, businessName: data.businessName,
    state: data.state, categories: data.categories,
    language: data.language, fcmToken: data.fcmToken,
    notificationsDeclined: data.notificationsDeclined,
  })
}

/** Switches user language. Propagates to all active sessions via Firestore listener. */
export async function updateLanguage(uid: string, language: LanguageCode): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { language })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/firebase/firestore.ts
git commit -m "feat: Firestore helpers — createUser (7-day trial), saveOnboardingData, updateLanguage"
```

---

### Task 7: Firebase Auth helpers + hooks

**Files:**
- Create: `src/lib/firebase/auth.ts`
- Create: `src/components/providers/firebase-provider.tsx`
- Create: `src/lib/hooks/use-auth.ts`
- Create: `src/lib/hooks/use-user-profile.ts`

- [ ] **Step 1: Create `src/lib/firebase/auth.ts`**

```typescript
import {
  GoogleAuthProvider, RecaptchaVerifier,
  signInWithPopup, signInWithPhoneNumber, signOut as fbSignOut,
  onAuthStateChanged, type User, type ConfirmationResult,
} from 'firebase/auth'
import { auth } from './config'

export type { User, ConfirmationResult }

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

/** phoneNumber must be E.164 format: "+919876543210" */
export async function sendOtp(phoneNumber: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' })
  return signInWithPhoneNumber(auth, phoneNumber, verifier)
}

export async function verifyOtp(confirmation: ConfirmationResult, otp: string): Promise<User> {
  return (await confirmation.confirm(otp)).user
}

export async function signOut(): Promise<void> { await fbSignOut(auth) }

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb)
}
```

- [ ] **Step 2: Create `src/components/providers/firebase-provider.tsx`**

```typescript
'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthChange, type User } from '@/lib/firebase/auth'

interface Ctx { user: User | null; loading: boolean }
const FirebaseContext = createContext<Ctx>({ user: null, loading: true })

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => onAuthChange((u) => { setUser(u); setLoading(false) }), [])
  return <FirebaseContext.Provider value={{ user, loading }}>{children}</FirebaseContext.Provider>
}

export function useFirebase() { return useContext(FirebaseContext) }
```

- [ ] **Step 3: Create `src/lib/hooks/use-auth.ts`**

```typescript
'use client'
import { useFirebase } from '@/components/providers/firebase-provider'

export function useAuth() {
  const { user, loading } = useFirebase()
  return { user, loading, isAuthenticated: !loading && user !== null, uid: user?.uid ?? null }
}
```

- [ ] **Step 4: Create `src/lib/hooks/use-user-profile.ts`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from './use-auth'
import type { UserProfile } from '@/lib/types'

/** Real-time Firestore listener — updates all open sessions within ~1s on any change */
export function useUserProfile() {
  const { uid } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!uid) { setProfile(null); setLoading(false); return }
    return onSnapshot(doc(db, 'users', uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as UserProfile) : null)
      setLoading(false)
    })
  }, [uid])
  return { profile, loading }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase/auth.ts src/components/providers/ src/lib/hooks/
git commit -m "feat: Firebase auth helpers + FirebaseProvider + useAuth + useUserProfile hooks"
```

---

## Chunk 3: i18n + PWA + Root Layout

### Task 8: next-intl i18n scaffold

**Files:**
- Create: `src/i18n.ts`
- Create: `src/middleware.ts`
- Create: `messages/en.json`
- Create: `messages/hi.json`
- Create: `messages/{bn,mr,ta,te,gu,kn,pa,or,ml}.json` (stubs)

- [ ] **Step 1: Create `src/i18n.ts`**

```typescript
import { getRequestConfig } from 'next-intl/server'
import { LOCALE_CODES } from './lib/constants'

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${
    LOCALE_CODES.includes(locale as typeof LOCALE_CODES[number]) ? locale : 'en'
  }.json`)).default,
}))
```

- [ ] **Step 2: Create `src/middleware.ts`**

```typescript
import createMiddleware from 'next-intl/middleware'
import { LOCALE_CODES } from './lib/constants'

export default createMiddleware({
  locales: [...LOCALE_CODES],
  defaultLocale: 'hi',
  localePrefix: 'always',
})

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/'],
}
```

- [ ] **Step 3: Create `messages/en.json`**

```json
{
  "common": { "appName": "TenderSarthi", "tagline": "Win Government Tenders, Easily", "loading": "Loading...", "error": "Something went wrong. Please try again.", "retry": "Try Again", "save": "Save", "cancel": "Cancel", "continue": "Continue", "skip": "Skip for now", "back": "Back", "next": "Next", "done": "Done", "upgrade": "Upgrade to Pro" },
  "auth": { "title": "Sign in to TenderSarthi", "subtitle": "Win more tenders with AI assistance", "googleSignIn": "Continue with Google", "orDivider": "or", "phonePlaceholder": "Mobile number (e.g. 9876543210)", "sendOtp": "Send OTP", "otpPlaceholder": "Enter 6-digit OTP", "verifyOtp": "Verify OTP", "otpSent": "OTP sent to", "wrongNumber": "Wrong number?", "privacyNote": "By signing in, you agree to our Terms and Privacy Policy." },
  "onboarding": { "stepOf": "Step {current} of {total}", "step1Title": "Welcome to TenderSarthi!", "step1Subtitle": "Let's set up your profile", "namePlaceholder": "Your full name", "businessNamePlaceholder": "Business / firm name", "step2Title": "Which state are you based in?", "step2Subtitle": "We'll filter tenders for your state", "selectState": "Select your state", "step3Title": "Which categories do you bid in?", "step3Subtitle": "Select all that apply", "step4Title": "Get tender alerts instantly", "step4Subtitle": "We'll notify you when matching tenders are posted", "allowNotifications": "Allow Notifications", "notificationsDeclined": "You can enable alerts later in Settings" },
  "nav": { "dashboard": "Dashboard", "find": "Find", "tenders": "Tenders", "bid": "Bid", "more": "More", "documents": "Documents", "alerts": "Alerts", "learn": "Learn", "orders": "Orders", "settings": "Settings" },
  "planGate": { "aiLimitReached": "You've used {used}/{limit} AI queries this month.", "tenderLimitReached": "Free plan allows {limit} saved tenders.", "bidGeneratorPro": "Bid Document Generator is a Pro feature.", "upgradeMonthly": "Rs.499/month", "upgradeAnnual": "Rs.3,999/year" }
}
```

- [ ] **Step 4: Create `messages/hi.json`**

```json
{
  "common": { "appName": "TenderSarthi", "tagline": "सरकारी टेंडर जीतो, आसानी से", "loading": "लोड हो रहा है...", "error": "कुछ गलत हो गया। फिर से try करें।", "retry": "फिर try करें", "save": "Save करें", "cancel": "Cancel", "continue": "जारी रखें", "skip": "अभी नहीं", "back": "वापस", "next": "अगला", "done": "हो गया", "upgrade": "Pro में Upgrade करें" },
  "auth": { "title": "TenderSarthi में Sign in करें", "subtitle": "AI की मदद से ज्यादा tenders जीतें", "googleSignIn": "Google से Continue करें", "orDivider": "या", "phonePlaceholder": "Mobile number (जैसे 9876543210)", "sendOtp": "OTP भेजें", "otpPlaceholder": "6-digit OTP डालें", "verifyOtp": "OTP Verify करें", "otpSent": "OTP भेजा गया:", "wrongNumber": "गलत number?", "privacyNote": "Sign in करके आप हमारी Terms और Privacy Policy से सहमत हैं।" },
  "onboarding": { "stepOf": "Step {current} of {total}", "step1Title": "TenderSarthi में आपका स्वागत है!", "step1Subtitle": "चलिए आपका profile set up करते हैं", "namePlaceholder": "आपका पूरा नाम", "businessNamePlaceholder": "Business / firm का नाम", "step2Title": "आप किस state में हैं?", "step2Subtitle": "हम आपके state के tenders filter करेंगे", "selectState": "अपना state चुनें", "step3Title": "आप किन categories में bid करते हैं?", "step3Subtitle": "जो लागू हों वो सब चुनें", "step4Title": "तुरंत tender alerts पाएं", "step4Subtitle": "जब आपकी category में नया tender आए, हम notify करेंगे", "allowNotifications": "Notifications चालू करें", "notificationsDeclined": "Settings में बाद में enable कर सकते हैं" },
  "nav": { "dashboard": "Dashboard", "find": "खोजें", "tenders": "Tenders", "bid": "Bid", "more": "और", "documents": "Documents", "alerts": "Alerts", "learn": "सीखें", "orders": "Orders", "settings": "Settings" },
  "planGate": { "aiLimitReached": "आपने इस महीने {used}/{limit} AI queries use कर लिए।", "tenderLimitReached": "Free plan में {limit} tenders save कर सकते हैं।", "bidGeneratorPro": "Bid Document Generator Pro feature है।", "upgradeMonthly": "₹499/month", "upgradeAnnual": "₹3,999/year" }
}
```

- [ ] **Step 5: Create stub files for remaining 9 languages**

```bash
for lang in bn mr ta te gu kn pa or ml; do cp messages/en.json messages/$lang.json; done
```

- [ ] **Step 6: Update `next.config.ts`**

```typescript
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import withPWA from 'next-pwa'

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')
const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

export default withNextIntl(pwaConfig({} as NextConfig))
```

- [ ] **Step 7: Commit**

```bash
git add messages/ src/i18n.ts src/middleware.ts next.config.ts
git commit -m "feat: next-intl i18n — 11 locales, Hindi default, EN+HI complete, 9 stubs"
```

---

### Task 9: PWA icons + manifest

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png` + `icon-512.png`

- [ ] **Step 1: Create PWA manifest**

Create `public/manifest.json`:

```json
{
  "name": "TenderSarthi",
  "short_name": "TenderSarthi",
  "description": "Win Government Tenders, Easily — AI-powered GeM tender assistant",
  "start_url": "/hi/dashboard",
  "display": "standalone",
  "background_color": "#1A3766",
  "theme_color": "#1A3766",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "categories": ["business", "productivity"],
  "lang": "hi"
}
```

- [ ] **Step 2: Generate placeholder icons**

Create `scripts/generate-icons.mjs`:

```javascript
import sharp from 'sharp'
import { mkdir } from 'fs/promises'

await mkdir('public/icons', { recursive: true })

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="80" fill="#1A3766"/>
  <text x="256" y="340" font-family="Arial" font-size="220" font-weight="bold" fill="#F97316" text-anchor="middle">TS</text>
</svg>`

await sharp(Buffer.from(svg)).resize(192, 192).toFile('public/icons/icon-192.png')
await sharp(Buffer.from(svg)).resize(512, 512).toFile('public/icons/icon-512.png')
console.log('Icons generated.')
```

```bash
node scripts/generate-icons.mjs
```

- [ ] **Step 3: Commit**

```bash
git add public/ scripts/
git commit -m "feat: PWA manifest + navy/orange TS placeholder icons 192x192 + 512x512"
```

---

### Task 10: PostHog + root providers + locale layout

**Files:**
- Create: `src/lib/posthog.ts`
- Create: `src/components/providers/posthog-provider.tsx`
- Create: `src/components/providers/index.tsx`
- Create: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Create `src/lib/posthog.ts`**

```typescript
import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: false,
    persistence: 'localStorage',
  })
  initialized = true
}

export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, props)
}

export function identifyUser(uid: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.identify(uid, props)
}

export function resetAnalytics() {
  if (typeof window === 'undefined') return
  posthog.reset()
}
```

- [ ] **Step 2: Create `src/components/providers/posthog-provider.tsx`**

```typescript
'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initPostHog, track } from '@/lib/posthog'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  useEffect(() => { initPostHog() }, [])
  useEffect(() => { track('$pageview', { path: pathname }) }, [pathname])
  return <>{children}</>
}
```

- [ ] **Step 3: Create `src/components/providers/index.tsx`**

```typescript
'use client'
import type { ReactNode } from 'react'
import { FirebaseProvider } from './firebase-provider'
import { PostHogProvider } from './posthog-provider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider>
      <PostHogProvider>{children}</PostHogProvider>
    </FirebaseProvider>
  )
}
```

- [ ] **Step 4: Create `src/app/[locale]/layout.tsx`**

```typescript
import type { Metadata, Viewport } from 'next'
import { Poppins, Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Providers } from '@/components/providers'
import '../globals.css'

const poppins = Poppins({ subsets: ['latin'], weight: ['400','600','700'], variable: '--font-poppins', display: 'swap' })
const inter   = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'TenderSarthi — सरकारी टेंडर जीतो, आसानी से',
  description: 'AI-powered GeM tender assistant for Indian vendors.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'TenderSarthi' },
}

export const viewport: Viewport = { themeColor: '#1A3766', width: 'device-width', initialScale: 1, maximumScale: 1 }

export default async function LocaleLayout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: string } }) {
  const messages = await getMessages()
  return (
    <html lang={locale} className={`${poppins.variable} ${inter.variable}`}>
      <body className="bg-lightbg font-body antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/posthog.ts src/components/providers/ src/app/[locale]/layout.tsx
git commit -m "feat: PostHog analytics + root provider tree + locale layout with Poppins/Inter fonts"
```

---

## Chunk 4: Navigation + Auth Screen + Onboarding

### Task 11: Navigation components

**Files:**
- Create: `src/components/layout/bottom-nav.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/language-switcher.tsx`

- [ ] **Step 1: Create `src/components/layout/bottom-nav.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, FileText, Hammer, MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const NAV = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'find',      href: '/find',      icon: Search },
  { key: 'tenders',   href: '/tenders',   icon: FileText },
  { key: 'bid',       href: '/bid',        icon: Hammer },
  { key: 'more',      href: '/settings',  icon: MoreHorizontal },
]

export function BottomNav({ locale }: { locale: string }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 desktop:hidden">
      <div className="flex items-center justify-around h-16">
        {NAV.map(({ key, href, icon: Icon }) => {
          const full = `/${locale}${href}`
          const active = pathname.startsWith(full)
          return (
            <Link key={key} href={full} className={cn('flex flex-col items-center gap-0.5 px-3 py-2 min-w-[48px] min-h-[48px] justify-center', active ? 'text-orange' : 'text-muted')}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{t(key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create `src/components/layout/sidebar.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Search, FileText, Folder, Hammer, Bell, BookOpen, Package, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'find',      href: '/find',      icon: Search },
  { key: 'tenders',   href: '/tenders',   icon: FileText },
  { key: 'documents', href: '/documents', icon: Folder },
  { key: 'bid',       href: '/bid',        icon: Hammer },
  { key: 'alerts',   href: '/alerts',    icon: Bell },
  { key: 'learn',    href: '/learn',     icon: BookOpen },
  { key: 'orders',   href: '/orders',    icon: Package },
  { key: 'settings', href: '/settings',  icon: Settings },
]

export function Sidebar({ locale }: { locale: string }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  return (
    <aside className="hidden desktop:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-200 z-40">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center">
          <span className="text-orange font-heading font-bold text-xs">TS</span>
        </div>
        <span className="font-heading font-semibold text-navy text-sm">TenderSarthi</span>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV.map(({ key, href, icon: Icon }) => {
          const full = `/${locale}${href}`
          const active = pathname.startsWith(full)
          return (
            <Link key={key} href={full} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors', active ? 'bg-orange/10 text-orange font-semibold' : 'text-gray-600 hover:bg-gray-100')}>
              <Icon size={18} />
              <span>{t(key)}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: Create `src/components/layout/language-switcher.tsx`**

```typescript
'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { updateLanguage } from '@/lib/firebase/firestore'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/constants'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { uid } = useAuth()

  async function handleChange(locale: string) {
    if (uid) await updateLanguage(uid, locale as LanguageCode)
    router.push(pathname.replace(`/${currentLocale}`, `/${locale}`))
  }

  return (
    <Select defaultValue={currentLocale} onValueChange={handleChange}>
      <SelectTrigger className="w-36 h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>{l.nativeLabel}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/
git commit -m "feat: BottomNav (mobile 5-tab) + Sidebar (desktop 240px) + LanguageSwitcher (11 languages)"
```

---

### Task 12: Auth screen

**Files:**
- Create: `src/components/auth/google-sign-in-button.tsx`
- Create: `src/components/auth/phone-otp-form.tsx`
- Create: `src/app/[locale]/(public)/auth/page.tsx`

- [ ] **Step 1: Create `src/components/auth/google-sign-in-button.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signInWithGoogle } from '@/lib/firebase/auth'
import { createUser, userExists } from '@/lib/firebase/firestore'
import { track, identifyUser } from '@/lib/posthog'

export function GoogleSignInButton({ locale }: { locale: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handle() {
    setLoading(true); setError(null)
    try {
      const user = await signInWithGoogle()
      identifyUser(user.uid, { email: user.email, method: 'google' })
      if (!(await userExists(user.uid))) {
        await createUser(user.uid, user.email, null)
        track('signup_completed', { method: 'google' })
        router.push(`/${locale}/onboarding`)
      } else {
        router.push(`/${locale}/dashboard`)
      }
    } catch { setError('Sign in failed. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handle} disabled={loading} variant="outline" className="w-full h-12 bg-white text-gray-700 border-gray-300">
        {loading ? 'Signing in...' : (
          <span className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </span>
        )}
      </Button>
      {error && <p className="text-sm text-danger text-center">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/auth/phone-otp-form.tsx`**

```typescript
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendOtp, verifyOtp, type ConfirmationResult } from '@/lib/firebase/auth'
import { createUser, userExists } from '@/lib/firebase/firestore'
import { track, identifyUser } from '@/lib/posthog'

export function PhoneOtpForm({ locale }: { locale: string }) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (phone.length < 10) { setError('Phone number 10 digits का होना चाहिए।'); return }
    setLoading(true); setError(null)
    try {
      const e164 = phone.startsWith('+') ? phone : `+91${phone}`
      setConfirmation(await sendOtp(e164, 'recaptcha-container'))
    } catch { setError('OTP भेजने में error। फिर try करें।') }
    finally { setLoading(false) }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (!confirmation) return
    setLoading(true); setError(null)
    try {
      const user = await verifyOtp(confirmation, otp)
      identifyUser(user.uid, { phone: user.phoneNumber, method: 'phone' })
      if (!(await userExists(user.uid))) {
        await createUser(user.uid, null, user.phoneNumber)
        track('signup_completed', { method: 'phone' })
        router.push(`/${locale}/onboarding`)
      } else { router.push(`/${locale}/dashboard`) }
    } catch { setError('OTP गलत है। फिर try करें।') }
    finally { setLoading(false) }
  }

  if (!confirmation) return (
    <form onSubmit={handleSend} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="phone">Mobile Number</Label>
        <div className="flex gap-2">
          <span className="flex items-center px-3 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">+91</span>
          <Input id="phone" type="tel" inputMode="numeric" maxLength={10} placeholder="9876543210"
            value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="flex-1 h-11" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full h-11 bg-navy hover:bg-navy/90" disabled={loading}>
        {loading ? 'Sending...' : 'OTP भेजें'}
      </Button>
      <div id="recaptcha-container" />
    </form>
  )

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <p className="text-sm text-muted text-center">
        OTP sent to +91{phone}.{' '}
        <button type="button" className="text-orange underline" onClick={() => setConfirmation(null)}>गलत number?</button>
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="otp">Enter OTP</Label>
        <Input id="otp" type="text" inputMode="numeric" maxLength={6} placeholder="______"
          value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="h-11 text-center text-lg tracking-widest" />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full h-11 bg-navy hover:bg-navy/90" disabled={loading || otp.length < 6}>
        {loading ? 'Verifying...' : 'OTP Verify करें'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create `src/app/[locale]/(public)/auth/page.tsx`**

```typescript
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { PhoneOtpForm } from '@/components/auth/phone-otp-form'

function CompassLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="24" fill="#1A3766"/>
      <circle cx="26" cy="26" r="17" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
      <line x1="26" y1="9" x2="26" y2="43" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <line x1="9"  y1="26" x2="43" y2="26" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <polygon points="26,11 23,26 26,24 29,26" fill="#F97316"/>
      <polygon points="26,41 23,26 26,28 29,26" fill="white" opacity="0.5"/>
      <circle cx="26" cy="26" r="2.5" fill="white"/>
    </svg>
  )
}

export default function AuthPage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="min-h-screen bg-lightbg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><CompassLogo /></div>
          <h1 className="font-heading font-bold text-2xl text-navy">TenderSarthi</h1>
          <p className="text-muted text-sm mt-1">सरकारी टेंडर जीतो, आसानी से</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <GoogleSignInButton locale={locale} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-muted">या (or)</span></div>
          </div>
          <PhoneOtpForm locale={locale} />
        </div>
        <p className="text-center text-xs text-muted mt-4">
          Sign in करके आप हमारी{' '}
          <a href={`/${locale}/terms`} className="underline">Terms</a> और{' '}
          <a href={`/${locale}/privacy`} className="underline">Privacy Policy</a> से सहमत हैं।
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/\(public\)/auth/ src/components/auth/
git commit -m "feat: auth page — Google OAuth + Phone OTP, compass logo, Hinglish UI"
```

---

### Task 13: 4-step onboarding wizard

**Files:** All `src/components/onboarding/` + `src/app/[locale]/(public)/onboarding/page.tsx`

- [ ] **Step 1: Create step components**

Create `src/components/onboarding/step1-profile.tsx`:
```typescript
'use client'
import { Input } from '@/components/ui/input'; import { Label } from '@/components/ui/label'
interface Props { name: string; businessName: string; onChange: (f: 'name'|'businessName', v: string) => void }
export function Step1Profile({ name, businessName, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">आपका नाम *</Label>
        <Input id="name" placeholder="Full name" value={name} onChange={(e) => onChange('name', e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="biz">Business / Firm का नाम *</Label>
        <Input id="biz" placeholder="e.g. Sharma Enterprises" value={businessName} onChange={(e) => onChange('businessName', e.target.value)} className="h-11" />
      </div>
    </div>
  )
}
```

Create `src/components/onboarding/step2-state.tsx`:
```typescript
'use client'
import { INDIAN_STATES } from '@/lib/constants'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
interface Props { value: string; onChange: (s: string) => void }
export function Step2State({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full"><SelectValue placeholder="अपना state चुनें" /></SelectTrigger>
      <SelectContent className="max-h-64">
        {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
```

Create `src/components/onboarding/step3-categories.tsx`:
```typescript
'use client'
import { GEM_CATEGORIES, type GeMCategory } from '@/lib/constants'
import { cn } from '@/lib/utils'
interface Props { selected: string[]; onChange: (cats: string[]) => void }
export function Step3Categories({ selected, onChange }: Props) {
  const toggle = (cat: GeMCategory) =>
    onChange(selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat])
  return (
    <div className="flex flex-wrap gap-2">
      {GEM_CATEGORIES.map((cat) => (
        <button key={cat} type="button" onClick={() => toggle(cat)}
          className={cn('px-3 py-2 rounded-full text-sm border transition-colors min-h-[44px]',
            selected.includes(cat) ? 'bg-orange text-white border-orange font-medium' : 'bg-white text-gray-700 border-gray-300 hover:border-orange')}>
          {cat}
        </button>
      ))}
    </div>
  )
}
```

Create `src/components/onboarding/step4-notifications.tsx`:
```typescript
'use client'
import { Bell } from 'lucide-react'; import { Button } from '@/components/ui/button'
interface Props { onAllow: () => void; onSkip: () => void; loading: boolean }
export function Step4Notifications({ onAllow, onSkip, loading }: Props) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-orange/10 flex items-center justify-center">
          <Bell className="text-orange" size={36} />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-gray-700 text-sm leading-relaxed">जब आपकी category में नया tender आए, हम आपको <strong>तुरंत notify</strong> करेंगे।</p>
        <p className="text-muted text-xs">आप कभी भी Settings में से notifications बंद कर सकते हैं।</p>
      </div>
      <div className="space-y-3">
        <Button onClick={onAllow} disabled={loading} className="w-full h-11 bg-orange hover:bg-orange/90 text-white">🔔 Notifications चालू करें</Button>
        <button type="button" onClick={onSkip} className="w-full text-sm text-muted underline py-2">अभी नहीं</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/onboarding/onboarding-wizard.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Step1Profile } from './step1-profile'
import { Step2State } from './step2-state'
import { Step3Categories } from './step3-categories'
import { Step4Notifications } from './step4-notifications'
import { saveOnboardingData } from '@/lib/firebase/firestore'
import { useAuth } from '@/lib/hooks/use-auth'
import { track } from '@/lib/posthog'
import type { LanguageCode } from '@/lib/constants'

const TITLES = ['आपका Profile', 'आपका State', 'आपकी Categories', 'Notifications']
const SUBTITLES = ['TenderSarthi में आपका स्वागत है!', 'हम आपके state के tenders filter करेंगे', 'जो लागू हों वो सब चुनें', 'Tender alerts तुरंत पाएं']

export function OnboardingWizard({ locale }: { locale: string }) {
  const { uid } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [state, setState] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  const canProceed = step === 1 ? name.trim() && businessName.trim() : step === 2 ? state : categories.length > 0

  async function complete(fcmToken: string | null, declined: boolean) {
    if (!uid) return
    setSaving(true)
    try {
      await saveOnboardingData(uid, { name, businessName, state, categories, language: locale as LanguageCode, fcmToken, notificationsDeclined: declined })
      track('onboarding_completed', { state, categoriesCount: categories.length, locale })
      router.push(`/${locale}/dashboard`)
    } finally { setSaving(false) }
  }

  async function handleAllow() {
    let token: string | null = null
    if ('Notification' in window && (await Notification.requestPermission()) === 'granted') {
      token = 'pending-fcm-setup' // Full FCM in Subsystem 6
    }
    await complete(token, false)
  }

  return (
    <div className="min-h-screen bg-lightbg flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted font-medium">Step {step} of 4</span>
            <span className="text-xs text-muted">{Math.round((step / 4) * 100)}%</span>
          </div>
          <Progress value={(step / 4) * 100} className="h-1.5" />
        </div>
      </div>
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-4 py-8">
        {step < 4 && (
          <div className="mb-6">
            <h2 className="font-heading font-bold text-xl text-navy">{TITLES[step - 1]}</h2>
            <p className="text-muted text-sm mt-1">{SUBTITLES[step - 1]}</p>
          </div>
        )}
        <div className="flex-1">
          {step === 1 && <Step1Profile name={name} businessName={businessName} onChange={(f, v) => f === 'name' ? setName(v) : setBusinessName(v)} />}
          {step === 2 && <Step2State value={state} onChange={setState} />}
          {step === 3 && <Step3Categories selected={categories} onChange={setCategories} />}
          {step === 4 && <Step4Notifications onAllow={handleAllow} onSkip={() => complete(null, true)} loading={saving} />}
        </div>
        {step < 4 && (
          <div className="flex gap-3 mt-8">
            {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-11">वापस</Button>}
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed} className="flex-1 h-11 bg-navy hover:bg-navy/90 text-white">
              {step === 3 ? 'लगभग हो गया!' : 'अगला →'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create onboarding page**

Create `src/app/[locale]/(public)/onboarding/page.tsx`:
```typescript
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
export default function OnboardingPage({ params: { locale } }: { params: { locale: string } }) {
  return <OnboardingWizard locale={locale} />
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/\(public\)/onboarding/ src/components/onboarding/
git commit -m "feat: 4-step onboarding — profile, state, categories, push notification permission + PostHog tracking"
```

---

## Chunk 5: App Shell + Final Wiring

### Task 14: Protected layout + all stub screens

**Files:**
- Create: `src/app/[locale]/(app)/layout.tsx`
- Create: stub `page.tsx` for all 9 routes + admin + locale root
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Create `src/app/[locale]/(app)/layout.tsx`**

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { LanguageSwitcher } from '@/components/layout/language-switcher'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading } = useUserProfile()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/${locale}/auth`)
  }, [authLoading, user, locale, router])

  useEffect(() => {
    if (!profileLoading && profile && !profile.name) router.replace(`/${locale}/onboarding`)
  }, [profileLoading, profile, locale, router])

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightbg">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-lightbg">
      <Sidebar locale={locale} />
      <main className="desktop:ml-60 pb-20 desktop:pb-0">
        <div className="bg-white border-b border-gray-100 px-4 py-2 flex justify-end desktop:px-6">
          <LanguageSwitcher currentLocale={locale} />
        </div>
        <div className="p-4 desktop:p-6">{children}</div>
      </main>
      <BottomNav locale={locale} />
    </div>
  )
}
```

- [ ] **Step 2: Create all stub screens**

```bash
mkdir -p src/app/\[locale\]/\(app\)/{dashboard,find,tenders,documents,bid,alerts,learn,orders,settings}
mkdir -p src/app/\[locale\]/\(admin\)/admin
```

Create `src/app/[locale]/(app)/dashboard/page.tsx`:
```typescript
export default function DashboardPage() {
  return <div className="space-y-4"><h1 className="font-heading font-bold text-2xl text-navy">Dashboard</h1><p className="text-muted">Coming in Subsystem 2 — Dashboard + Tender Finder</p></div>
}
```

Repeat for remaining routes (find → Sub 2, tenders → Sub 3, documents → Sub 4, bid → Sub 5, alerts → Sub 6, learn → Sub 8, orders → Sub 7, settings → Sub 9).

Create `src/app/[locale]/(admin)/admin/page.tsx`:
```typescript
export default function AdminPage() {
  return <div className="p-8"><h1 className="font-heading font-bold text-2xl text-navy">Admin Panel</h1><p className="text-muted mt-2">Coming in Subsystem 11</p></div>
}
```

Create `src/app/[locale]/page.tsx`:
```typescript
import { redirect } from 'next/navigation'
export default function Root({ params: { locale } }: { params: { locale: string } }) {
  redirect(`/${locale}/dashboard`)
}
```

- [ ] **Step 3: Create health check route**

Create `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server'
export function GET() {
  return NextResponse.json({ status: 'ok', app: 'TenderSarthi', version: '1.0.0', timestamp: new Date().toISOString() })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "feat: protected app layout (auth + onboarding redirects) + 9 stub screens + health check"
```

---

### Task 15: Vitest config + run all tests

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

- [ ] **Step 2: Create `tests/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Run all unit tests**

```bash
npx vitest run
```

Expected:
```
✓ tests/unit/constants.test.ts (4 tests)
✓ tests/unit/types.test.ts    (6 tests)
✓ tests/unit/plan-guard.test.ts (9 tests)

Test Files: 3 passed
Tests:      19 passed
Duration:   < 2s
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Run ESLint**

```bash
npm run lint
```
Expected: 0 errors

- [ ] **Step 6: Start dev server and verify**

```bash
npm run dev
```

Manual checks:
- `http://localhost:3000` → redirects to `http://localhost:3000/hi/dashboard`
- `http://localhost:3000/hi/dashboard` → loading spinner → redirects to `/hi/auth` (not logged in)
- `http://localhost:3000/hi/auth` → shows compass logo + Google button + phone form
- `http://localhost:3000/api/health` → `{ "status": "ok" }`
- `http://localhost:3000/manifest.json` → PWA manifest JSON
- Language switcher shows all 11 languages in native script

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: vitest config + 19 unit tests passing, tsc clean, Subsystem 1 Foundation complete"
```

---

## Verification Checklist

- [ ] `npx vitest run` — 19 tests pass, 0 fail
- [ ] `npx tsc --noEmit` — 0 TypeScript errors
- [ ] `npm run lint` — 0 ESLint errors
- [ ] `npm run dev` starts without errors
- [ ] `/hi/auth` — Google sign-in button + phone OTP form visible
- [ ] Google sign-in → new user → creates Firestore doc → `/hi/onboarding`
- [ ] Google sign-in → returning user → `/hi/dashboard`
- [ ] Onboarding Step 1: name + business required to proceed
- [ ] Onboarding Step 2: all 36 states in dropdown
- [ ] Onboarding Step 3: all 14 GeM categories as chips
- [ ] Onboarding Step 4: notification prompt, skip works
- [ ] Completing onboarding → Firestore updated → `/hi/dashboard`
- [ ] `/hi/dashboard` → sidebar on desktop, bottom nav on mobile
- [ ] Language switcher has all 11 languages in native script
- [ ] Switching language → URL locale changes → Firestore updated
- [ ] Unauthenticated `/hi/dashboard` → redirects to `/hi/auth`
- [ ] Auth → onboarding not complete → redirects to `/hi/onboarding`
- [ ] `/api/health` → `{ "status": "ok" }`
- [ ] `/manifest.json` → valid PWA manifest
- [ ] PostHog `signup_completed` event fires on first sign-in
- [ ] PostHog `onboarding_completed` event fires with state + categories
- [ ] `isPro()`, `canUseAI()`, `canSaveTenders()`, `canUseBidGenerator()` all pass
- [ ] Plan gate block reasons are in Hinglish

---

*Plan complete and saved to `docs/superpowers/plans/2026-03-20-subsystem-1-foundation.md`. Ready to execute?*

# Subsystem 11: Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional internal admin panel at `/admin` (5 screens) with email-based access control, user management, MRR dashboard, alert health monitoring, and Learning Center CMS backed by Firestore.

**Architecture:** Admin pages live in the existing `(admin)` route group alongside `(app)`. A new `(admin)/layout.tsx` client component checks `user.email === NEXT_PUBLIC_ADMIN_EMAIL` and redirects unauthorized users. All admin data flows through protected API routes that verify the Firebase ID token + email on the server side. The Learning Center CMS writes articles to Firestore `articles/{id}` (separate from the static seed data in `learn-content.ts`).

**Tech Stack:** Next.js 15 App Router, Firebase Admin SDK (already configured at `src/lib/firebase/admin.ts`), Firestore Admin SDK, next-intl, Tailwind CSS, shadcn/ui, Lucide icons. No new npm packages needed.

---

## Environment Variables Required

Two new env vars must be added to `.env.local` and Vercel:
- `NEXT_PUBLIC_ADMIN_EMAIL` — founder's email for client-side guard (exposed to browser, safe)
- `ADMIN_EMAIL` — same email for server-side API route verification (not exposed to browser)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/admin-utils.ts` | Pure helpers: `calcMRR`, `formatPercent`, `formatCurrency` |
| Create | `tests/unit/admin-utils.test.ts` | 6 unit tests |
| Create | `src/lib/admin-auth.ts` | `verifyAdminToken(req)` — verifies Firebase token + email check |
| Create | `src/lib/firebase/admin-queries.ts` | Firestore Admin queries for admin panel (users, articles, stats) |
| Create | `src/app/api/admin/stats/route.ts` | GET dashboard stats |
| Create | `src/app/api/admin/users/route.ts` | GET user list (recent 50 + client search) |
| Create | `src/app/api/admin/users/[uid]/plan/route.ts` | POST toggle user plan (support override) |
| Create | `src/app/api/admin/users/[uid]/delete/route.ts` | POST delete user + all data |
| Create | `src/app/api/admin/articles/route.ts` | GET list + POST create article |
| Create | `src/app/api/admin/articles/[id]/route.ts` | PUT update + DELETE article |
| Create | `src/app/[locale]/(admin)/layout.tsx` | Admin auth guard + nav sidebar |
| Modify | `src/app/[locale]/(admin)/admin/page.tsx` | Overview dashboard |
| Create | `src/app/[locale]/(admin)/admin/users/page.tsx` | User management table |
| Create | `src/app/[locale]/(admin)/admin/alerts/page.tsx` | Alert system health |
| Create | `src/app/[locale]/(admin)/admin/learn/page.tsx` | Learning Center CMS |
| Create | `src/app/[locale]/(admin)/admin/tenders/page.tsx` | Community tender moderation stub |

---

## Chunk 1: Pure Utilities + Tests

### Task 1: admin-utils.ts

**Files:**
- Create: `src/lib/admin-utils.ts`
- Create: `tests/unit/admin-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/admin-utils.test.ts
import { describe, it, expect } from 'vitest'
import { calcMRR, formatPercent, formatCurrency } from '@/lib/admin-utils'

describe('calcMRR', () => {
  it('returns 0 for no pro users', () => {
    expect(calcMRR(0)).toBe(0)
  })
  it('multiplies pro count by 499', () => {
    expect(calcMRR(10)).toBe(4990)
  })
})

describe('formatPercent', () => {
  it('returns 0.0% when total is 0', () => {
    expect(formatPercent(0, 0)).toBe('0.0%')
  })
  it('formats conversion rate to 1 decimal place', () => {
    expect(formatPercent(15, 100)).toBe('15.0%')
  })
  it('rounds correctly', () => {
    expect(formatPercent(1, 3)).toBe('33.3%')
  })
})

describe('formatCurrency', () => {
  it('formats with rupee sign and Indian grouping', () => {
    expect(formatCurrency(4990)).toBe('₹4,990')
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx vitest run tests/unit/admin-utils.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/lib/admin-utils.ts`**

```typescript
/** Monthly Recurring Revenue estimate (₹499/month per Pro user). */
export function calcMRR(proCount: number): number {
  return proCount * 499
}

/** Format a fraction as a percentage with 1 decimal place. */
export function formatPercent(part: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

/** Format a number as Indian-locale rupees, e.g. 4990 → "₹4,990". */
export function formatCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}
```

- [ ] **Step 4: Run to verify 6/6 PASS**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx vitest run tests/unit/admin-utils.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: Full suite — no regressions (153 baseline)**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx vitest run 2>&1 | tail -6
```

Expected: 159 tests passing (153 + 6 new)

- [ ] **Step 6: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add src/lib/admin-utils.ts tests/unit/admin-utils.test.ts && git commit -m "feat(admin): add admin-utils pure helpers with tests"
```

---

## Chunk 2: Server-Side Helpers + API Routes

### Task 2: Server helpers — admin-auth.ts + admin-queries.ts

**Files:**
- Create: `src/lib/admin-auth.ts`
- Create: `src/lib/firebase/admin-queries.ts`

> No unit tests for these — they depend on Firebase Admin SDK which requires real credentials. TypeScript compilation is the safety net.

- [ ] **Step 1: Create `src/lib/admin-auth.ts`**

```typescript
/**
 * Server-only admin authentication helper.
 * Verifies Firebase ID token AND checks email matches ADMIN_EMAIL env var.
 * Never import in 'use client' components.
 */
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'

export interface AdminClaims {
  uid:   string
  email: string
}

/**
 * Verifies the Authorization: Bearer <token> header and confirms the
 * token belongs to the configured admin email.
 * Returns null if token is missing, invalid, or email doesn't match.
 */
export async function verifyAdminToken(req: Request): Promise<AdminClaims | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return null

  try {
    const decoded = await getAuth().verifyIdToken(token)
    if (decoded.email !== adminEmail) return null
    return { uid: decoded.uid, email: decoded.email }
  } catch {
    return null
  }
}

/** Returns a 401 JSON response for unauthorized requests. */
export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
```

- [ ] **Step 2: Create `src/lib/firebase/admin-queries.ts`**

```typescript
/**
 * Firestore Admin SDK queries for the admin panel.
 * Server-only — never import in 'use client' components.
 */
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'

function db() { return getFirestore() }

// ── User queries ──────────────────────────────────────────────────────────

export interface AdminUser {
  uid:          string
  name:         string
  email:        string | null
  phone:        string | null
  plan:         string
  trialUsed:    boolean
  createdAt:    string  // ISO string
  proSince:     string | null
  proRenewsAt:  string | null
  deletionRequested: boolean
}

/** List the 50 most-recently-signed-up users. */
export async function listUsers(): Promise<AdminUser[]> {
  const snap = await db()
    .collection('users')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  return snap.docs.map((d) => {
    const data = d.data()
    return {
      uid:               d.id,
      name:              data.name ?? '',
      email:             data.email ?? null,
      phone:             data.phone ?? null,
      plan:              data.plan ?? 'free',
      trialUsed:         data.trialUsed ?? false,
      createdAt:         (data.createdAt as Timestamp)?.toDate().toISOString() ?? '',
      proSince:          (data.proSince as Timestamp | null)?.toDate().toISOString() ?? null,
      proRenewsAt:       (data.proRenewsAt as Timestamp | null)?.toDate().toISOString() ?? null,
      deletionRequested: data.deletionRequested ?? false,
    }
  })
}

/** Manually override a user's plan (admin support action). */
export async function setUserPlan(uid: string, plan: 'free' | 'pro'): Promise<void> {
  await db().doc(`users/${uid}`).update({ plan })
}

/** Delete a user's Firestore document. Caller should also delete Firebase Auth account. */
export async function deleteUserData(uid: string): Promise<void> {
  await db().doc(`users/${uid}`).delete()
  try {
    await getAuth().deleteUser(uid)
  } catch {
    // User may not exist in Auth — ignore
  }
}

// ── Stats queries ─────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers:    number
  proUsers:      number
  freeUsers:     number
  signupsToday:  number
  signupsWeek:   number
  signupsMonth:  number
  deletionRequests: number
}

export async function getAdminStats(): Promise<AdminStats> {
  const now     = new Date()
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today.getTime() - 7  * 24 * 60 * 60 * 1000)
  const monAgo  = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [allSnap, proSnap, todaySnap, weekSnap, monthSnap, deleteSnap] = await Promise.all([
    db().collection('users').count().get(),
    db().collection('users').where('plan', '==', 'pro').count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(today)).count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(weekAgo)).count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(monAgo)).count().get(),
    db().collection('users').where('deletionRequested', '==', true).count().get(),
  ])

  const total = allSnap.data().count
  const pro   = proSnap.data().count

  return {
    totalUsers:      total,
    proUsers:        pro,
    freeUsers:       total - pro,
    signupsToday:    todaySnap.data().count,
    signupsWeek:     weekSnap.data().count,
    signupsMonth:    monthSnap.data().count,
    deletionRequests: deleteSnap.data().count,
  }
}

// ── Article queries ───────────────────────────────────────────────────────

export interface AdminArticle {
  id:         string
  category:   string
  readMinutes: number
  youtubeId:  string | null
  titleEn:    string
  titleHi:    string
  summaryEn:  string
  summaryHi:  string
  bodyEn:     string    // \n-separated paragraphs (stored as joined string for CMS textarea)
  bodyHi:     string
  published:  boolean
  createdAt:  string
}

export async function listAdminArticles(): Promise<AdminArticle[]> {
  const snap = await db().collection('articles').orderBy('createdAt', 'desc').get()
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id:          d.id,
      category:    data.category ?? 'getting_started',
      readMinutes: data.readMinutes ?? 1,
      youtubeId:   data.youtubeId ?? null,
      titleEn:     data.titleEn ?? '',
      titleHi:     data.titleHi ?? '',
      summaryEn:   data.summaryEn ?? '',
      summaryHi:   data.summaryHi ?? '',
      bodyEn:      Array.isArray(data.bodyEn) ? data.bodyEn.join('\n') : (data.bodyEn ?? ''),
      bodyHi:      Array.isArray(data.bodyHi) ? data.bodyHi.join('\n') : (data.bodyHi ?? ''),
      published:   data.published ?? true,
      createdAt:   (data.createdAt as Timestamp)?.toDate().toISOString() ?? '',
    }
  })
}

export interface ArticleInput {
  id:          string
  category:    string
  readMinutes: number
  youtubeId:   string | null
  titleEn:     string
  titleHi:     string
  summaryEn:   string
  summaryHi:   string
  bodyEn:      string   // \n-separated paragraphs
  bodyHi:      string
  published:   boolean
}

export async function createAdminArticle(input: ArticleInput): Promise<void> {
  const ref = db().doc(`articles/${input.id}`)
  await ref.set({
    ...input,
    bodyEn:    input.bodyEn.split('\n').filter(Boolean),
    bodyHi:    input.bodyHi.split('\n').filter(Boolean),
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function updateAdminArticle(id: string, input: Partial<ArticleInput>): Promise<void> {
  const data: Record<string, unknown> = { ...input }
  if (typeof input.bodyEn === 'string') data.bodyEn = input.bodyEn.split('\n').filter(Boolean)
  if (typeof input.bodyHi === 'string') data.bodyHi = input.bodyHi.split('\n').filter(Boolean)
  await db().doc(`articles/${id}`).update(data)
}

export async function deleteAdminArticle(id: string): Promise<void> {
  await db().doc(`articles/${id}`).delete()
}
```

- [ ] **Step 3: TypeScript check**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add src/lib/admin-auth.ts src/lib/firebase/admin-queries.ts && git commit -m "feat(admin): add admin-auth verifier and admin Firestore queries"
```

---

### Task 3: Stats + Users API routes

**Files:**
- Create: `src/app/api/admin/stats/route.ts`
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[uid]/plan/route.ts`
- Create: `src/app/api/admin/users/[uid]/delete/route.ts`

- [ ] **Step 1: Create `src/app/api/admin/stats/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { getAdminStats } from '@/lib/firebase/admin-queries'
import { calcMRR, formatPercent, formatCurrency } from '@/lib/admin-utils'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const stats = await getAdminStats()
  return Response.json({
    ...stats,
    mrr:            calcMRR(stats.proUsers),
    mrrFormatted:   formatCurrency(calcMRR(stats.proUsers)),
    conversionRate: formatPercent(stats.proUsers, stats.totalUsers),
  })
}
```

- [ ] **Step 2: Create `src/app/api/admin/users/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { listUsers } from '@/lib/firebase/admin-queries'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const users = await listUsers()
  return Response.json({ users })
}
```

- [ ] **Step 3: Create `src/app/api/admin/users/[uid]/plan/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { setUserPlan } from '@/lib/firebase/admin-queries'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const { uid } = await params
  const body    = await req.json() as { plan?: string }
  if (body.plan !== 'free' && body.plan !== 'pro') {
    return Response.json({ error: 'Invalid plan' }, { status: 400 })
  }
  await setUserPlan(uid, body.plan)
  return Response.json({ ok: true })
}
```

- [ ] **Step 4: Create `src/app/api/admin/users/[uid]/delete/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { deleteUserData } from '@/lib/firebase/admin-queries'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const { uid } = await params
  await deleteUserData(uid)
  return Response.json({ ok: true })
}
```

- [ ] **Step 5: TypeScript check**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add src/app/api/admin/ && git commit -m "feat(admin): add stats and user management API routes"
```

---

### Task 4: Articles API routes

**Files:**
- Create: `src/app/api/admin/articles/route.ts`
- Create: `src/app/api/admin/articles/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/admin/articles/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { listAdminArticles, createAdminArticle, type ArticleInput } from '@/lib/firebase/admin-queries'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const articles = await listAdminArticles()
  return Response.json({ articles })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const body = await req.json() as ArticleInput
  if (!body.id || !body.titleEn) {
    return Response.json({ error: 'id and titleEn are required' }, { status: 400 })
  }
  await createAdminArticle(body)
  return Response.json({ ok: true })
}
```

- [ ] **Step 2: Create `src/app/api/admin/articles/[id]/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { updateAdminArticle, deleteAdminArticle, type ArticleInput } from '@/lib/firebase/admin-queries'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const { id } = await params
  const body    = await req.json() as Partial<ArticleInput>
  await updateAdminArticle(id, body)
  return Response.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const { id } = await params
  await deleteAdminArticle(id)
  return Response.json({ ok: true })
}
```

- [ ] **Step 3: TypeScript check + full test suite**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx tsc --noEmit 2>&1 | head -20 && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx vitest run 2>&1 | tail -6
```

Expected: no TS errors, 159 tests passing

- [ ] **Step 4: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add src/app/api/admin/articles/ && git commit -m "feat(admin): add Learning Center CMS API routes"
```

---

## Chunk 3: Admin Layout + Navigation

### Task 5: Admin layout (auth guard + nav sidebar)

**Files:**
- Create: `src/app/[locale]/(admin)/layout.tsx`

The admin layout is a client component. It:
1. Uses `useAuth()` to get the current user
2. Redirects to `/{locale}/dashboard` if the user's email doesn't match `NEXT_PUBLIC_ADMIN_EMAIL`
3. Renders a simple left sidebar with nav links and `{children}` on the right

- [ ] **Step 1: Create `src/app/[locale]/(admin)/layout.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Bell, BookOpen, FileCheck, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/hooks/use-auth'

const NAV = [
  { href: '/admin',          label: 'Overview',  icon: LayoutDashboard },
  { href: '/admin/users',    label: 'Users',     icon: Users },
  { href: '/admin/alerts',   label: 'Alerts',    icon: Bell },
  { href: '/admin/learn',    label: 'Learn CMS', icon: BookOpen },
  { href: '/admin/tenders',  label: 'Tenders',   icon: FileCheck },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const params   = useParams<{ locale: string }>()
  const locale   = params.locale
  const pathname = usePathname()

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    if (loading) return
    if (!user || user.email !== adminEmail) {
      router.replace(`/${locale}/dashboard`)
    }
  }, [loading, user, adminEmail, locale, router])

  if (loading || !user || user.email !== adminEmail) return null

  return (
    <div className="min-h-screen bg-lightbg flex">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-navy text-white flex flex-col min-h-screen">
        <div className="px-4 py-5 border-b border-white/10">
          <p className="font-heading font-bold text-sm">TenderSarthi</p>
          <p className="text-xs text-white/50 mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const full    = `/${locale}${href}`
            const active  = pathname === full
            return (
              <Link
                key={href}
                href={full}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-orange text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <Link
            href={`/${locale}/dashboard`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite (159 expected)**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx vitest run 2>&1 | tail -6
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add "src/app/[locale]/(admin)/layout.tsx" && git commit -m "feat(admin): add admin layout with auth guard and nav sidebar"
```

---

## Chunk 4: Admin Pages

### Task 6: Overview Dashboard

**Files:**
- Modify: `src/app/[locale]/(admin)/admin/page.tsx`

The overview fetches stats from `/api/admin/stats` and displays them as stat cards.

- [ ] **Step 1: Replace `src/app/[locale]/(admin)/admin/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Users, TrendingUp, UserCheck, Calendar, Trash2 } from 'lucide-react'

interface Stats {
  totalUsers:      number
  proUsers:        number
  freeUsers:       number
  signupsToday:    number
  signupsWeek:     number
  signupsMonth:    number
  deletionRequests: number
  mrrFormatted:    string
  conversionRate:  string
}

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string
}) {
  return (
    <div className="bg-white border rounded-xl p-5 space-y-2">
      <div className="flex items-center gap-2 text-muted text-sm">
        <Icon size={16} />
        {label}
      </div>
      <p className="font-heading font-bold text-2xl text-navy">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}

export default function AdminOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    user.getIdToken().then((token) =>
      fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
    ).then((r) => {
      if (!r.ok) throw new Error('Failed to load stats')
      return r.json() as Promise<Stats>
    }).then(setStats).catch((e: Error) => setError(e.message))
  }, [user])

  if (error) return <p className="text-red-600 text-sm">{error}</p>
  if (!stats) return <p className="text-muted text-sm">Loading…</p>

  return (
    <div className="space-y-6">
      <h1 className="font-heading font-bold text-2xl text-navy">Overview</h1>

      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4">
        <StatCard label="Total Users"      value={stats.totalUsers}    icon={Users}      />
        <StatCard label="Pro Users"        value={stats.proUsers}      icon={UserCheck}  sub={`${stats.conversionRate} conversion`} />
        <StatCard label="Est. MRR"         value={stats.mrrFormatted}  icon={TrendingUp} />
        <StatCard label="Deletion Pending" value={stats.deletionRequests} icon={Trash2}  />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Signups Today"     value={stats.signupsToday}  icon={Calendar} />
        <StatCard label="Signups This Week" value={stats.signupsWeek}   icon={Calendar} />
        <StatCard label="Signups 30 days"   value={stats.signupsMonth}  icon={Calendar} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add "src/app/[locale]/(admin)/admin/page.tsx" && git commit -m "feat(admin): add overview dashboard with stats"
```

---

### Task 7: User Management page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/users/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/(admin)/admin/users/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Trash2, Crown } from 'lucide-react'
import type { AdminUser } from '@/lib/firebase/admin-queries'

export default function AdminUsersPage() {
  const { user }            = useAuth()
  const [users, setUsers]   = useState<AdminUser[]>([])
  const [query, setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res   = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load users')
      const data  = await res.json() as { users: AdminUser[] }
      setUsers(data.users)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTogglePlan = async (uid: string, currentPlan: string) => {
    if (!user) return
    const newPlan = currentPlan === 'pro' ? 'free' : 'pro'
    if (!confirm(`Change plan to ${newPlan}?`)) return
    const token = await user.getIdToken()
    await fetch(`/api/admin/users/${uid}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: newPlan }),
    })
    await load()
  }

  const handleDelete = async (uid: string, name: string) => {
    if (!user) return
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    const token = await user.getIdToken()
    await fetch(`/api/admin/users/${uid}/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    await load()
  }

  const filtered = users.filter((u) => {
    const q = query.toLowerCase()
    return (
      u.name.toLowerCase().includes(q)  ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.phone ?? '').includes(q)
    )
  })

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-2xl text-navy">Users</h1>
        <span className="text-sm text-muted">{users.length} loaded</span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Search name, email, phone…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-lightbg border-b">
              <tr>
                <th className="text-left px-4 py-3 text-muted font-medium">User</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Joined</th>
                <th className="text-right px-4 py-3 text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u) => (
                <tr key={u.uid} className="hover:bg-lightbg/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{u.name}</p>
                    <p className="text-xs text-muted">{u.email ?? u.phone ?? '—'}</p>
                    {u.deletionRequested && (
                      <p className="text-xs text-red-500 mt-0.5">Deletion requested</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={u.plan === 'pro' ? 'bg-orange text-white' : 'bg-gray-100 text-gray-700'}>
                      {u.plan}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleTogglePlan(u.uid, u.plan)}
                      >
                        <Crown size={12} className="mr-1" />
                        {u.plan === 'pro' ? '→ Free' : '→ Pro'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(u.uid, u.name)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add "src/app/[locale]/(admin)/admin/users/page.tsx" && git commit -m "feat(admin): add user management page with plan toggle and delete"
```

---

### Task 8: Alert System Health page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/alerts/page.tsx`

The alerts health page shows configuration and links — no separate API route needed for V1.

- [ ] **Step 1: Create `src/app/[locale]/(admin)/admin/alerts/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, Play, Rss } from 'lucide-react'

const FEEDS = [
  { name: 'NIC CPP RSS',         url: 'https://eprocure.gov.in/eprocure/app', status: 'active' },
  { name: 'GeM Scraper',         url: 'gem.gov.in',                           status: 'disabled' },
  { name: 'User-submitted queue', url: 'Firestore communityTenders',          status: 'active' },
]

export default function AdminAlertsPage() {
  const { user } = useAuth()
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)

  const handleTrigger = async () => {
    if (!user) return
    setTriggering(true)
    setTriggerMsg(null)
    try {
      const token = await user.getIdToken()
      // Call the existing alerts trigger via an admin-proxied route
      const res = await fetch('/api/admin/trigger-alerts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setTriggerMsg(res.ok ? 'Alerts triggered successfully.' : 'Trigger failed — check Vercel logs.')
    } catch {
      setTriggerMsg('Network error.')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading font-bold text-2xl text-navy">Alert System Health</h1>

      {/* Cron schedule */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-navy flex items-center gap-2">
          <Clock size={16} className="text-orange" />
          Cron Schedule
        </h2>
        <div className="flex items-center gap-3">
          <code className="text-sm bg-lightbg px-3 py-1.5 rounded font-mono">0 */6 * * *</code>
          <span className="text-sm text-muted">Every 6 hours (Vercel Pro required)</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Button
            size="sm"
            className="bg-orange text-white hover:bg-orange/90"
            disabled={triggering}
            onClick={handleTrigger}
          >
            <Play size={14} className="mr-1.5" />
            {triggering ? 'Triggering…' : 'Trigger Now'}
          </Button>
          {triggerMsg && (
            <p className="text-sm text-muted">{triggerMsg}</p>
          )}
        </div>
      </div>

      {/* Feed status */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-navy flex items-center gap-2">
          <Rss size={16} className="text-orange" />
          Feed Sources
        </h2>
        <div className="space-y-3">
          {FEEDS.map((feed) => (
            <div key={feed.name} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-navy">{feed.name}</p>
                <p className="text-xs text-muted font-mono">{feed.url}</p>
              </div>
              <Badge className={
                feed.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }>
                {feed.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-lightbg border rounded-xl p-4 flex items-start gap-2">
        <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm text-muted">
          Detailed logs are available in the Vercel dashboard under Functions → /api/alerts/trigger.
          Health data will appear here once the systemHealth Firestore integration is added.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the trigger-alerts proxy API route**

Create `src/app/api/admin/trigger-alerts/route.ts`:
```typescript
import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return Response.json({ error: 'CRON_SECRET not set' }, { status: 500 })

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/alerts/trigger`, {
    method:  'GET',
    headers: { Authorization: `Bearer ${cronSecret}` },
  })

  return Response.json({ ok: res.ok, status: res.status })
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add "src/app/[locale]/(admin)/admin/alerts/page.tsx" src/app/api/admin/trigger-alerts/ && git commit -m "feat(admin): add alert system health page and trigger proxy"
```

---

### Task 9: Learning Center CMS page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/learn/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/(admin)/admin/learn/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import type { AdminArticle, ArticleInput } from '@/lib/firebase/admin-queries'

const CATEGORIES = ['getting_started', 'bidding_strategy', 'finance_compliance', 'post_win']

const EMPTY_FORM: ArticleInput = {
  id: '', category: 'getting_started', readMinutes: 3, youtubeId: null,
  titleEn: '', titleHi: '', summaryEn: '', summaryHi: '',
  bodyEn: '', bodyHi: '', published: true,
}

export default function AdminLearnPage() {
  const { user } = useAuth()
  const [articles, setArticles] = useState<AdminArticle[]>([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState<ArticleInput | null>(null)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const getToken = async () => user!.getIdToken()

  const load = async () => {
    if (!user) return
    setLoading(true)
    const token = await getToken()
    const res   = await fetch('/api/admin/articles', { headers: { Authorization: `Bearer ${token}` } })
    const data  = await res.json() as { articles: AdminArticle[] }
    setArticles(data.articles)
    setLoading(false)
  }

  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!form || !user) return
    setSaving(true)
    setError(null)
    try {
      const token  = await getToken()
      const url    = editId ? `/api/admin/articles/${editId}` : '/api/admin/articles'
      const method = editId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Save failed')
      }
      setForm(null)
      setEditId(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Delete this article?')) return
    const token = await getToken()
    await fetch(`/api/admin/articles/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    await load()
  }

  const openEdit = (a: AdminArticle) => {
    setEditId(a.id)
    setForm({ ...a })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-2xl text-navy">Learning Center CMS</h1>
        <Button
          size="sm"
          className="bg-orange text-white hover:bg-orange/90"
          onClick={() => { setForm({ ...EMPTY_FORM }); setEditId(null) }}
        >
          <Plus size={14} className="mr-1.5" />
          New Article
        </Button>
      </div>

      {/* Form */}
      {form && (
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-navy">{editId ? 'Edit Article' : 'New Article'}</h2>
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Article ID (slug, e.g. gem-basics)" value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!editId} />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Input placeholder="Title (English)" value={form.titleEn}
              onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
            <Input placeholder="Title (Hindi)" value={form.titleHi}
              onChange={(e) => setForm({ ...form, titleHi: e.target.value })} />
            <Input placeholder="Summary (English)" value={form.summaryEn}
              onChange={(e) => setForm({ ...form, summaryEn: e.target.value })} />
            <Input placeholder="Summary (Hindi)" value={form.summaryHi}
              onChange={(e) => setForm({ ...form, summaryHi: e.target.value })} />
            <Input type="number" placeholder="Read minutes" value={form.readMinutes}
              onChange={(e) => setForm({ ...form, readMinutes: Number(e.target.value) })} />
            <Input placeholder="YouTube ID (optional)" value={form.youtubeId ?? ''}
              onChange={(e) => setForm({ ...form, youtubeId: e.target.value || null })} />
          </div>

          <textarea
            rows={5}
            placeholder="Body paragraphs (English) — one paragraph per line"
            value={form.bodyEn}
            onChange={(e) => setForm({ ...form, bodyEn: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <textarea
            rows={5}
            placeholder="Body paragraphs (Hindi) — one paragraph per line"
            value={form.bodyHi}
            onChange={(e) => setForm({ ...form, bodyHi: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />

          <div className="flex gap-2">
            <Button size="sm" className="bg-orange text-white" disabled={saving} onClick={handleSave}>
              <Check size={14} className="mr-1" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setForm(null); setEditId(null) }}>
              <X size={14} className="mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Article list */}
      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : articles.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-muted text-sm">
          No articles yet. Click "New Article" to create the first one.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-lightbg border-b">
              <tr>
                <th className="text-left px-4 py-3 text-muted font-medium">Article</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Category</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {articles.map((a) => (
                <tr key={a.id} className="hover:bg-lightbg/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{a.titleEn}</p>
                    <p className="text-xs text-muted">{a.id} · {a.readMinutes} min read</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{a.category}</td>
                  <td className="px-4 py-3">
                    <Badge className={a.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {a.published ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(a)}>
                        <Pencil size={12} />
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite + TypeScript check**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx tsc --noEmit 2>&1 | head -20 && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx vitest run 2>&1 | tail -6
```

Expected: no TS errors, 159 tests passing

- [ ] **Step 3: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add "src/app/[locale]/(admin)/admin/learn/page.tsx" && git commit -m "feat(admin): add Learning Center CMS page"
```

---

### Task 10: Community Tenders stub page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/tenders/page.tsx`

Community tender submission is not yet built in V1 — this is a placeholder with a clear "coming soon" state.

- [ ] **Step 1: Create `src/app/[locale]/(admin)/admin/tenders/page.tsx`**

```tsx
import { FileCheck, Clock } from 'lucide-react'

export default function AdminTendersPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading font-bold text-2xl text-navy">Community Tender Moderation</h1>
      <div className="bg-white border rounded-xl p-8 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 bg-lightbg rounded-full flex items-center justify-center">
          <FileCheck size={24} className="text-orange" />
        </div>
        <div>
          <h2 className="font-semibold text-navy">No submissions yet</h2>
          <p className="text-sm text-muted mt-1 max-w-sm">
            Community-submitted tenders will appear here once the vendor submission flow is built.
            Approved tenders will be broadcast to vendors with matching categories.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Clock size={12} />
          Planned for V1.1
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite (159 expected)**

```bash
export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx vitest run 2>&1 | tail -6
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add "src/app/[locale]/(admin)/admin/tenders/page.tsx" && git commit -m "feat(admin): add tenders moderation placeholder page"
```

---

## Chunk 5: Memory Update

### Task 11: Update project memory

**Files:**
- Modify: `/Users/adityaraj0421/.claude/projects/-Users-adityaraj0421-Cool-Projects-Tender/memory/project_tendersarthi.md`

- [ ] **Step 1: In the Implementation Status section, add after Subsystem 10:**

```
- Subsystem 11 (Admin Panel): ✅ Complete — 159 tests passing, 0 TS errors
```

- [ ] **Step 2: Add Subsystem 11 Key Decisions section after Subsystem 10:**

```markdown
## Subsystem 11 Key Decisions

1. Admin email check: client-side uses `NEXT_PUBLIC_ADMIN_EMAIL`; server-side API routes use `ADMIN_EMAIL` (not browser-exposed)
2. `(admin)/layout.tsx` is a client component — uses `useAuth()` + email check, redirects to `/{locale}/dashboard` if not admin
3. All admin API routes use `verifyAdminToken(req)` from `src/lib/admin-auth.ts` — verifies Firebase ID token + email check
4. User list loads 50 most recent; client-side filtering for search (Firestore doesn't support full-text search)
5. Plan toggle is a support override — does NOT create/cancel Razorpay subscription (fire-and-forget for support cases)
6. Article body stored as string[] in Firestore; admin CMS sends/receives \n-separated string (split on save, join on load)
7. Learning Center CMS writes to Firestore `articles/{id}` — does not modify static `learn-content.ts` (static data remains for now)
8. Alert "Trigger Now" proxied via `/api/admin/trigger-alerts` (admin-protected) → calls `/api/alerts/trigger` with CRON_SECRET
9. Tenders moderation page is a V1.1 placeholder — community submission flow not yet built
10. `deleteUserData` deletes Firestore doc AND Firebase Auth account (Auth deletion wrapped in try/catch in case user doesn't exist)
```

- [ ] **Step 3: No commit needed** — memory files are outside the git repo

---

## Execution Notes

**Test command:** `export PATH="/Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH" && cd "/Users/adityaraj0421/Cool Projects/Tender/app" && node /Users/adityaraj0421/.nvm/versions/node/v25.3.0/bin/npx vitest run 2>&1 | tail -6`

**TypeScript check:** same PATH + `npx tsc --noEmit 2>&1 | head -20`

**Baseline test count:** 153 (after Subsystem 10)
**Expected final count:** 159 (153 + 6 new `admin-utils` tests)

**New env vars to add to `.env.local`:**
```
NEXT_PUBLIC_ADMIN_EMAIL=founder@example.com
ADMIN_EMAIL=founder@example.com
```

**Manual verification:**
1. Set env vars, run dev server
2. Log in as the admin email → `/hi/admin` shows overview dashboard
3. Log in as any other user → `/hi/admin` immediately redirects to `/hi/dashboard`
4. API routes return 401 without Authorization header

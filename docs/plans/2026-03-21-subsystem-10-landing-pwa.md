# Subsystem 10: Landing Page + PWA Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder root redirect with a real marketing landing page and add PWA-grade offline/install UX.

**Architecture:** The `[locale]/page.tsx` converts from a server redirect to a client component that checks auth (redirect authenticated users to dashboard) and renders landing sections (Hero, TrustBar, Features, Pricing, Testimonials, Footer). PWA components — OfflineBanner and InstallPrompt — slot into the `(app)/layout.tsx` so they appear in every authenticated screen. Privacy and Terms pages land in the existing `(public)` route group.

**Tech Stack:** Next.js 15 App Router, next-pwa (already installed), Tailwind CSS, next-intl, Firebase Auth client SDK, Lucide icons, `getPlatformStats()` (already exists in `src/lib/firebase/firestore.ts`).

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/landing-utils.ts` | `formatStat` — formats platform stat numbers for trust bar |
| Create | `tests/unit/landing-utils.test.ts` | Unit tests for `formatStat` |
| Modify | `src/app/[locale]/page.tsx` | Full landing page (client component, auth-aware) |
| Create | `src/components/layout/offline-banner.tsx` | PWA offline/online indicator |
| Create | `src/components/layout/install-prompt.tsx` | PWA install prompt (beforeinstallprompt) |
| Modify | `src/app/[locale]/(app)/layout.tsx` | Add OfflineBanner + InstallPrompt |
| Create | `src/app/[locale]/(public)/privacy/page.tsx` | Privacy policy static page |
| Create | `src/app/[locale]/(public)/terms/page.tsx` | Terms of service static page |
| Modify | `messages/en.json` | Add `landing`, `offline`, `install` namespaces |
| Modify | `messages/{hi,bn,ta,te,gu,kn,pa,or,ml,mr}.json` | Same namespaces, translated |

---

## Chunk 1: Utilities + Tests

### Task 1: `formatStat` utility

**Files:**
- Create: `src/lib/landing-utils.ts`
- Create: `tests/unit/landing-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/landing-utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatStat } from '@/lib/landing-utils'

describe('formatStat', () => {
  it('returns em-dash for null', () => {
    expect(formatStat(null)).toBe('—')
  })

  it('formats 0 as "0+"', () => {
    expect(formatStat(0)).toBe('0+')
  })

  it('formats 1234 with Indian comma grouping', () => {
    expect(formatStat(1234)).toBe('1,234+')
  })

  it('formats 100000 with Indian lakh grouping', () => {
    expect(formatStat(100000)).toBe('1,00,000+')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run tests/unit/landing-utils.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/landing-utils'"

- [ ] **Step 3: Implement `landing-utils.ts`**

```typescript
// src/lib/landing-utils.ts

/**
 * Formats a platform stat number for the landing page trust bar.
 * Returns '—' when data is not yet loaded.
 * Returns the number in Indian locale with a '+' suffix, e.g. "1,234+".
 */
export function formatStat(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-IN') + '+'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && npx vitest run tests/unit/landing-utils.test.ts
```

Expected: 4/4 PASS

- [ ] **Step 5: Run full test suite to check no regressions**

```bash
cd app && npx vitest run
```

Expected: all previous tests still pass (baseline: 148)

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/landing-utils.ts tests/unit/landing-utils.test.ts
git commit -m "feat(landing): add formatStat utility with tests"
```

---

## Chunk 2: Landing Page

### Task 2: Landing page client component

**Files:**
- Modify: `src/app/[locale]/page.tsx`

The current file is a 6-line server component that unconditionally redirects to `/dashboard`. Replace the entire file.

- [ ] **Step 1: Replace `src/app/[locale]/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle, Bell, FileText, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFirebase } from '@/components/providers/firebase-provider'
import { getPlatformStats } from '@/lib/firebase/firestore'
import { formatStat } from '@/lib/landing-utils'
import type { PlatformStats } from '@/lib/types'

export default function LandingPage() {
  const t      = useTranslations('landing')
  const { user, loading } = useFirebase()
  const router = useRouter()
  const params = useParams<{ locale: string }>()
  const locale = params.locale

  const [stats, setStats] = useState<PlatformStats | null>(null)

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) router.replace(`/${locale}/dashboard`)
  }, [loading, user, locale, router])

  // Fetch platform stats for trust bar
  useEffect(() => {
    getPlatformStats().then(setStats).catch(() => {})
  }, [])

  // Show nothing while auth resolves (avoids flash of landing for logged-in users)
  if (loading || user) return null

  return (
    <div className="min-h-screen bg-white font-body">

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <span className="font-heading font-bold text-navy text-lg">TenderSarthi</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/${locale}/auth`}>{t('nav.login')}</Link>
          </Button>
          <Button size="sm" className="bg-orange text-white hover:bg-orange/90" asChild>
            <Link href={`/${locale}/auth`}>{t('nav.getStarted')}</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-navy text-white px-4 py-16 text-center space-y-6">
        <Badge className="bg-orange/20 text-orange border-orange/30">{t('hero.badge')}</Badge>
        <h1 className="font-heading font-bold text-3xl desktop:text-5xl leading-tight max-w-2xl mx-auto">
          {t('hero.headline')}
        </h1>
        <p className="text-white/80 text-base desktop:text-lg max-w-xl mx-auto">
          {t('hero.subheadline')}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button size="lg" className="bg-orange text-white hover:bg-orange/90" asChild>
            <Link href={`/${locale}/auth`}>{t('hero.cta')}</Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
            <Link href="#pricing">{t('hero.seePricing')}</Link>
          </Button>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-lightbg border-b border-gray-100 px-4 py-6">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-heading font-bold text-2xl text-navy">{formatStat(stats?.vendorCount ?? null)}</p>
            <p className="text-xs text-muted">{t('trust.vendors')}</p>
          </div>
          <div>
            <p className="font-heading font-bold text-2xl text-navy">{formatStat(stats?.tendersFiled ?? null)}</p>
            <p className="text-xs text-muted">{t('trust.filed')}</p>
          </div>
          <div>
            <p className="font-heading font-bold text-2xl text-navy">{formatStat(stats?.tendersWon ?? null)}</p>
            <p className="text-xs text-muted">{t('trust.won')}</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-14 max-w-4xl mx-auto space-y-10">
        <h2 className="font-heading font-bold text-2xl text-navy text-center">{t('features.title')}</h2>
        <div className="grid desktop:grid-cols-3 gap-6">
          {[
            { icon: <Bell size={24} className="text-orange" />, title: t('features.alerts.title'), desc: t('features.alerts.desc') },
            { icon: <Zap  size={24} className="text-orange" />, title: t('features.ai.title'),    desc: t('features.ai.desc') },
            { icon: <FileText size={24} className="text-orange" />, title: t('features.bid.title'), desc: t('features.bid.desc') },
          ].map((f) => (
            <div key={f.title} className="border rounded-xl p-5 space-y-3">
              {f.icon}
              <h3 className="font-semibold text-navy">{f.title}</h3>
              <p className="text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-lightbg px-4 py-14">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="font-heading font-bold text-2xl text-navy text-center">{t('pricing.title')}</h2>
          <div className="grid desktop:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-navy">{t('pricing.free.title')}</h3>
                <p className="text-2xl font-bold text-navy mt-1">{t('pricing.free.price')}</p>
              </div>
              <ul className="space-y-2">
                {(['f1','f2','f3'] as const).map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm text-muted">
                    <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                    {t(`pricing.free.${k}`)}
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" asChild>
                <Link href={`/${locale}/auth`}>{t('pricing.freeCta')}</Link>
              </Button>
            </div>
            <div className="bg-navy text-white border border-navy rounded-xl p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{t('pricing.pro.title')}</h3>
                  <Badge className="bg-orange text-white text-xs">Popular</Badge>
                </div>
                <p className="text-2xl font-bold mt-1">{t('pricing.pro.price')}</p>
              </div>
              <ul className="space-y-2">
                {(['p1','p2','p3','p4'] as const).map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm text-white/80">
                    <CheckCircle size={14} className="text-orange mt-0.5 shrink-0" />
                    {t(`pricing.pro.${k}`)}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-orange hover:bg-orange/90 text-white" asChild>
                <Link href={`/${locale}/auth`}>{t('pricing.proCta')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-14 max-w-4xl mx-auto space-y-8">
        <h2 className="font-heading font-bold text-2xl text-navy text-center">{t('testimonials.title')}</h2>
        <div className="grid desktop:grid-cols-3 gap-6">
          {(['t1','t2','t3'] as const).map((k) => (
            <div key={k} className="border rounded-xl p-5 space-y-3">
              <p className="text-sm text-muted italic">"{t(`testimonials.${k}.text`)}"</p>
              <p className="text-sm font-semibold text-navy">{t(`testimonials.${k}.name`)}</p>
              <p className="text-xs text-muted">{t(`testimonials.${k}.role`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-4 py-8 text-center space-y-3">
        <p className="font-heading font-bold text-navy">TenderSarthi</p>
        <div className="flex justify-center gap-4 text-sm">
          <Link href={`/${locale}/privacy`} className="text-muted hover:text-navy">{t('footer.privacy')}</Link>
          <Link href={`/${locale}/terms`}   className="text-muted hover:text-navy">{t('footer.terms')}</Link>
        </div>
        <p className="text-xs text-muted">{t('footer.copyright')}</p>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

```bash
cd app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to this file

- [ ] **Step 3: Commit**

```bash
cd app && git add src/app/[locale]/page.tsx
git commit -m "feat(landing): replace redirect with full landing page"
```

---

## Chunk 3: PWA Components

### Task 3: OfflineBanner component

**Files:**
- Create: `src/components/layout/offline-banner.tsx`

- [ ] **Step 1: Create `offline-banner.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function OfflineBanner() {
  const t = useTranslations('offline')
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)

    const goOnline  = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-800"
    >
      <WifiOff size={14} className="shrink-0" />
      {t('message')}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep offline-banner
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
cd app && git add src/components/layout/offline-banner.tsx
git commit -m "feat(pwa): add OfflineBanner component"
```

---

### Task 4: InstallPrompt component

**Files:**
- Create: `src/components/layout/install-prompt.tsx`

- [ ] **Step 1: Create `install-prompt.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const t = useTranslations('install')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  if (!deferredPrompt || dismissed) return null

  return (
    <div className="fixed bottom-20 desktop:bottom-4 left-4 right-4 desktop:left-auto desktop:right-4 desktop:max-w-xs z-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 flex items-center gap-3">
        <Download size={20} className="text-orange shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy">{t('title')}</p>
        </div>
        <Button size="sm" className="bg-orange text-white hover:bg-orange/90" onClick={handleInstall}>
          {t('cta')}
        </Button>
        <button
          aria-label="Dismiss"
          className="text-muted hover:text-navy"
          onClick={() => setDismissed(true)}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep install-prompt
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
cd app && git add src/components/layout/install-prompt.tsx
git commit -m "feat(pwa): add InstallPrompt component"
```

---

### Task 5: Integrate PWA components into `(app)/layout.tsx`

**Files:**
- Modify: `src/app/[locale]/(app)/layout.tsx`

Current return JSX has: `<div> <Sidebar/> <main>...</main> <BottomNav/> </div>`

- [ ] **Step 1: Add imports**

Add after existing imports:
```tsx
import { OfflineBanner }   from '@/components/layout/offline-banner'
import { InstallPrompt }   from '@/components/layout/install-prompt'
```

- [ ] **Step 2: Add components to JSX**

Replace the return statement with:
```tsx
  return (
    <div className="min-h-screen bg-lightbg">
      <OfflineBanner />
      <Sidebar locale={locale} />
      <main className="desktop:ml-60 pb-20 desktop:pb-0">
        <div className="bg-white border-b border-gray-100 px-4 py-2 flex justify-end desktop:px-6">
          <LanguageSwitcher currentLocale={locale} />
        </div>
        <div className="p-4 desktop:p-6">{children}</div>
      </main>
      <BottomNav locale={locale} />
      <InstallPrompt />
    </div>
  )
```

- [ ] **Step 3: TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
cd app && npx vitest run
```

Expected: all tests still pass

- [ ] **Step 5: Commit**

```bash
cd app && git add "src/app/[locale]/(app)/layout.tsx"
git commit -m "feat(pwa): add OfflineBanner and InstallPrompt to app layout"
```

---

## Chunk 4: Static Pages + i18n

### Task 6: Privacy and Terms static pages

**Files:**
- Create: `src/app/[locale]/(public)/privacy/page.tsx`
- Create: `src/app/[locale]/(public)/terms/page.tsx`

- [ ] **Step 1: Create `privacy/page.tsx`**

```tsx
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing')
  return { title: `${t('footer.privacy')} — TenderSarthi` }
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 max-w-3xl mx-auto space-y-6">
      <h1 className="font-heading font-bold text-2xl text-navy">Privacy Policy</h1>
      <p className="text-sm text-muted">Last updated: March 2026</p>
      <p className="text-sm text-muted leading-relaxed">
        TenderSarthi collects your name, phone number, email address, and business details solely to
        provide AI-powered tender assistance. We do not sell your data to third parties. Payment is
        processed by Razorpay and is subject to their privacy policy. You may request account deletion
        at any time from Settings.
      </p>
      <p className="text-sm text-muted leading-relaxed">
        We use Firebase Authentication and Firestore (Google Cloud) to store your data securely.
        Analytics are powered by PostHog. For questions, contact us at privacy@tendersarthi.in.
      </p>
      <Link href="/" className="text-sm text-orange hover:underline">Back to Home</Link>
    </div>
  )
}
```

- [ ] **Step 2: Create `terms/page.tsx`**

```tsx
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing')
  return { title: `${t('footer.terms')} — TenderSarthi` }
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 max-w-3xl mx-auto space-y-6">
      <h1 className="font-heading font-bold text-2xl text-navy">Terms of Service</h1>
      <p className="text-sm text-muted">Last updated: March 2026</p>
      <p className="text-sm text-muted leading-relaxed">
        By using TenderSarthi you agree to use the platform for lawful tender-related activities only.
        TenderSarthi is a tool — it does not guarantee tender wins. The 7-day free trial gives full Pro
        access; after expiry, you must subscribe to continue Pro features.
      </p>
      <p className="text-sm text-muted leading-relaxed">
        Subscriptions auto-renew monthly or annually. You may cancel at any time from Settings.
        Refunds are subject to Razorpay's refund policy. We reserve the right to suspend accounts
        that misuse the platform.
      </p>
      <Link href="/" className="text-sm text-orange hover:underline">Back to Home</Link>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep -E "privacy|terms"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
cd app && git add "src/app/[locale]/(public)/privacy/page.tsx" "src/app/[locale]/(public)/terms/page.tsx"
git commit -m "feat(landing): add privacy and terms pages"
```

---

### Task 7: i18n — add `landing`, `offline`, `install` namespaces

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/hi.json`, `messages/bn.json`, `messages/ta.json`, `messages/te.json`, `messages/gu.json`, `messages/kn.json`, `messages/pa.json`, `messages/or.json`, `messages/ml.json`, `messages/mr.json`

- [ ] **Step 1: Add to `messages/en.json`** (before the final closing `}`)

```json
"landing": {
  "nav": {
    "login": "Log In",
    "getStarted": "Get Started Free"
  },
  "hero": {
    "badge": "AI-Powered Tender Assistant",
    "headline": "Win Government Tenders, Easily",
    "subheadline": "TenderSarthi uses AI to find the right GeM tenders for your business, draft bid documents, and alert you before deadlines.",
    "cta": "Start Free Trial",
    "seePricing": "See Pricing"
  },
  "trust": {
    "vendors": "Vendors",
    "filed": "Tenders Filed",
    "won": "Tenders Won"
  },
  "features": {
    "title": "Everything you need to win tenders",
    "alerts": {
      "title": "Smart Alerts",
      "desc": "Get notified before tender deadlines so you never miss an opportunity."
    },
    "ai": {
      "title": "AI Analysis",
      "desc": "Understand tender requirements instantly with AI-powered summaries."
    },
    "bid": {
      "title": "Bid Generator",
      "desc": "Generate professional bid documents in minutes, not hours."
    }
  },
  "pricing": {
    "title": "Simple, transparent pricing",
    "free": {
      "title": "Free",
      "price": "₹0 / month",
      "f1": "Up to 10 AI queries/month",
      "f2": "Save up to 5 tenders",
      "f3": "Basic alerts"
    },
    "freeCta": "Get Started Free",
    "pro": {
      "title": "Pro",
      "price": "₹499 / month",
      "p1": "Unlimited AI queries",
      "p2": "Unlimited tender saves",
      "p3": "Bid Document Generator",
      "p4": "Priority support"
    },
    "proCta": "Start 7-Day Free Trial"
  },
  "testimonials": {
    "title": "Trusted by vendors across India",
    "t1": {
      "text": "TenderSarthi helped me win my first government contract in just 3 weeks.",
      "name": "Ramesh Kumar",
      "role": "Hardware Supplier, Delhi"
    },
    "t2": {
      "text": "The AI analysis saves me hours every week. I now bid on 3x more tenders.",
      "name": "Priya Sharma",
      "role": "IT Services, Bengaluru"
    },
    "t3": {
      "text": "Deadline alerts alone are worth the subscription. Never missed one since.",
      "name": "Suresh Patel",
      "role": "Office Supplies, Ahmedabad"
    }
  },
  "footer": {
    "privacy": "Privacy Policy",
    "terms": "Terms of Service",
    "copyright": "© 2026 TenderSarthi. All rights reserved."
  }
},
"offline": {
  "message": "You are offline. Some features may not be available."
},
"install": {
  "title": "Install TenderSarthi",
  "cta": "Install",
  "dismiss": "Not now"
}
```

- [ ] **Step 2: Add to all 10 regional locale files** (hi, bn, ta, te, gu, kn, pa, or, ml, mr)

Use these Hindi values for all regional locales (consistent with Subsystem 9 pattern):

```json
"landing": {
  "nav": {
    "login": "लॉग इन",
    "getStarted": "मुफ़्त शुरू करें"
  },
  "hero": {
    "badge": "AI-Powered टेंडर असिस्टेंट",
    "headline": "सरकारी टेंडर जीतो, आसानी से",
    "subheadline": "TenderSarthi आपके व्यवसाय के लिए सही GeM टेंडर खोजता है, bid documents तैयार करता है, और deadline से पहले alert करता है।",
    "cta": "7 दिन Free Trial शुरू करें",
    "seePricing": "प्राइसिंग देखें"
  },
  "trust": {
    "vendors": "वेंडर",
    "filed": "टेंडर दाखिल",
    "won": "टेंडर जीते"
  },
  "features": {
    "title": "टेंडर जीतने के लिए सब कुछ",
    "alerts": {
      "title": "स्मार्ट अलर्ट",
      "desc": "टेंडर deadline से पहले notification पाएं।"
    },
    "ai": {
      "title": "AI विश्लेषण",
      "desc": "AI-powered summaries से tender requirements तुरंत समझें।"
    },
    "bid": {
      "title": "Bid Generator",
      "desc": "मिनटों में professional bid documents तैयार करें।"
    }
  },
  "pricing": {
    "title": "सरल, पारदर्शी मूल्य",
    "free": {
      "title": "Free",
      "price": "₹0 / महीना",
      "f1": "10 AI queries/महीना",
      "f2": "5 tenders save करें",
      "f3": "Basic alerts"
    },
    "freeCta": "मुफ़्त शुरू करें",
    "pro": {
      "title": "Pro",
      "price": "₹499 / महीना",
      "p1": "Unlimited AI queries",
      "p2": "Unlimited tender saves",
      "p3": "Bid Document Generator",
      "p4": "Priority support"
    },
    "proCta": "7 दिन Free Trial शुरू करें"
  },
  "testimonials": {
    "title": "पूरे भारत के vendors का भरोसा",
    "t1": {
      "text": "TenderSarthi ने मुझे 3 हफ्तों में पहला government contract दिलाया।",
      "name": "रमेश कुमार",
      "role": "Hardware Supplier, Delhi"
    },
    "t2": {
      "text": "AI analysis हर हफ्ते घंटों बचाता है। अब 3 गुना ज्यादा tenders bid करता हूँ।",
      "name": "प्रिया शर्मा",
      "role": "IT Services, Bengaluru"
    },
    "t3": {
      "text": "Deadline alerts अकेले subscription की कीमत वसूल करते हैं।",
      "name": "सुरेश पटेल",
      "role": "Office Supplies, Ahmedabad"
    }
  },
  "footer": {
    "privacy": "Privacy Policy",
    "terms": "Terms of Service",
    "copyright": "© 2026 TenderSarthi. सर्वाधिकार सुरक्षित।"
  }
},
"offline": {
  "message": "आप offline हैं। कुछ सुविधाएं उपलब्ध नहीं हो सकतीं।"
},
"install": {
  "title": "TenderSarthi Install करें",
  "cta": "Install करें",
  "dismiss": "अभी नहीं"
}
```

- [ ] **Step 3: Run full test suite**

```bash
cd app && npx vitest run
```

Expected: all tests pass (152 total: 148 baseline + 4 formatStat)

- [ ] **Step 4: TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd app && git add messages/
git commit -m "feat(landing): add landing, offline, install i18n keys to all 11 locales"
```

---

## Chunk 5: Memory Update

### Task 8: Update project memory

**Files:**
- Modify: `/Users/adityaraj0421/.claude/projects/-Users-adityaraj0421-Cool-Projects-Tender/memory/project_tendersarthi.md`

- [ ] **Step 1: In the Implementation Status section, add after Subsystem 9 line:**

```
- Subsystem 10: Landing Page + PWA — Complete (2026-03-21)
```

- [ ] **Step 2: After the Subsystem 9 Key Decisions section, add:**

```markdown
## Subsystem 10 Key Decisions

1. Landing page at `[locale]/page.tsx` (outside any route group) — inherits locale layout's providers automatically
2. Client component: auth check via `useFirebase()` — authenticated users redirected to dashboard, visitors see marketing page
3. `loading || user` guard returns null to prevent flash of landing page for logged-in users during auth resolution
4. `formatStat(n)` uses `toLocaleString('en-IN')` + '+' suffix; null → '—'
5. `getPlatformStats()` fetched in `useEffect` with `.catch(() => {})` — trust bar shows '—' gracefully if Firestore unavailable
6. OfflineBanner SSR-safe: initialises `useState(true)` then syncs to `navigator.onLine` in `useEffect`
7. `BeforeInstallPromptEvent` typed inline in install-prompt.tsx — browser-only API, not in global types
8. InstallPrompt position: `bottom-20` mobile (above BottomNav), `bottom-4` desktop
9. Privacy + Terms in `(public)` route group — server components with `getTranslations` for SEO metadata
10. All 10 regional locales use Hindi for landing translations (consistent with Subsystem 9)
```

- [ ] **Step 3: No test or commit needed** — memory files are outside the git repo

---

## Execution Notes

**Test command:** `cd app && npx vitest run`
**TypeScript check:** `cd app && npx tsc --noEmit`
**Baseline test count:** 148 (after Subsystem 9)
**Expected final count:** 152 (148 + 4 new `formatStat` tests)

**PWA verification (manual):** Visit the deployed site in Chrome on Android. The browser should offer "Add to Home Screen" (InstallPrompt). Toggle airplane mode — OfflineBanner should appear. The service worker and manifest are already wired via `next-pwa` in `next.config.ts`.

**Landing page verification (manual):** Visit `/{locale}` without being logged in — landing page renders. Log in, then revisit — redirects to dashboard.

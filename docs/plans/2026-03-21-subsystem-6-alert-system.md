# Subsystem 6 — Alert System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build TenderSarthi's alert system — NIC/CPP RSS feed parsing, tender-matching against user alert configs, push/WhatsApp/email notification delivery, document expiry alerts, alert configuration UI, and Vercel Cron scheduling.

**Architecture:** A Vercel Cron job hits `/api/alerts/trigger` every 6 hours; the route fetches RSS feeds, parses them into `ParsedTender` objects, loads all active user `alertConfigs` from Firestore (Admin SDK), finds matches, and delivers notifications via FCM (push), MSG91 (WhatsApp), and Resend (email). A separate UI at `/alerts` lets Pro users configure their categories, states, keywords, and delivery channels. Document expiry alerts (≤30 days) run in the same trigger pass.

**Tech Stack:** Next.js 16.2 API routes · Firebase Admin Messaging (FCM) · `rss-parser` · `resend` SDK · MSG91 REST API · Vercel Cron · next-intl v4.8.3 · Vitest

---

## Scope Notes (Deferred)

- **GeM portal scraper** — grey zone; implemented as a disabled stub (`ENABLE_GEM_SCRAPER=true` env var enables it). Subsystem 11 (Admin Panel) adds a toggle UI.
- **User-submitted tender broadcasting** — requires admin moderation; deferred to Subsystem 11.
- **Admin alert health screen** (`/admin/alerts`) — Subsystem 11.
- **Full alert history feed on dashboard** — deferred; dashboard shows alert status badge only.
- **WhatsApp template pre-approval** — Meta Business API template approval takes days. Plan includes the API call structure with a placeholder `MSG91_TEMPLATE_ID`. Alerts send silently if `MSG91_TEMPLATE_ID` env var is not set.
- **Algolia alert index sync** — alert configs live in Firestore only; no Algolia sync needed.
- **`expiryAlertSent` field for existing vault documents** — field is added to `VaultDocument` interface here; existing Firestore documents without the field are treated as `false` (Firestore returns them in the ≤30-day query, code filters in memory).

## `alertConfigs` Firestore Path Decision

PRD schema shows `alerts/{alertId}` (multi-doc per user). This plan uses `alertConfigs/{uid}` (uid as doc ID, one config per user) for simplicity. The PRD allows multiple saved alert profiles per user as a future enhancement — the schema is compatible (just one doc per user for V1). This deviation is intentional.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/alert-utils.ts` | Create | Pure: `parseRSSItem`, `matchesAlertConfig`, `formatAlertMessage`, `AlertConfig`, `ParsedTender` |
| `tests/unit/alert-utils.test.ts` | Create | 17 unit tests (TDD) |
| `src/lib/types.ts` | Modify | Add `AlertConfig` interface; add `expiryAlertSent: boolean` to `VaultDocument` |
| `src/lib/constants.ts` | Modify | Add `CATEGORY_KEYWORDS: Record<GeMCategory, string[]>` for RSS text extraction |
| `src/lib/firebase/firestore.ts` | Modify | Add `saveAlertConfig`, `getAlertConfig`, `subscribeAlertConfig` (client) |
| `firestore.rules` | Modify | Add `alertConfigs` collection rules |
| `src/lib/notifications/send-fcm.ts` | Create | `sendFCMAlert(fcmToken, payload)` via Firebase Admin Messaging |
| `src/lib/notifications/send-whatsapp.ts` | Create | `sendWhatsAppAlert(phone, message)` via MSG91 REST API |
| `src/lib/notifications/send-alert-email.ts` | Create | `sendAlertEmail(email, payload)` via Resend SDK |
| `src/app/api/alerts/trigger/route.ts` | Create | GET: CRON_SECRET-protected; RSS fetch + match + notify + expiry check |
| `src/lib/hooks/use-alert-config.ts` | Create | Real-time hook returning `{ config, loading, save }` |
| `src/components/alerts/alert-config-form.tsx` | Create | Categories, states, keywords, channel toggles, save |
| `src/app/[locale]/(app)/alerts/page.tsx` | Modify | Replace placeholder with Pro-gated alert config page |
| `vercel.json` | Create | Cron job: `GET /api/alerts/trigger` every 6 hours |
| `messages/*.json` (11 files) | Modify | Add `alerts.*` namespace |

---

## Chunk 1: Foundation — Types, Utils, Firestore

### Task 1: `alert-utils.ts` + 17 unit tests (TDD)

**Files:**
- Create: `src/lib/alert-utils.ts`
- Modify: `src/lib/constants.ts`
- Create: `tests/unit/alert-utils.test.ts`

**Step 1: Add `CATEGORY_KEYWORDS` to `src/lib/constants.ts`**

- [ ] Open `src/lib/constants.ts` and append at the end:

```typescript
// Keywords used to extract categories from RSS feed text
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Transport & Vehicles':           ['vehicle', 'transport', 'car', 'bus', 'truck', 'hiring', 'fleet'],
  'IT & Electronics':               ['computer', 'laptop', 'software', 'it ', 'electronics', 'hardware', 'server'],
  'Medical & Healthcare':           ['medical', 'health', 'hospital', 'medicine', 'surgical', 'ambulance'],
  'Construction & Infrastructure':  ['construction', 'civil', 'road', 'building', 'infrastructure', 'bridge'],
  'Stationery & Office Supplies':   ['stationery', 'paper', 'office supply', 'printing press', 'toner'],
  'Furniture & Fixtures':           ['furniture', 'chair', 'table', 'cabinet', 'workstation'],
  'Uniforms & Clothing':            ['uniform', 'clothing', 'garment', 'textile', 'fabric'],
  'Agriculture & Food':             ['agriculture', 'food', 'grain', 'seed', 'fertilizer', 'ration'],
  'Security Services':              ['security', 'guard', 'cctv', 'surveillance', 'watchman'],
  'Printing & Publishing':          ['printing', 'publication', 'book', 'diary', 'calendar'],
  'Electrical & Lighting':          ['electrical', 'lighting', 'led', 'wiring', 'transformer'],
  'Plumbing & Sanitation':          ['plumbing', 'sanitation', 'pipe', 'drainage', 'water supply'],
  'Cleaning & Housekeeping':        ['cleaning', 'housekeeping', 'janitorial', 'sweeping', 'sanitation'],
  'Other':                          [],
}
```

**Step 2: Write the test file first**

- [ ] Create `tests/unit/alert-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseRSSItem, matchesAlertConfig, formatAlertMessage } from '@/lib/alert-utils'
import type { AlertConfig } from '@/lib/alert-utils'

const baseConfig: AlertConfig = {
  userId: 'uid1',
  categories: ['Transport & Vehicles'],
  states: ['Maharashtra'],
  keywords: [],
  channels: { push: true, whatsapp: false, email: false },
  active: true,
}

describe('parseRSSItem', () => {
  it('extracts title and link from item', () => {
    const result = parseRSSItem({ title: 'Bus Hiring — Pune', link: 'https://example.com/tender/1', contentSnippet: '', pubDate: '2026-03-21' })
    expect(result.title).toBe('Bus Hiring — Pune')
    expect(result.link).toBe('https://example.com/tender/1')
  })

  it('detects Maharashtra in text', () => {
    const result = parseRSSItem({ title: 'Vehicle Hire Maharashtra', link: '', contentSnippet: '', pubDate: '2026-03-21' })
    expect(result.states).toContain('Maharashtra')
  })

  it('detects Transport & Vehicles category from keyword "vehicle"', () => {
    const result = parseRSSItem({ title: 'Vehicle Hiring Contract', link: '', contentSnippet: '', pubDate: '2026-03-21' })
    expect(result.categories).toContain('Transport & Vehicles')
  })

  it('detects IT category from keyword "laptop"', () => {
    const result = parseRSSItem({ title: 'Laptop Procurement', link: '', contentSnippet: '', pubDate: '2026-03-21' })
    expect(result.categories).toContain('IT & Electronics')
  })

  it('handles missing pubDate gracefully', () => {
    const result = parseRSSItem({ title: 'Test', link: '', contentSnippet: '', pubDate: undefined })
    expect(result.pubDate).toBeInstanceOf(Date)
  })

  it('handles missing title and contentSnippet', () => {
    const result = parseRSSItem({ title: undefined, link: '', contentSnippet: undefined, pubDate: undefined })
    expect(result.title).toBe('')
    expect(result.description).toBe('')
  })
})

describe('matchesAlertConfig', () => {
  const tender = {
    title: 'Bus Hiring Contract',
    link: 'https://example.com/1',
    description: 'Maharashtra vehicle hiring',
    pubDate: new Date(),
    categories: ['Transport & Vehicles'],
    states: ['Maharashtra'],
  }

  it('returns true when category and state match', () => {
    expect(matchesAlertConfig(tender, baseConfig)).toBe(true)
  })

  it('returns false when config is not active', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, active: false })).toBe(false)
  })

  it('returns true when categories is empty (match all)', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, categories: [] })).toBe(true)
  })

  it('returns true when states is empty (match all)', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, states: [] })).toBe(true)
  })

  it('returns false when state does not match', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, states: ['Gujarat'] })).toBe(false)
  })

  it('returns false when category does not match', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, categories: ['IT & Electronics'] })).toBe(false)
  })

  it('returns true when keyword matches title', () => {
    const config = { ...baseConfig, keywords: ['bus hiring'] }
    expect(matchesAlertConfig(tender, config)).toBe(true)
  })

  it('returns false when keywords provided but none match', () => {
    const config = { ...baseConfig, keywords: ['laptop', 'printer'] }
    expect(matchesAlertConfig(tender, config)).toBe(false)
  })

  it('returns true when keywords empty (match all)', () => {
    expect(matchesAlertConfig(tender, { ...baseConfig, keywords: [] })).toBe(true)
  })
})

describe('formatAlertMessage', () => {
  it('returns a non-empty string with the tender title', () => {
    const msg = formatAlertMessage({ title: 'Bus Hiring Bihar', link: 'https://example.com', description: '', pubDate: new Date(), categories: [], states: [] })
    expect(msg).toContain('Bus Hiring Bihar')
  })

  it('includes the link', () => {
    const msg = formatAlertMessage({ title: 'Test', link: 'https://example.com/tender/123', description: '', pubDate: new Date(), categories: [], states: [] })
    expect(msg).toContain('https://example.com/tender/123')
  })
})
```

- [ ] Run tests to confirm they fail:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run tests/unit/alert-utils.test.ts 2>&1 | tail -10
  ```
  Expected: FAIL with "Cannot find module '@/lib/alert-utils'"

**Step 3: Create `src/lib/alert-utils.ts`**

- [ ] Create `src/lib/alert-utils.ts`:

```typescript
import { CATEGORY_KEYWORDS, INDIAN_STATES } from './constants'
// AlertConfig is defined in types.ts (canonical location); imported here for use in matching logic
import type { AlertConfig } from './types'

export type { AlertConfig }  // re-export so test imports can use @/lib/alert-utils

export interface ParsedTender {
  title: string
  link: string
  description: string
  pubDate: Date
  categories: string[]
  states: string[]
}

/** Convert an RSS feed item into a structured ParsedTender. */
export function parseRSSItem(item: {
  title?: string
  link?: string
  contentSnippet?: string
  pubDate?: string
}): ParsedTender {
  const title = item.title ?? ''
  const description = item.contentSnippet ?? ''
  const text = (title + ' ' + description).toLowerCase()

  // Extract matching states
  const states = INDIAN_STATES.filter(s => text.includes(s.toLowerCase()))

  // Extract matching categories from keywords
  const categories = Object.entries(CATEGORY_KEYWORDS)
    .filter(([, keywords]) => keywords.some(k => text.includes(k.toLowerCase())))
    .map(([cat]) => cat)

  return {
    title,
    link: item.link ?? '',
    description,
    pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
    categories,
    states,
  }
}

/** Returns true if this tender should trigger an alert for the given config. */
export function matchesAlertConfig(tender: ParsedTender, config: AlertConfig): boolean {
  if (!config.active) return false

  const titleLower = (tender.title + ' ' + tender.description).toLowerCase()

  // Empty arrays mean "match all" for that dimension
  const categoryMatch =
    config.categories.length === 0 ||
    config.categories.some(c => tender.categories.includes(c))

  const stateMatch =
    config.states.length === 0 ||
    config.states.some(s => tender.states.includes(s))

  const keywordMatch =
    config.keywords.length === 0 ||
    config.keywords.some(k => titleLower.includes(k.toLowerCase()))

  return categoryMatch && stateMatch && keywordMatch
}

/** Format a WhatsApp/push alert message for a matched tender. */
export function formatAlertMessage(tender: ParsedTender): string {
  return `नया Tender मिला! 🎯\n${tender.title}\n${tender.link}`
}
```

- [ ] Run tests to confirm all 17 pass:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run tests/unit/alert-utils.test.ts 2>&1 | tail -20
  ```
  Expected: 17 passed

- [ ] Verify TypeScript:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -30
  ```

- [ ] Commit:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add src/lib/alert-utils.ts src/lib/constants.ts tests/unit/alert-utils.test.ts && git commit -m "feat(alerts): add alert-utils pure functions + 17 unit tests"
  ```

---

### Task 2: `AlertConfig` type + Firestore + security rules

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/firebase/firestore.ts`
- Modify: `firestore.rules`

**Step 1: Update types**

- [ ] Open `src/lib/types.ts` and:

  1. Find the `VaultDocument` interface and add `expiryAlertSent: boolean` field (after `updatedAt: Timestamp`):
  ```typescript
  expiryAlertSent: boolean  // true once 30-day expiry alert has been sent
  ```

  2. Append at the end of the file:
  ```typescript
  export interface AlertConfig {
    userId: string
    categories: string[]
    states: string[]
    keywords: string[]
    channels: {
      push: boolean
      whatsapp: boolean
      email: boolean
    }
    active: boolean
    createdAt: Timestamp
  }
  ```

  > Note: `Timestamp` is already imported from `'firebase/firestore'` in this file.

**Step 2: Add Firestore functions**

- [ ] Open `src/lib/firebase/firestore.ts` and find the existing import line that imports from `'../types'` (e.g., where `BidDocument` is imported). Add `AlertConfig` to that same import line. Do **NOT** add a second `import type { AlertConfig }` line — TypeScript rejects duplicate imports.

- [ ] Append at the end of `src/lib/firebase/firestore.ts`:

```typescript
// ---------- Alert Config ----------

/** Create or overwrite a user's alert config (one config per user). */
export async function saveAlertConfig(
  uid: string,
  config: Omit<AlertConfig, 'userId' | 'createdAt'>
): Promise<void> {
  const ref = doc(db, 'alertConfigs', uid)
  await setDoc(ref, {
    ...config,
    userId: uid,
    createdAt: serverTimestamp(),
  })
}

/** Fetch a user's alert config once. Returns null if not configured yet. */
export async function getAlertConfig(uid: string): Promise<AlertConfig | null> {
  const snap = await getDoc(doc(db, 'alertConfigs', uid))
  if (!snap.exists()) return null
  return { ...(snap.data() as AlertConfig) }
}

/** Real-time listener for a user's alert config. */
export function subscribeAlertConfig(
  uid: string,
  onData: (config: AlertConfig | null) => void,
  onError: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'alertConfigs', uid),
    snap => onData(snap.exists() ? (snap.data() as AlertConfig) : null),
    onError
  )
}
```

  > `getDoc`, `onSnapshot`, `doc`, `setDoc`, `serverTimestamp` are already imported. Verify and add any missing ones to the existing import line (do NOT create a second import line).

**Step 3: Update Firestore rules**

- [ ] Open `firestore.rules` and append inside `match /databases/{database}/documents`:

```
match /alertConfigs/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

**Step 4: Verify**

- [ ] Check rules syntax:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && cat firestore.rules | grep -c "match\|allow" && echo "OK"
  ```

- [ ] TypeScript check:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -30
  ```
  Expected: 0 errors.

- [ ] Run all tests to confirm nothing broke:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run 2>&1 | tail -10
  ```

- [ ] Commit:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add src/lib/types.ts src/lib/firebase/firestore.ts firestore.rules && git commit -m "feat(alerts): AlertConfig type + Firestore save/get/subscribe + security rules"
  ```

---

## Chunk 2: Notification Senders + Trigger Route

### Task 3: Install packages + notification senders

**Files:**
- Create: `src/lib/notifications/send-fcm.ts`
- Create: `src/lib/notifications/send-whatsapp.ts`
- Create: `src/lib/notifications/send-alert-email.ts`

**Step 1: Install packages**

- [ ] Install required packages:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npm install rss-parser resend
  ```

- [ ] Install type definitions:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npm install --save-dev @types/rss-parser
  ```
  Note: `rss-parser` bundles its own types — if `@types/rss-parser` fails to install, that's OK. Skip if error.

**Step 2: Create `.env.local` entries**

- [ ] Open `/Users/adityaraj0421/Cool Projects/Tender/app/.env.local` and add these new environment variables (the values are placeholders — fill in before production):

```bash
# Alert system
CRON_SECRET=your_random_secret_here_min_32_chars
ALERT_RSS_URLS=https://eprocure.gov.in/eprocure/app/rssxml

# FCM (Firebase Admin handles this via the existing admin SDK — no separate key needed)

# MSG91 WhatsApp
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_TEMPLATE_ID=your_approved_whatsapp_template_id
MSG91_SENDER_ID=TSRTHI

# Resend email
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=alerts@tendersarthi.com
```

**Step 3: Create `src/lib/notifications/send-fcm.ts`**

- [ ] Create directory:
  ```
  mkdir -p "/Users/adityaraj0421/Cool Projects/Tender/app/src/lib/notifications"
  ```

- [ ] Create `src/lib/notifications/send-fcm.ts`:

```typescript
import { getMessaging } from 'firebase-admin/messaging'
import '@/lib/firebase/admin'

export interface FCMPayload {
  title: string
  body: string
  link?: string
}

/**
 * Send a Firebase Cloud Messaging push notification to a single device token.
 * Returns true on success, false on failure (stale token, etc.).
 */
export async function sendFCMAlert(fcmToken: string, payload: FCMPayload): Promise<boolean> {
  try {
    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
        },
        fcmOptions: payload.link ? { link: payload.link } : undefined,
      },
    })
    return true
  } catch (err) {
    console.error('[FCM] Failed to send notification:', err)
    return false
  }
}
```

**Step 4: Create `src/lib/notifications/send-whatsapp.ts`**

- [ ] Create `src/lib/notifications/send-whatsapp.ts`:

```typescript
/**
 * Send a WhatsApp message via MSG91's API.
 * Requires approved WhatsApp Business template.
 * Returns true on success, false if config missing or API error.
 */
export async function sendWhatsAppAlert(phone: string, message: string): Promise<boolean> {
  const authKey    = process.env.MSG91_AUTH_KEY
  const templateId = process.env.MSG91_TEMPLATE_ID

  // Silently skip if WhatsApp is not configured
  if (!authKey || !templateId) {
    console.warn('[WhatsApp] MSG91_AUTH_KEY or MSG91_TEMPLATE_ID not set — skipping')
    return false
  }

  // MSG91 requires Indian numbers without leading 0 or +91
  const normalised = phone.replace(/^\+?91/, '').replace(/^0/, '').replace(/\D/g, '')
  if (normalised.length !== 10) {
    console.warn('[WhatsApp] Invalid phone number:', phone)
    return false
  }

  try {
    const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: {
        'authkey': authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        integrated_number: `91${normalised}`,
        content_type: 'template',
        payload: {
          to: `91${normalised}`,
          type: 'template',
          template: {
            name: templateId,
            language: { code: 'hi' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: message }],
              },
            ],
          },
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[WhatsApp] MSG91 API error:', res.status, text)
      return false
    }

    return true
  } catch (err) {
    console.error('[WhatsApp] Network error:', err)
    return false
  }
}
```

**Step 5: Create `src/lib/notifications/send-alert-email.ts`**

- [ ] Create `src/lib/notifications/send-alert-email.ts`:

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface AlertEmailPayload {
  to: string
  subject: string
  tenderTitle: string
  tenderLink: string
  message: string
}

/**
 * Send an alert email via Resend.
 * Returns true on success, false if config missing or API error.
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping')
    return false
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'TenderSarthi <alerts@tendersarthi.com>'

  try {
    const { error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A3766;">
          <h2 style="color: #1A3766;">नया Tender मिला! 🎯</h2>
          <p style="font-size: 18px; font-weight: bold;">${payload.tenderTitle}</p>
          <p>${payload.message}</p>
          <a href="${payload.tenderLink}"
             style="display: inline-block; background: #F97316; color: white; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
            Tender देखें →
          </a>
          <hr style="border: 1px solid #e5e7eb; margin: 24px 0;"/>
          <p style="font-size: 12px; color: #9ca3af;">
            TenderSarthi | AI-powered GeM tender assistant<br/>
            Alert settings: <a href="https://tendersarthi.com/en/alerts">Manage alerts</a>
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('[Email] Resend error:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[Email] Network error:', err)
    return false
  }
}
```

- [ ] Verify TypeScript:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -30
  ```
  Expected: 0 errors.

- [ ] Commit:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add src/lib/notifications/ .env.local package.json package-lock.json && git commit -m "feat(alerts): add FCM + MSG91 + Resend notification senders"
  ```

---

### Task 4: Alert trigger API route

**Files:**
- Create: `src/app/api/alerts/trigger/route.ts`

The trigger route is called by Vercel Cron every 6 hours (and by the Admin panel manually). It:
1. Verifies `CRON_SECRET` authorization header
2. Fetches all configured RSS feeds, deduplicates by link, filters to last 7 hours
3. Loads all active alert configs from Firestore (Admin SDK, no per-user auth needed)
4. For each config, finds matching tenders and sends notifications
5. Checks for documents expiring in ≤30 days and sends expiry alerts
6. Returns a summary JSON

- [ ] Create directory:
  ```
  mkdir -p "/Users/adityaraj0421/Cool Projects/Tender/app/src/app/api/alerts/trigger"
  ```

- [ ] Create `src/app/api/alerts/trigger/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'
import { parseRSSItem, matchesAlertConfig, formatAlertMessage } from '@/lib/alert-utils'
import { sendFCMAlert } from '@/lib/notifications/send-fcm'
import { sendWhatsAppAlert } from '@/lib/notifications/send-whatsapp'
import { sendAlertEmail } from '@/lib/notifications/send-alert-email'
import type { AlertConfig } from '@/lib/alert-utils'
import type { UserProfile } from '@/lib/types'

const parser = new Parser({ timeout: 10_000 })

// --- Helpers ---

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/** Fetch and parse a single RSS feed URL. Returns [] on any error. */
async function fetchFeedItems(url: string) {
  try {
    const feed = await parser.parseURL(url)
    return feed.items ?? []
  } catch (err) {
    console.warn(`[Alerts] RSS fetch failed for ${url}:`, err)
    return []
  }
}

// --- Main route ---

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getFirestore()
  const now = new Date()
  const sevenHoursAgo = new Date(now.getTime() - 7 * 60 * 60 * 1000)

  // ── Step 1: Fetch RSS items ──────────────────────────────────────────────
  const rssUrls = (process.env.ALERT_RSS_URLS ?? 'https://eprocure.gov.in/eprocure/app/rssxml')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean)

  const allItems = (
    await Promise.all(rssUrls.map(fetchFeedItems))
  ).flat()

  // Deduplicate by link
  const seenLinks = new Set<string>()
  const uniqueItems = allItems.filter(item => {
    if (!item.link || seenLinks.has(item.link)) return false
    seenLinks.add(item.link)
    return true
  })

  // Filter to last 7 hours (avoids re-alerting old tenders on retry runs)
  const recentItems = uniqueItems.filter(item => {
    if (!item.pubDate) return true // include if no date (conservative)
    return new Date(item.pubDate) >= sevenHoursAgo
  })

  const parsedTenders = recentItems.map(item => parseRSSItem({
    title: item.title,
    link: item.link,
    contentSnippet: item.contentSnippet,
    pubDate: item.pubDate,
  }))

  // ── Step 2: Load active alert configs ────────────────────────────────────
  const configsSnap = await db.collection('alertConfigs')
    .where('active', '==', true)
    .get()

  let alertsSent = 0

  // ── Step 3: Match and notify ─────────────────────────────────────────────
  for (const configDoc of configsSnap.docs) {
    const config = configDoc.data() as AlertConfig
    const uid = configDoc.id

    // Load user profile for notification contact info
    let userProfile: UserProfile | null = null
    try {
      const userSnap = await db.collection('users').doc(uid).get()
      if (!userSnap.exists) continue  // Admin SDK: .exists is a boolean property, not a method
      userProfile = userSnap.data() as UserProfile
    } catch {
      continue
    }

    // Only send alerts to Pro users
    if (userProfile.plan !== 'pro') continue

    // Find matching tenders
    const matches = parsedTenders.filter(t => matchesAlertConfig(t, config))
    if (matches.length === 0) continue

    // Send for the first match only (avoid notification spam — max 1 per run per user)
    const tender = matches[0]!
    const message = formatAlertMessage(tender)

    const promises: Promise<boolean>[] = []

    if (config.channels.push && userProfile.fcmToken) {
      promises.push(
        sendFCMAlert(userProfile.fcmToken, {
          title: 'नया Tender मिला! 🎯',
          body: tender.title,
          link: tender.link,
        })
      )
    }

    if (config.channels.whatsapp && userProfile.phone) {
      promises.push(sendWhatsAppAlert(userProfile.phone, message))
    }

    if (config.channels.email && userProfile.email) {
      promises.push(
        sendAlertEmail({
          to: userProfile.email,
          subject: `नया Tender: ${tender.title}`,
          tenderTitle: tender.title,
          tenderLink: tender.link,
          message,
        })
      )
    }

    const results = await Promise.allSettled(promises)
    const anySent = results.some(r => r.status === 'fulfilled' && r.value === true)
    if (anySent) alertsSent++
  }

  // ── Step 4: Document expiry alerts ───────────────────────────────────────
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  let expirySent = 0

  try {
    const expiringDocs = await db.collection('documents')
      .where('expiresAt', '>=', Timestamp.fromDate(now))
      .where('expiresAt', '<=', Timestamp.fromDate(thirtyDaysFromNow))
      .get()

    for (const docSnap of expiringDocs.docs) {
      const data = docSnap.data()
      if (data.expiryAlertSent === true) continue

      // Load user profile
      const userSnap = await db.collection('users').doc(data.userId).get()
      if (!userSnap.exists) continue  // Admin SDK: .exists is a boolean property, not a method
      const user = userSnap.data() as UserProfile
      if (user.plan !== 'pro') continue

      const daysLeft = Math.round((data.expiresAt.toDate().getTime() - now.getTime()) / 86_400_000)
      const expiryMsg = `⚠️ ${data.type?.toUpperCase() ?? 'Document'} ${daysLeft} दिन में expire होगी। Renew करें।`

      const expiryPromises: Promise<boolean>[] = []

      // Load user alert config for channels
      const alertConfigSnap = await db.collection('alertConfigs').doc(data.userId).get()
      const channels = alertConfigSnap.exists  // Admin SDK: boolean property, not method
        ? (alertConfigSnap.data() as AlertConfig).channels
        : { push: true, whatsapp: false, email: false }

      if (channels.push && user.fcmToken) {
        expiryPromises.push(
          sendFCMAlert(user.fcmToken, {
            title: '⚠️ Document Expiry Alert',
            body: expiryMsg,
          })
        )
      }

      if (channels.whatsapp && user.phone) {
        expiryPromises.push(sendWhatsAppAlert(user.phone, expiryMsg))
      }

      if (channels.email && user.email) {
        expiryPromises.push(
          sendAlertEmail({
            to: user.email,
            subject: `Document Expiry: ${daysLeft} दिन बाकी`,
            tenderTitle: `${data.type?.toUpperCase() ?? 'Document'} expiry`,
            tenderLink: 'https://tendersarthi.com/en/documents',
            message: expiryMsg,
          })
        )
      }

      await Promise.allSettled(expiryPromises)
      await docSnap.ref.update({ expiryAlertSent: true })
      expirySent++
    }
  } catch (err) {
    console.error('[Alerts] Expiry check error:', err)
  }

  return NextResponse.json({
    ok: true,
    parsed: parsedTenders.length,
    alertsSent,
    expirySent,
    timestamp: now.toISOString(),
  })
}
```

- [ ] Verify TypeScript:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```
  Expected: 0 errors. If `rss-parser` types are missing, add `declare module 'rss-parser'` to a new file `src/types/rss-parser.d.ts` and re-check.

- [ ] Run all tests:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run 2>&1 | tail -10
  ```

- [ ] Commit:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add "src/app/api/alerts/trigger/" && git commit -m "feat(alerts): add alert trigger route (RSS fetch + match + FCM/WhatsApp/email + expiry)"
  ```

---

## Chunk 3: Alert Config UI

### Task 5: `use-alert-config` hook + `AlertConfigForm` + `/alerts/page.tsx`

**Files:**
- Create: `src/lib/hooks/use-alert-config.ts`
- Create: `src/components/alerts/alert-config-form.tsx`
- Modify: `src/app/[locale]/(app)/alerts/page.tsx`

**Step 1: Create `src/lib/hooks/use-alert-config.ts`**

- [ ] Create `src/lib/hooks/use-alert-config.ts`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { subscribeAlertConfig, saveAlertConfig } from '@/lib/firebase/firestore'
import type { AlertConfig } from '@/lib/types'

interface UseAlertConfigResult {
  config: AlertConfig | null
  loading: boolean
  saving: boolean
  save: (config: Omit<AlertConfig, 'userId' | 'createdAt'>) => Promise<void>
}

export function useAlertConfig(uid: string | null): UseAlertConfigResult {
  const [config, setConfig]   = useState<AlertConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const unsub = subscribeAlertConfig(uid, c => { setConfig(c); setLoading(false) }, () => setLoading(false))
    return unsub
  }, [uid])

  const save = async (data: Omit<AlertConfig, 'userId' | 'createdAt'>) => {
    if (!uid) return
    setSaving(true)
    try {
      await saveAlertConfig(uid, data)
    } finally {
      setSaving(false)
    }
  }

  return { config, loading, saving, save }
}
```

**Step 2: Create `src/components/alerts/alert-config-form.tsx`**

- [ ] Create directory:
  ```
  mkdir -p "/Users/adityaraj0421/Cool Projects/Tender/app/src/components/alerts"
  ```

- [ ] Create `src/components/alerts/alert-config-form.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, MessageSquare, Mail, X, Plus, CheckCircle } from 'lucide-react'
import { GEM_CATEGORIES, INDIAN_STATES } from '@/lib/constants'
import type { AlertConfig } from '@/lib/types'

interface AlertConfigFormProps {
  initial: AlertConfig | null
  saving: boolean
  onSave: (config: Omit<AlertConfig, 'userId' | 'createdAt'>) => Promise<void>
}

export function AlertConfigForm({ initial, saving, onSave }: AlertConfigFormProps) {
  const t = useTranslations('alerts')

  const [categories, setCategories] = useState<string[]>(initial?.categories ?? [])
  const [states, setStates]         = useState<string[]>(initial?.states ?? [])
  const [keywords, setKeywords]     = useState<string[]>(initial?.keywords ?? [])
  const [newKeyword, setNewKeyword]  = useState('')
  const [channels, setChannels]     = useState(
    initial?.channels ?? { push: true, whatsapp: false, email: false }
  )
  const [saved, setSaved]           = useState(false)

  // Re-initialize form state when `initial` loads from Firestore after mount
  // (useState ignores prop changes; this effect syncs when initial transitions null → real config)
  useEffect(() => {
    if (!initial) return
    setCategories(initial.categories)
    setStates(initial.states)
    setKeywords(initial.keywords)
    setChannels(initial.channels)
  }, [initial])

  const toggleCategory = (cat: string) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const toggleState = (state: string) =>
    setStates(prev => prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state])

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) { setKeywords(prev => [...prev, kw]); setNewKeyword('') }
  }

  const handleSave = async () => {
    await onSave({ categories, states, keywords, channels, active: true })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Categories */}
      <section>
        <p className="text-sm font-semibold text-navy mb-2">{t('categoriesLabel')}</p>
        <p className="text-xs text-muted mb-3">{t('categoriesHint')}</p>
        <div className="flex flex-wrap gap-2">
          {GEM_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => toggleCategory(cat)}
              className={[
                'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
                categories.includes(cat)
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-navy border-navy/20 hover:bg-navy/5'
              ].join(' ')}>
              {cat}
            </button>
          ))}
        </div>
        {categories.length === 0 && (
          <p className="text-xs text-muted/60 mt-2">{t('allCategoriesNote')}</p>
        )}
      </section>

      {/* States */}
      <section>
        <p className="text-sm font-semibold text-navy mb-2">{t('statesLabel')}</p>
        <p className="text-xs text-muted mb-3">{t('statesHint')}</p>
        <select
          multiple
          value={states}
          onChange={e => setStates(Array.from(e.target.selectedOptions, o => o.value))}
          className="w-full border border-navy/20 rounded-xl px-3 py-2 text-sm text-navy bg-white h-36"
        >
          {INDIAN_STATES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {states.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {states.map(s => (
              <span key={s} className="flex items-center gap-1 text-xs bg-navy/10 text-navy px-2 py-0.5 rounded-full">
                {s}
                <button onClick={() => toggleState(s)} aria-label={`Remove ${s}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        {states.length === 0 && (
          <p className="text-xs text-muted/60 mt-2">{t('allStatesNote')}</p>
        )}
      </section>

      {/* Keywords */}
      <section>
        <p className="text-sm font-semibold text-navy mb-2">{t('keywordsLabel')}</p>
        <p className="text-xs text-muted mb-3">{t('keywordsHint')}</p>
        <div className="flex gap-2">
          <input
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
            placeholder={t('keywordPlaceholder')}
            className="flex-1 border border-navy/20 rounded-xl px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
          <button onClick={addKeyword} aria-label={t('addKeyword')}
            className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center shrink-0">
            <Plus size={16} />
          </button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {keywords.map(kw => (
              <span key={kw} className="flex items-center gap-1 text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full">
                {kw}
                <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))} aria-label={`Remove ${kw}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Channels */}
      <section>
        <p className="text-sm font-semibold text-navy mb-3">{t('channelsLabel')}</p>
        <div className="space-y-3">
          {([
            { key: 'push',      icon: Bell,           label: t('channelPush'),      hint: t('channelPushHint') },
            { key: 'whatsapp',  icon: MessageSquare,  label: t('channelWhatsApp'),  hint: t('channelWhatsAppHint') },
            { key: 'email',     icon: Mail,           label: t('channelEmail'),     hint: t('channelEmailHint') },
          ] as const).map(({ key, icon: Icon, label, hint }) => (
            <label key={key}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setChannels(prev => ({ ...prev, [key]: !prev[key] }))}>
              <div className={[
                'w-10 h-6 rounded-full flex items-center transition-colors relative shrink-0',
                channels[key] ? 'bg-navy' : 'bg-navy/20'
              ].join(' ')}>
                <div className={[
                  'w-4 h-4 rounded-full bg-white absolute transition-transform',
                  channels[key] ? 'translate-x-5' : 'translate-x-1'
                ].join(' ')} />
              </div>
              <div className="flex items-center gap-2">
                <Icon size={16} className="text-muted" />
                <div>
                  <p className="text-sm font-medium text-navy">{label}</p>
                  <p className="text-xs text-muted">{hint}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-navy text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saved ? (
          <><CheckCircle size={16} /> {t('saved')}</>
        ) : saving ? t('saving') : t('saveAlerts')}
      </button>

      <p className="text-xs text-muted text-center">{t('scheduleNote')}</p>
    </div>
  )
}
```

**Step 3: Replace `/alerts/page.tsx`**

- [ ] Create (replace) `src/app/[locale]/(app)/alerts/page.tsx`:

```tsx
'use client'
import { useTranslations } from 'next-intl'
import { Bell, Lock } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useAlertConfig } from '@/lib/hooks/use-alert-config'
import { isPro } from '@/lib/plan-guard'
import { AlertConfigForm } from '@/components/alerts/alert-config-form'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { useState } from 'react'

export default function AlertsPage() {
  const t = useTranslations('alerts')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { config, loading, saving, save } = useAlertConfig(user?.uid ?? null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  if (!profile || !user || loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-36 bg-navy/5 rounded-lg animate-pulse" />
        <div className="h-64 bg-navy/5 rounded-xl animate-pulse" />
      </div>
    )
  }

  const userIsPro = isPro(profile)

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-navy" />
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
      </div>
      <p className="text-sm text-muted">{t('subtitle')}</p>

      {!userIsPro ? (
        <div className="bg-orange/5 border border-orange/20 rounded-xl p-5 text-center space-y-3">
          <Lock className="mx-auto text-orange" size={28} />
          <p className="font-semibold text-navy text-sm">{t('proOnly')}</p>
          <p className="text-sm text-muted">{t('proOnlySub')}</p>
          <button onClick={() => setUpgradeOpen(true)}
            className="px-6 py-2.5 rounded-xl bg-orange text-white font-semibold text-sm">
            {t('upgradeCta')}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-xl p-4">
          <AlertConfigForm initial={config} saving={saving} onSave={save} />
        </div>
      )}

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
    </div>
  )
}
```

- [ ] Verify TypeScript:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```
  Expected: 0 errors.

- [ ] Run all tests:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run 2>&1 | tail -10
  ```

- [ ] Commit:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add src/lib/hooks/use-alert-config.ts src/components/alerts/ "src/app/[locale]/(app)/alerts/page.tsx" && git commit -m "feat(alerts): add alert config UI (categories, states, keywords, channels)"
  ```

---

## Chunk 4: Vercel Cron + i18n + Memory

### Task 6: Vercel cron config + i18n (11 locales) + memory update

**Files:**
- Create: `vercel.json`
- Modify: `messages/*.json` (11 files)
- Modify: `memory/project_tendersarthi.md`

**Step 1: Create `vercel.json`**

- [ ] Create `/Users/adityaraj0421/Cool Projects/Tender/app/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/alerts/trigger",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

> `0 */6 * * *` runs at 00:00, 06:00, 12:00, 18:00 UTC every day (6-hour interval).

> **Required env var on Vercel:** Set `CRON_SECRET` in your Vercel project environment variables. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when calling the cron route if you also set `CRON_SECRET` in the project settings.

> **Note:** On Vercel's Hobby plan, cron jobs have a minimum interval of 1 day. For 6-hour intervals, a Pro/Team plan is required. For development, the trigger route can be called manually from the Admin panel (Subsystem 11).

**Step 2: Add `alerts.*` namespace to all 11 message files**

For each `messages/*.json` file, add the `"alerts"` key inside the root JSON object (before the closing `}`).

- [ ] Add to `messages/en.json`:

```json
"alerts": {
  "title": "Tender Alerts",
  "subtitle": "Get notified when new matching tenders are posted",
  "proOnly": "Tender Alerts is a Pro feature",
  "proOnlySub": "Upgrade to Pro to receive alerts for new tenders in your categories.",
  "upgradeCta": "Upgrade to Pro",
  "categoriesLabel": "Categories to watch",
  "categoriesHint": "Select categories — leave empty to receive all categories",
  "allCategoriesNote": "All categories selected",
  "statesLabel": "States to watch",
  "statesHint": "Select states — leave empty to receive all states",
  "allStatesNote": "All states selected",
  "keywordsLabel": "Keywords",
  "keywordsHint": "Add specific keywords to filter tenders (e.g. \"vehicle hiring\")",
  "keywordPlaceholder": "Add keyword...",
  "addKeyword": "Add keyword",
  "channelsLabel": "Notification channels",
  "channelPush": "Push notifications",
  "channelPushHint": "Instant alerts in-app and on your device",
  "channelWhatsApp": "WhatsApp",
  "channelWhatsAppHint": "Alert sent to your registered mobile number",
  "channelEmail": "Email",
  "channelEmailHint": "Alert sent to your registered email address",
  "saveAlerts": "Save Alert Settings",
  "saving": "Saving...",
  "saved": "Saved ✓",
  "scheduleNote": "Alerts are checked every 6 hours. New tenders will be notified within 6 hours of posting."
}
```

- [ ] Add to `messages/hi.json`:

```json
"alerts": {
  "title": "Tender Alerts",
  "subtitle": "नया matching tender आने पर तुरंत notification मिलेगी",
  "proOnly": "Tender Alerts Pro feature है",
  "proOnlySub": "Pro में upgrade करें और अपनी categories के नए tenders पर alerts पाएं।",
  "upgradeCta": "Pro में Upgrade करें",
  "categoriesLabel": "कौन सी categories देखें?",
  "categoriesHint": "Categories चुनें — खाली छोड़ने पर सभी categories के alerts मिलेंगे",
  "allCategoriesNote": "सभी categories selected हैं",
  "statesLabel": "कौन से states देखें?",
  "statesHint": "States चुनें — खाली छोड़ने पर सभी states के alerts मिलेंगे",
  "allStatesNote": "सभी states selected हैं",
  "keywordsLabel": "Keywords",
  "keywordsHint": "Specific keywords add करें जैसे \"vehicle hiring\" या \"laptop\"",
  "keywordPlaceholder": "Keyword add करें...",
  "addKeyword": "Keyword add करें",
  "channelsLabel": "Notification channels",
  "channelPush": "Push notifications",
  "channelPushHint": "App और device पर instant alert",
  "channelWhatsApp": "WhatsApp",
  "channelWhatsAppHint": "आपके registered mobile number पर alert",
  "channelEmail": "Email",
  "channelEmailHint": "आपके registered email पर alert",
  "saveAlerts": "Alert Settings Save करें",
  "saving": "Save हो रहा है...",
  "saved": "Save हो गया ✓",
  "scheduleNote": "Alerts हर 6 घंटे में check होते हैं। नए tenders की notification 6 घंटे के अंदर आएगी।"
}
```

- [ ] For the remaining 9 locale files (`mr.json`, `gu.json`, `bn.json`, `ta.json`, `te.json`, `kn.json`, `ml.json`, `pa.json`, `or.json`), copy the **Hindi** `alerts` block verbatim. Do NOT add `//` comments — JSON does not support them and they will break the build.

**Step 3: Final verification**

- [ ] TypeScript check:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```
  Expected: 0 errors.

- [ ] All tests:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run 2>&1 | tail -20
  ```

**Step 4: Update memory file**

- [ ] Open `/Users/adityaraj0421/.claude/projects/-Users-adityaraj0421-Cool-Projects-Tender/memory/project_tendersarthi.md` and:
  1. Add after Subsystem 5's status line: `- Subsystem 6 (Alert System): ✅ Complete — <N> tests passing, 0 TS errors`
  2. Add a new `## Subsystem 6 Key Decisions` section noting:
     - `alertConfigs/{uid}` (not `alerts/{alertId}`) — one config per user
     - GeM scraper disabled by default; enable via `ENABLE_GEM_SCRAPER=true`
     - Max 1 tender alert per user per cron run (prevents notification spam)
     - Vercel Cron requires Pro plan for 6-hour schedule (Hobby plan: 1-day min)
     - `expiryAlertSent: boolean` added to `VaultDocument` interface (backfilled as false for existing docs)
     - Resend and rss-parser npm packages added

**Step 5: Commit**

- [ ] Commit all changes:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && git add vercel.json messages/ && git commit -m "feat(alerts): Vercel cron config + alerts i18n (11 locales)"
  ```

- [ ] Commit memory update:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app/.." && git add "../.claude/projects/-Users-adityaraj0421-Cool-Projects-Tender/memory/project_tendersarthi.md" 2>/dev/null || true
  ```
  Note: Memory file is outside the app git repo. Update it manually without committing.

---

## Final Verification Checklist

### Functionality
- [ ] `parseRSSItem` extracts title, link, description, pubDate, categories, states from raw RSS item
- [ ] `matchesAlertConfig` returns true for matching configs; false when inactive
- [ ] Empty categories/states/keywords in config means "match all" (not "match none")
- [ ] Alert trigger route returns 401 without correct `CRON_SECRET` header
- [ ] Alert trigger route fetches RSS, parses items, loads active configs, matches and notifies
- [ ] Max 1 tender alert per user per trigger run (first match only)
- [ ] Document expiry alert sent when `expiresAt <= 30 days` and `expiryAlertSent !== true`
- [ ] `expiryAlertSent` field set to `true` in Firestore after alert sent (no duplicate alerts)
- [ ] FCM send skipped if `fcmToken` is null/absent on user profile
- [ ] WhatsApp send skipped if `MSG91_AUTH_KEY` or `MSG91_TEMPLATE_ID` not set
- [ ] Email send skipped if `RESEND_API_KEY` not set
- [ ] GeM scraper disabled by default (env var `ENABLE_GEM_SCRAPER` not referenced until Subsystem 11)

### Security
- [ ] Trigger route only accepts `Authorization: Bearer <CRON_SECRET>` — returns 401 otherwise
- [ ] `alertConfigs/{uid}` Firestore rules: only the owning user can read/write
- [ ] Alert trigger uses Firebase Admin SDK (no client-side auth bypass possible)
- [ ] Only Pro users receive alerts (checked server-side inside trigger route)

### UI
- [ ] `/alerts` page shows Pro gate with lock icon and upgrade button for free users
- [ ] Category chips toggle on/off with visual state (filled vs outlined)
- [ ] Multi-select state list with removable chip display
- [ ] Keyword input: Enter key adds keyword, X chip removes it
- [ ] Channel toggles: Push / WhatsApp / Email with sliding toggle UI
- [ ] "Saved ✓" confirmation appears after successful save (disappears after 3s)
- [ ] All strings use `t('alerts.*')` — no hardcoded text in components

### i18n
- [ ] `alerts` namespace present in all 11 `messages/*.json` files
- [ ] All keys present: title, subtitle, categoriesLabel, statesLabel, keywordsLabel, channelsLabel, saveAlerts, saved, saving, scheduleNote, proOnly, proOnlySub, upgradeCta, all channel keys
- [ ] TypeScript clean (`npx tsc --noEmit`)

### Tests
- [ ] 17 `alert-utils.test.ts` tests pass
- [ ] All existing tests still pass (no regressions)

### Cron
- [ ] `vercel.json` created with `GET /api/alerts/trigger` on `0 */6 * * *` schedule
- [ ] `CRON_SECRET` env var documented in `.env.local` with placeholder value

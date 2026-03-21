# TenderSarthi — Product Requirements Document (PRD)

> **Version:** 1.0
> **Date:** 2026-03-20
> **Status:** Approved for Implementation

---

## 1. Overview

**TenderSarthi** is a one-stop SaaS platform for small business owners and individual vendors who fill government tenders on the GeM (Government e-Marketplace) portal. It removes the complexity, paperwork confusion, and deadline anxiety from the tendering process — acting as a knowledgeable guide (Sarthi) through every step.

**Primary Tagline:** सरकारी टेंडर, आसान तरीके से
*(Government Tenders, The Easy Way)*

**Hero / Landing Tagline:** सरकारी टेंडर जीतो, आसानी से
*(Win Government Tenders, Easily)*
— Used on the landing page hero and onboarding screens. Shifts from "we simplify" to "you win". This is the user's goal, not just our value prop.

**Target Users:** Individual vendors, sole proprietors, and small businesses across India who actively participate in GeM tenders across any category (Transport, IT, Medical, Construction, Supplies, etc.)

---

## 2. Business Model

### Freemium — Free + Pro

| | Free | Pro |
|---|---|---|
| **Price** | ₹0 | ₹499/month or ₹3,999/year |
| **Trial** | 7-day Pro trial on signup (no card required) | — |

### Free Tier Features
- Tender Finder with deep links and category/state filters
- AI Tender Summarizer (10 queries/month)
- Document Checklist for all GeM categories (read-only)
- Deadline Tracker (up to 5 tenders)
- Bid Helper AI chat (10 messages/month)
- Learning Center (full access — drives SEO and trust)
- Dashboard (basic view)

### Pro Tier Features (₹499/month | ₹3,999/year)
- Everything in Free, unlimited
- Document Vault (upload, store, organize, expiry tracking)
- AI Bid Document Generator (full bid response drafts)
- Tender Alerts (WhatsApp + email + push notifications)
- Orders Tracker (post-win work order and payment tracking)
- Document expiry reminders (30 days before expiry)
- Unlimited deadline tracking
- Priority support (WhatsApp direct line to founder, response within 4 hours on weekdays)

### Financial Model Assumptions

| User Type | AI Queries/month | Bid Docs/month | Variable Cost |
|---|---|---|---|
| Free user | 10 (at their cap) | 0 | ~₹0.43 |
| Pro user | 80 (estimated avg) | 5 | ~₹21.20 |

**Pro user query distribution (for cost planning):**
```
Light users  (~50%):  20–30 queries/month  → ~₹8–10 AI cost
Avg users    (~35%):  60–80 queries/month  → ~₹15–18 AI cost
Heavy users  (~15%):  150–200 queries/month → ~₹25–35 AI cost
```

**Bid Document Generator caveat:** At ₹1.80/doc, a Pro user generating 20 docs/month = ₹36 in AI costs for that feature alone. Recommend a soft-cap of 30 bid docs/month (99% of real users won't hit this — protects against abuse without affecting genuine users).

### Revenue Projections
| Pro Users | Monthly Revenue | Est. Cost | Profit | Margin |
|---|---|---|---|---|
| 100 | ₹49,900 | ₹4,348 | ₹45,552 | 91.3% |
| 1,000 | ₹4,99,000 | ₹41,700 | ₹4,57,300 | 91.6% |
| 10,000 | ₹49,90,000 | ₹3,92,710 | ₹45,97,290 | 92.1% |

---

## 3. Platform

**Web App + PWA** — installable on Android/iOS from browser, no app store required.

### Responsive Breakpoints
```
Mobile  (< 768px)    → PRIMARY: Bottom nav, single column, full-width cards
Tablet  (768-1024px) → Bottom nav, 2-column card grid, wider forms
Desktop (> 1024px)   → Left sidebar nav (240px), centered content (max 1200px)
```

### Offline Behaviour (PWA)
```
Works offline (cached via next-pwa service worker):
  ✅ Dashboard (last loaded state — Firestore offline persistence)
  ✅ My Tenders list (Firestore offline cache)
  ✅ Learning Center articles (static — pre-cached)
  ✅ Document Vault file list (metadata cached; file preview requires network)

Does NOT work offline (requires live network):
  ❌ AI summarizer, Bid Helper chat, Bid Document Generator
  ❌ Tender Finder (Algolia search requires network)
  ❌ Tender Alerts (real-time by nature)
  ❌ Payments

Offline banner: shown when navigator.onLine === false
  "आप offline हैं। Saved tenders और documents देख सकते हैं।"
```

### UI Rules
- Min tap target: 48×48px on all interactive elements
- Font minimum: 14px (never smaller on mobile)
- Tables → horizontal scroll on mobile, full display on desktop
- Modals → bottom sheets on mobile, centered dialogs on desktop
- Images → `next/image` with responsive srcsets

---

## 4. Tech Stack

```
Frontend:    Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
PWA:         next-pwa
i18n:        next-intl
Fonts:       Poppins (headings) + Inter (body) + Noto Sans Devanagari (Hindi)
Responsive:  Mobile-first, Tailwind breakpoints (md, lg)

Auth:        Firebase Auth (Google OAuth + Phone OTP)
Database:    Firestore
Search:      Algolia (free tier: 10K searches/month)
Storage:     Firebase Storage (document vault)
AI:          Gemini Flash 2.0 via Google AI SDK (@google/generative-ai)
Alerts:      Firebase Cloud Messaging (push) + MSG91 (WhatsApp + SMS)
             + NIC/CPP portal RSS feeds + GeM web scraper + user-submitted
Payments:    Razorpay (UPI + cards + netbanking + subscriptions)
Hosting:     Vercel (frontend) + Firebase (backend services)
```

### AI Strategy (Hybrid, Cost-Optimised)
```
Gemini Flash 2.0  → Tender summarizer, Bid Helper chat,
                     Document Q&A, all 11 language responses
                     (~₹0.04/query — 95% of all AI calls)

Gemini 1.5 Pro    → Bid Document Generator ONLY
                     (Pro feature, higher quality output,
                     ~₹1.80/doc — still 3x cheaper than Sonnet 4.6)

All AI calls      → Server-side only (Next.js API routes)
                     Never client-side — API key stays secure
                     Single Google AI SDK, single billing account
```

### AI Usage Tracking (Firestore)
```
aiUsage/{uid}/{YYYY-MM}
  ├── queries: number   (resets monthly)
  └── bidDocs: number   (resets monthly)
```

### Transactional Email
```
Provider:  Resend (resend.com) — free tier: 3,000 emails/month
           Simple REST API, Next.js SDK available, reliable deliverability

Emails sent:
  - Welcome email on signup
  - Pro upgrade confirmation + GST invoice PDF
  - Subscription renewal reminder (3 days before)
  - Cancellation confirmation
  - Document expiry alerts (fallback if WhatsApp undelivered)
  - Password/OTP fallback (Firebase handles phone OTP natively)
```

### Product Analytics
```
Provider:  PostHog (posthog.com) — open source, free up to 1M events/month
           Self-hostable if needed for data privacy

Key events to track:
  - signup_completed          (with method: google | phone)
  - onboarding_completed      (with state + categories selected)
  - tender_saved
  - ai_summary_generated
  - bid_document_generated
  - upgrade_prompt_seen       (with trigger: query_limit | feature_gate)
  - upgrade_completed         (with plan: monthly | annual)
  - subscription_cancelled
  - alert_configured
  - feature_discovered        (progressive disclosure chip tapped)

Funnels to monitor:
  - Signup → Onboarding → First tender saved → AI used → Upgrade prompt → Paid
  - Free trial → Converted vs. Churned
```

### API Rate Limiting
```
Applied at Next.js API route middleware level (using upstash/ratelimit + Redis):

/api/ai/summarize     → 10 req/hour per uid (free) | 100 req/hour (pro)
/api/ai/chat          → 10 req/hour per uid (free) | 100 req/hour (pro)
/api/ai/generate-bid  → 5 req/hour per uid (pro only)
/api/alerts/trigger   → internal only (no user-facing rate limit needed)

All limits return 429 with a Hinglish message:
  "आप बहुत जल्दी queries कर रहे हैं। थोड़ा रुकें और फिर try करें।"

Monthly soft caps (Firestore-enforced, not rate limiting):
  Free: 10 AI queries/month, 0 bid docs
  Pro: unlimited queries, 30 bid docs/month soft cap
```

### API Failure & Graceful Degradation
```
Gemini API down:
  → Show: "AI अभी unavailable है। कुछ देर में try करें।"
  → Cache last successful summary in Firestore (serve stale if < 24hr old)
  → Do NOT decrement usage counter for failed calls

Razorpay down:
  → Show: "Payment अभी process नहीं हो पा रहा। थोड़ी देर में try करें।"
  → Do NOT create any Firestore record until webhook confirms
  → Redirect to /settings after recovery with success confirmation

GeM scraper blocked:
  → Fall back to NIC/CPP RSS feeds only
  → Admin alert sent (email to founder) with scraper status
  → Users still receive RSS-sourced alerts without interruption

Firebase offline (client):
  → Firestore SDK handles this natively (offline persistence enabled)
  → Show banner: "आप offline हैं। Changes sync होंगे जब connection आएगा।"
  → Cached data remains viewable; new AI calls disabled
```

---

## 5. Multi-Language Support

### V1 Launch — All 11 Languages
| Language | Script | States Covered |
|---|---|---|
| English | Latin | Default, official tender language |
| Hindi (हिंदी) | Devanagari | UP, Bihar, MP, Rajasthan, Delhi, Uttarakhand |
| Bengali (বাংলা) | Bengali | West Bengal, Tripura |
| Marathi (मराठी) | Devanagari | Maharashtra |
| Tamil (தமிழ்) | Tamil | Tamil Nadu, Puducherry |
| Telugu (తెలుగు) | Telugu | Andhra Pradesh, Telangana |
| Gujarati (ગુજરાતી) | Gujarati | Gujarat |
| Kannada (ಕನ್ನಡ) | Kannada | Karnataka |
| Punjabi (ਪੰਜਾਬੀ) | Gurmukhi | Punjab, Haryana |
| Odia (ଓଡ଼ିଆ) | Odia | Odisha |
| Malayalam (മലയാളം) | Malayalam | Kerala |

### Implementation
- Library: `next-intl` (route-based locale switching)
- Translation files: `/messages/{lang}.json` per language
- User picks language during onboarding → stored in Firestore → synced across devices
- AI system prompts switch language automatically based on user preference
- Default AI style: **Hinglish** (natural Hindi-English mix) — most accessible

---

## 6. Screens & Navigation

### Public Zone
```
/ (Landing Page)
  ├── Hero: "सरकारी टेंडर जीतो, आसानी से" (hero tagline)
  ├── Trust bar: "X+ vendors • Y tenders filed • Z tenders won"
  ├── Feature highlights (free vs pro)
  ├── Social proof: vendor testimonials + success stories
  └── Sign up CTA → Auth flow
```

### Auth Flow
```
/auth
  ├── Google Sign In (one tap)
  └── Phone OTP (enter number → receive OTP → verify)
      → Onboarding wizard (first login only)
```

### Onboarding (First Login Only)
```
Step 1: Name + Business name
Step 2: State (dropdown, all Indian states)
Step 3: GeM categories (multi-select chips)
        e.g. Transport, IT, Medical, Construction, Stationery...
Step 4: Notification permission (push)
        ┌─────────────────────────────────────────┐
        │ 🔔 Tender alerts चालू करें?            │
        │                                         │
        │ जब आपकी category में नया tender         │
        │ आए, हम आपको notify करेंगे।             │
        │                                         │
        │ [Allow Notifications]  [Skip for now]  │
        └─────────────────────────────────────────┘
        → "Allow" triggers browser push permission API
        → FCM token saved to users/{uid}.fcmToken
        → "Skip" stores notificationsDeclined: true
           (can be re-prompted from /settings > Notifications)
→ Dashboard (pre-filtered to their profile)
```

### Authenticated App — 9 Screens

```
/dashboard    → Overview: active tenders, upcoming deadlines, alerts, AI usage
/find         → Tender Finder (search + filters + AI summarizer)
/tenders      → My Tenders (saved tenders + deadline tracker)
/documents    → Document Vault (upload, checklist, expiry tracking)
/bid          → Bid Helper (AI chat + bid document generator)
/alerts       → Alert Settings (categories, states, keywords, channels)
/learn        → Learning Center (Hindi guides + video walkthroughs)
/orders       → Orders Tracker (post-win work orders + payments)
/settings     → Profile, business info, language, subscription, logout
```

### Navigation
```
Mobile/Tablet → Bottom nav bar (5 icons: Dashboard, Find, Tenders, Bid, More)
Desktop       → Left sidebar (240px fixed, all 9 links + user profile at bottom)
```

---

## 7. Detailed Feature Specifications

### 7.1 Dashboard (`/dashboard`)

**Trust Signal Bar (shown to all users, above the fold):**
```
┌────────────────────────────────────────────────┐
│ 🏆 12,400+ vendors  •  43,000 tenders filed    │
│        •  8,200 tenders won                    │
└────────────────────────────────────────────────┘
```
- Pulls from a `platformStats` Firestore doc (updated daily by a background job)
- Reinforces social proof at the moment users open the app, not just on the landing page

**Progressive Disclosure — New User Mode (first 14 days or < 3 tenders saved):**
- Dashboard shows **3 feature cards only:** Find Tenders, My Tenders, Bid Helper
- A "Discover more →" chip reveals remaining features (Alerts, Documents, Orders)
- Cards expand organically as user engages: saving a tender unlocks the Deadline card, submitting a bid unlocks the Orders card
- Prevents overwhelm for first-time users who have never filled a GeM tender

**Free users:**
- Active tenders count + next deadline (highlighted in red if < 3 days)
- AI usage counter: `AI: 8/10 ✦` (tapping shows upgrade prompt)
- Feature cards (progressive — 3 initially, more as user engages)
- 7-day Pro trial CTA banner (first 7 days after signup)

**Pro users:**
- All of above without limits or progressive hiding
- Recent alert activity feed
- Documents expiring in next 30 days
- Open work orders summary
- Success stories widget (rotating: "Rajesh from Bihar won ₹12L CRPF tender")

---

### 7.2 Tender Finder (`/find`)

**Features:**
- State filter (pre-set from user profile, changeable)
- Category filter (pre-set from user profile, multi-select)
- Deep links to GeM portal (filtered by state + category)
- Paste tender text → AI summarizes in user's language
- "Save this tender" → goes to My Tenders with deadline prompt
- Algolia-powered search across user's saved tenders

**Algolia indexing scope:**
```
Index name: tendersarthi_tenders
What is indexed: only the current user's saved tenders (NOT all platform tenders)
Indexed fields: name, gemId, category, state, status, aiSummary (first 300 chars)
Sync mechanism: Firestore Cloud Function trigger (onWrite on tenders/{tenderId})
                → calls Algolia API to upsert/delete the record
                → runs server-side only; Algolia API key never exposed to client
Filter by: userId (mandatory — users only search their own tenders)
Free tier limit: 10,000 search operations/month (sufficient for V1)
```

**AI Summarizer output includes:**
- Tender name + GeM ID
- Eligibility criteria
- Key dates (opening, closing, EMD submission)
- What is being procured
- Estimated value
- Red flags / things to watch out for
- Plain-language explanation in Hinglish/chosen language

**AI Confidence Disclaimer (mandatory on all AI summaries):**
```
ℹ️ AI Summary — Always verify on the official GeM portal before bidding.
```
— Displayed as a muted caption below every AI-generated summary. Non-intrusive but always present. Protects users from acting on stale or misread tender data.

**Free limit:** 10 AI summaries/month
**Pro:** Unlimited

---

### 7.3 My Tenders (`/tenders`)

**Features:**
- List of saved tenders with status (Active / Won / Lost / Expired)
- Deadline tracker with color-coded urgency:
  - 🔴 Red: < 3 days
  - 🟡 Amber: 3–7 days
  - 🟢 Green: > 7 days
- Swipe to dismiss / archive
- FAB button: "+ Add Tender"
- Algolia search across saved tenders
- Filter by status, category, state

**Free limit:** Up to 5 saved tenders
**Pro:** Unlimited

---

### 7.4 Document Vault (`/documents`) — Pro Only

**Features:**
- Upload documents (PDF, JPG, PNG — max 10MB each)
- Tag by type: RC / GST Certificate / Insurance / ITR / MSME / PAN / Udyam / Other
- Set expiry date (optional)
- Checklist per GeM category (which documents are required)
- Progress bar: "8/13 documents uploaded"
- Expiry alerts: WhatsApp + push 30 days before expiry
- Firebase Storage for secure file storage

**Free users:** See checklist only (no upload)
**Pro:** Full vault

---

### 7.5 Bid Helper (`/bid`)

**7.5.1 AI Chat**
- Multi-turn conversation with context preserved per session
- Pre-built question chips:
  - "EMD कैसे भरें?"
  - "Technical bid में क्या डालें?"
  - "L1 rate कैसे decide करें?"
- Responds in user's chosen language (default Hinglish)
- Powered by Gemini Flash 2.0

**AI Confidence Indicator (on every AI response):**
```
💡 AI suggestion — verify details on GeM portal before acting.
```
— Same muted disclaimer as Tender Finder. Consistent across all AI touchpoints.

**Checklist Confirmation Flow (anxiety-reducing):**
After AI answers a procedural question (e.g. "EMD कैसे भरें?"), show:
```
✅ EMD payment steps समझ आए?
   → "हाँ, समझ गया" (closes) | "और details चाहिए" (follow-up prompt)
```

**Free limit:** 10 messages/month
**Pro:** Unlimited

**7.5.2 AI Bid Document Generator — Pro Only**
```
Flow:
1. Select a saved tender from My Tenders
2. Fill short form:
   - Years of experience
   - Past contracts (brief description)
   - Fleet size / capacity / offering
   - Rate to quote
3. Win Probability Score shown before generating:
   ┌──────────────────────────────────────┐
   │  🎯 Bid Probability: 68% likely      │
   │  Based on: category match, your      │
   │  experience, typical competition     │
   │  in this state.                      │
   │  [Generate Bid Document →]           │
   └──────────────────────────────────────┘
   Scoring factors: category + user's state + experience years
   + historical win rates from platformStats Firestore doc
   Powered by Gemini Flash 2.0 (no extra API cost — part of bid flow)
4. AI generates complete bid response document
5. "You're ready to bid! ✅" confirmation screen:
   ┌──────────────────────────────────────┐
   │ ✅ आपका bid document तैयार है!       │
   │                                      │
   │ • Review the document below          │
   │ • Download PDF                       │
   │ • Upload on GeM portal               │
   │                                      │
   │ ℹ️ AI-generated — review before     │
   │    submitting on GeM.                │
   └──────────────────────────────────────┘
6. Preview → Download as PDF
7. Auto-saved to Bid History
```

---

### 7.6 Tender Alerts (`/alerts`) — Pro Only

**Three alert sources (combined for maximum coverage):**

```
Source 1: NIC/CPP Portal RSS feeds
  → Legal, reliable, broad coverage
  → Parsed every 6 hours

Source 2: GeM web scraper
  → Maximum data, monitor carefully
  → Runs every 6 hours
  → Graceful fallback if blocked

Source 3: User-submitted tenders
  → Community-driven, crowdsourced
  → Verified before broadcasting
```

**User configuration:**
- Select categories to watch
- Select states to watch
- Add keywords (e.g. "vehicle hiring", "laptop", "uniform")
- Choose channels: Push ✓ WhatsApp ✓ Email ✓

**Alert notification format:**
```
"नया Tender! DMRC Vehicle Hiring — Bihar
Last date: 5 April 2026 | Value: ₹45L
[देखें →]"
```

---

### 7.7 Learning Center (`/learn`) — Free for All

**Content:**
- How to register on GeM (step-by-step)
- How to read a tender document
- How to avoid common bid rejection reasons
- EMD and bid security explained
- L1 pricing strategy
- Post-win: raising invoices on GeM

**Format:** Short articles + embedded YouTube video guides in Hindi
**Purpose:** SEO traffic, user trust, reduces support load

---

### 7.8 Orders Tracker (`/orders`) — Pro Only

**Features:**
- Log won tenders as work orders
- Track milestones: Delivery → Inspection → Invoice → Payment
- Upload delivery/completion documents
- Payment status (pending / partial / received)
- Reminders for invoice submission deadlines

---

### 7.9 Settings (`/settings`)

**Profile section:**
- Edit: name, business name
- GSTIN (validated: 15-char alphanumeric format XX99AAAAA9999A9Z9)
- Udyam Registration Number (validated: UDYAM-XX-00-0000000 format)
- Change state + categories (triggers re-filter across Finder + Alerts)

**Language:**
- Switcher shows all 11 languages with native script labels
- On change: Firestore `users/{uid}.language` updated immediately
- All active sessions (other devices) reflect change within ~1 second via Firestore listener

**Notifications:**
- Toggle: Push notifications (re-prompts browser permission if previously declined)
- Toggle: WhatsApp alerts (requires phone number to be set)
- Toggle: Email alerts (requires email to be set)
- Each channel shows status: Enabled / Disabled / Not configured

**Subscription:**
```
┌─────────────────────────────────────────────┐
│ Current Plan: Pro Monthly                   │
│ Next renewal: 20 April 2026 — ₹589          │
│                                             │
│ [Switch to Annual — Save ₹990]              │
│ [Cancel Plan]                               │
└─────────────────────────────────────────────┘
```
- "Cancel Plan" → Flow 8 (cancel/downgrade confirmation modal)
- "Switch to Annual" → Razorpay plan switch flow
- Free users see: "Upgrade to Pro" CTA with feature list

**Account:**
- Logout (clears Firebase Auth session)
- Delete Account → confirmation modal → sets `deletionRequested: true` in Firestore
  - Banner shown: "Account 30 दिनों में delete हो जाएगा। Undo करें।"
  - Cloud Function processes deletion nightly

---

## 8. Freemium Gate Rules

| Rule | Detail |
|---|---|
| Never hide Pro features | Show them, dim them, explain what they unlock |
| Always show usage counter | `AI: 8/10 ✦` in header for free users |
| Contextual upgrade prompts | Triggered at the moment of need, not random popups |
| Instant unlock after payment | Firestore plan field updates in real-time via webhook |
| Free trial | 7-day Pro trial on first signup, no card required |

### Upgrade Prompt Design
```
┌─────────────────────────────────────────┐
│ 🔒 आपने इस महीने 10/10 AI queries      │
│    use कर लिए।                          │
│                                         │
│  Pro में: Unlimited queries +           │
│  WhatsApp alerts + Bid Generator        │
│                                         │
│  [₹499/month]    [₹3,999/year ✨]      │
└─────────────────────────────────────────┘
```

---

## 9. Firestore Data Models

### `users/{uid}`
```typescript
{
  uid: string
  name: string
  businessName: string
  phone: string | null
  email: string | null
  gstin: string | null
  udyamNumber: string | null
  state: string
  categories: string[]
  language: 'en' | 'hi' | 'bn' | 'mr' | 'ta' | 'te' | 'gu' | 'kn' | 'pa' | 'or' | 'ml'  // all 11 languages, V1
  plan: 'free' | 'pro'
  trialUsed: boolean
  trialEndsAt: Timestamp | null
  proSince: Timestamp | null
  proRenewsAt: Timestamp | null
  razorpayCustomerId: string | null
  razorpaySubscriptionId: string | null
  experienceYears: number | null        // used for Win Probability Score + Bid Generator pre-fill
  fcmToken: string | null               // Firebase Cloud Messaging token for push notifications
  notificationsDeclined: boolean        // true if user skipped push permission in onboarding
  scheduledDowngradeAt: Timestamp | null // set on cancellation, processed by cron at period end
  deletionRequested: boolean            // DPDP right-to-erasure flag
  deletionRequestedAt: Timestamp | null // when deletion was requested, Cloud Function processes nightly
  createdAt: Timestamp
}
```

### `aiUsage/{uid}/{YYYY-MM}`
```typescript
{
  queries: number    // resets each month
  bidDocs: number    // resets each month
  month: string      // "2026-03"
}
```

### `tenders/{tenderId}`
```typescript
{
  id: string
  userId: string
  name: string
  gemId: string | null
  category: string
  state: string
  deadline: Timestamp
  status: 'active' | 'won' | 'lost' | 'expired'
  notes: string | null
  originalText: string | null   // pasted tender text
  aiSummary: string | null      // generated summary
  createdAt: Timestamp
}
```

### `documents/{docId}`
```typescript
{
  id: string
  userId: string
  name: string
  type: 'rc' | 'gst' | 'insurance' | 'itr' | 'msme' | 'pan' | 'udyam' | 'other'
  fileUrl: string               // Firebase Storage URL
  filePath: string              // Firebase Storage path
  expiresAt: Timestamp | null
  expiryAlertSent: boolean
  uploadedAt: Timestamp
}
```

### `alerts/{alertId}`
```typescript
{
  id: string
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

### `orders/{orderId}`
```typescript
{
  id: string
  userId: string
  tenderId: string
  workOrderNumber: string | null
  value: number | null
  status: 'delivery_pending' | 'inspection_pending' | 'invoice_pending' | 'payment_pending' | 'completed'
  milestones: {
    deliveryDate: Timestamp | null
    inspectionDate: Timestamp | null
    invoiceDate: Timestamp | null
    paymentDate: Timestamp | null
  }
  notes: string | null
  createdAt: Timestamp
}
```

### `bidHistory/{bidId}`
```typescript
{
  id: string
  userId: string
  tenderId: string
  generatedContent: string      // full AI-generated bid document
  formInputs: {
    experience: string
    pastContracts: string
    capacity: string
    quotedRate: string
  }
  winProbabilityScore: number | null   // 0-100, computed at generation time
  createdAt: Timestamp
}
```

### `platformStats` (single document)
```typescript
// Path: platformStats/global
// Updated daily by a Cloud Function (scheduled job)
{
  vendorCount: number           // total registered users
  tendersFiled: number           // total tenders saved across all users
  tendersWon: number            // total tenders marked as 'won'
  winRateByCategory: {          // used for Win Probability Score heuristics
    [category: string]: number  // e.g. { "transport": 0.34, "it": 0.28 }
  }
  winRateByState: {
    [state: string]: number     // e.g. { "bihar": 0.41, "maharashtra": 0.29 }
  }
  lastUpdatedAt: Timestamp
}
```

### Multi-device Session Behaviour
```
Language preference  → Stored in Firestore users/{uid}.language
                       → Synced in real-time via Firestore onSnapshot listener
                       → Changing language on one device updates all active sessions
                          within ~1 second (Firestore real-time propagation)

Active session auth  → Firebase Auth handles multi-device sessions natively
                       → No explicit session conflict management needed in V1
                       → Each device holds its own Firebase ID token (auto-refreshed)

Plan changes         → users/{uid}.plan is listened to on all active sessions
                       → Upgrading on one device unlocks Pro on all other open tabs
                          and devices instantly (same Firestore listener pattern)
```

---

## 10. Branding & UI

### Name & Identity
```
Name:     TenderSarthi
Tagline:  सरकारी टेंडर, आसान तरीके से
Logo:     Compass on navy background, orange needle
          (guidance metaphor — Sarthi = charioteer/guide)
```

### Color Palette
```
Primary Navy    #1A3766   → trust, government-adjacent, primary surfaces
Action Orange   #F97316   → CTAs, highlights, energy
Pro Gold        #D97706   → premium features, upgrade UI elements
Success Green   #16A34A   → won tenders, completed steps
Surface White   #FFFFFF   → cards, modals
Muted Gray      #6B7280   → secondary text, disabled states
Background      #F0F4FB   → page background (light navy tint)
Error Red       #DC2626   → urgent deadlines, errors
```

### Typography
```
Headings:    Poppins Bold/SemiBold
Body:        Inter Regular/Medium
Hindi/Indic: Noto Sans Devanagari, Bengali, Tamil, Telugu, Gujarati,
             Kannada, Gurmukhi, Odia, Malayalam (all V1 — Google Fonts)
```

### Brand Voice
```
✅ Warm, like a knowledgeable friend
✅ Hinglish — never formal Hindi, never pure English
✅ Encouraging: "Aap kar sakte ho!"
✅ Simple — no jargon, no bureaucratic tone
❌ Never intimidating or government-stiff
❌ Never patronizing
```

### Mobile UI Patterns
```
Bottom nav          → Dashboard / Find / Tenders / Bid / More
Cards               → Familiar from PhonePe, Paytm
Swipe to dismiss    → deadlines, alerts
Pull to refresh     → tender list
Skeleton loaders    → while AI generates (not spinners)
Bottom sheets       → filters, settings drawers on mobile
Status badges       → color-coded (🔴 🟡 🟢) for deadlines
FAB button          → "+ Add Tender" on /tenders page
Toast notifications → success/error feedback
Progress bars       → document checklist, onboarding steps
```

### PWA Configuration
```
App icon:   Compass on #1A3766 background, orange needle
Splash:     Navy background, TenderSarthi wordmark + tagline
Theme color: #1A3766
```

---

## 11. User Flows

### Flow 1 — First Time User
```
Landing → Sign Up (Google OR Phone OTP) → 4-step onboarding
→ Dashboard (pre-filtered to profile)
```

### Flow 2 — Core Daily Flow
```
Dashboard → Find Tenders → Filter → GeM deep link (new tab)
→ Copy tender text → Paste in app → AI summarizes
→ Save tender → Set deadline → Tracked in dashboard
```

### Flow 3 — Hitting Free Limit
```
11th AI query → Query shows 2 lines → Soft gate appears
→ Upgrade CTA → /upgrade → Razorpay → Webhook → Instant unlock
```

### Flow 4 — Upgrade
```
/upgrade → Monthly ₹499 OR Annual ₹3,999
→ Razorpay (UPI / card / netbanking)
→ Payment success → Firestore plan: "pro" → Real-time unlock
→ WhatsApp confirmation
```

### Flow 5 — Tender Alert (Pro)
```
/alerts → Configure categories + states + keywords + channels
→ Background job (6hrs) scrapes NIC + GeM + community
→ Match found → Push + WhatsApp + Email
→ Tap → App opens → Tender pre-loaded in Finder
```

### Flow 6 — Bid Document Generator (Pro)
```
My Tenders → Select tender → "Generate Bid Document"
→ Short form (experience, capacity, rate)
→ AI generates full bid response → Preview → PDF download
→ Auto-saved to bid history
```

### Flow 7 — Document Expiry
```
/documents → Upload → Tag type → Set expiry date
→ 30 days before expiry: WhatsApp + push alert
→ "⚠️ Insurance 30 दिन में expire होगी। Renew करें।"
```

### Flow 8 — Subscription Cancel / Downgrade

**Cancel mid-month (monthly plan):**
```
/settings → Subscription → "Cancel Plan"
→ Confirmation modal: "Cancel करने पर आपके Pro features
   billing period के अंत तक active रहेंगे।"
→ User confirms → Razorpay subscription cancelled via API
→ Firestore: scheduledDowngradeAt = end of billing period
→ Cron job at period end: plan = "free", Pro data preserved
→ Email + WhatsApp confirmation sent
```

**Cancel annual plan:**
```
Same flow as monthly.
Refund eligibility: within 7 days of purchase → full refund via Razorpay.
After 7 days → no refund, access till annual period ends.
```

**Monthly → Annual upgrade:**
```
/settings → Subscription → "Switch to Annual (₹3,999/year)"
→ Razorpay: cancel monthly sub + create new annual sub
→ Remaining days on monthly plan credited as discount
→ Firestore plan updated instantly via webhook
```

**Downgrade data policy:**
- All Pro data (documents, bid history, orders) is **preserved** for 90 days after downgrade
- User sees dimmed Pro features with "Reactivate Pro to access" prompt
- After 90 days: data archived (not deleted) — DPDP-compliant
- User can reactivate and get all data back

**Razorpay webhook events handled:**
```
subscription.cancelled  → schedule downgrade in Firestore
subscription.charged    → extend proRenewsAt
payment.failed          → retry logic + notify user
refund.processed        → log in Firestore
```

---

## 12. Subsystems for Implementation Planning

The application is broken into the following independent subsystems, each to be implemented as a separate plan:

| # | Subsystem | Description |
|---|---|---|
| 1 | **Foundation** | Next.js setup, Firebase config, auth (Google + OTP), onboarding, i18n scaffold |
| 2 | **Dashboard + Tender Finder** | Dashboard UI, Finder with filters, AI summarizer, save tender flow |
| 3 | **My Tenders + Deadline Tracker** | Tender list, deadline tracking, Algolia search |
| 4 | **Document Vault** | Upload, storage, checklist, expiry tracking |
| 5 | **Bid Helper** | AI chat, bid document generator, PDF export |
| 6 | **Alert System** | NIC RSS parser, GeM scraper, alert config UI, MSG91 integration, FCM push |
| 7 | **Orders Tracker** | Work order logging, milestone tracking, payment status |
| 8 | **Learning Center** | Content pages, SEO optimization |
| 9 | **Payments + Freemium Gates** | Razorpay subscriptions, webhook handler, gate enforcement, upgrade UI |
| 10 | **Landing Page + PWA** | Marketing page, PWA manifest, install prompt |
| 11 | **Admin Panel** | /admin protected route — user management, MRR dashboard, community tender moderation, scraper health, Learning Center CRUD |

---

## 13. Admin Panel

A lightweight internal tool at `/admin` — protected by email whitelist (founder only in V1). Same Next.js codebase, no separate deployment needed.

### 5 Admin Screens

| Route | Screen | Purpose |
|---|---|---|
| `/admin` | Overview Dashboard | Signups today/week/month, MRR, Pro users, free→Pro conversion %, AI query volume |
| `/admin/users` | User Management | List all users, search by name/phone/email, view plan + AI usage, manual plan toggle for support |
| `/admin/tenders` | Community Tender Moderation | Queue of user-submitted tenders, approve → broadcast to matching users, reject with reason |
| `/admin/alerts` | Alert System Health | Scraper last run time, status (healthy/blocked), alerts sent today, NIC RSS feed status, error log |
| `/admin/learn` | Learning Center CMS | Add/edit/delete articles, set language, publish/unpublish, view page traffic |

### Access Control
```
Middleware checks: session.email === process.env.ADMIN_EMAIL
Redirect to /dashboard if not authorized
No public-facing admin registration — hardcoded email check only
```

### What This Replaces
- Firebase Console for user management (clunky, risky direct Firestore edits)
- Razorpay dashboard for subscription overview (still use Razorpay for payments, but surfaced here)
- Manual log checking for scraper health
- Editing JSON files for Learning Center content

---

## 14. Future Prospects

### Product Roadmap (Post V1)

| Feature | Description | Why |
|---|---|---|
| **B2B Team Accounts** | Multiple users under one business (CA firms, MSME consultants serving multiple vendors) | ₹1,999–4,999/month — 4x ARPU jump |
| **AI Price Benchmarker** | Suggest optimal L1 rate based on historical winning bids in the same category | Highest-value feature for serious vendors |
| **Bid Win Rate Analytics** | Track win/loss ratio per category, state, price range | Turns TenderSarthi into a strategic tool |
| **GeM Compliance Checker** | Auto-validate documents before bid submission — flag missing or expired items | Reduce disqualifications before they happen |
| **Tender Portal Expansion** | Add CPPP, state GeM portals (Maharashtra, UP, Tamil Nadu) beyond central GeM | 3x addressable market |
| **Native Mobile Apps** | Android + iOS apps once PWA proves product-market fit | App Store discovery channel unlocked |
| **ONDC Integration** | Connect vendors to Open Network for Digital Commerce | Future-proof as government expands ONDC |
| **Referral Program** | Unique referral link per user — friend gets 1 free Pro month, referrer gets ₹100 account credit | Viral growth in vendor WhatsApp communities |

**Referral mechanics (when built):**
- Firestore model: `referrals/{referralId}` with `referrerId`, `refereeId`, `status`, `creditApplied`
- Referral link: `tendersarthi.in/r/{uid}` → signup with pre-filled referral tracking
- Credit applied automatically after referee's first payment clears

---

### Revenue Stream Expansion

| Stream | Model | Potential |
|---|---|---|
| **Current:** Pro subscriptions | ₹499/month per vendor | ₹4.9L MRR at 1,000 users |
| **B2B Team Plans** | ₹1,999–4,999/month per firm (5–10 users) | 1 CA firm = 5–10x individual plan |
| **White-label Licensing** | License platform to MSME helpdesks, industry bodies | ₹50K–2L/month per enterprise client |
| **Premium Courses** | "GeM Certified Vendor" courses in Hindi | ₹999–2,999 one-time per course |
| **Data Insights Reports** | Anonymized tender analytics for industry associations | ₹10K–50K per report |
| **Affiliate/Referral** | Commission from document prep services, CA partners | Passive, scales with user base |

---

### Market Expansion

**Domestic — Beyond Central GeM:**
- State government procurement portals (each state has its own portal)
- Defence procurement (DRDO, armed forces vendor portals)
- Railway tenders (IRCTC, RailTel, zone-wise portals)
- Municipal corporation tenders (BMC, GHMC, BBMP)

**International — Replicable Model:**
```
Bangladesh  → Government procurement portal (CPTU)
Sri Lanka   → National Procurement Commission
Nepal       → Public Procurement Monitoring Office
UAE         → Government procurement (Tejari, Etimad)
```
The core product — AI-powered, multilingual tender assistant — is a universal problem
in any country with government procurement portals and non-English vendors.

---

### Funding Trajectory

| Milestone | Target | Raise | Use of Funds |
|---|---|---|---|
| Bootstrap | 0 → 1,000 Pro users | — | Self-funded from MRR |
| Seed Round | ~₹5L MRR (1,000 users) | ₹1–3 Cr | Engineering team (2–3 devs), marketing |
| Series A | ~₹50L MRR (10,000 users) | ₹10–25 Cr | Sales team, mobile apps, international expansion |

**Investor pitch angle:** "We are building the GeM operating system for India's 17 lakh+ small vendors — the last mile of India's government procurement digitisation story."

---

### Competitive Moat (Long-term)

The longer TenderSarthi runs, the stronger its moat becomes:

1. **Data moat** — Historical bid data, win rates, and pricing by category builds a dataset no competitor can easily replicate
2. **Community moat** — Vendor WhatsApp groups and referral networks create switching costs
3. **Language moat** — 11 languages with tuned Hinglish AI voice takes time and domain knowledge to replicate
4. **Trust moat** — Vendors who win their first tender using TenderSarthi become evangelists; word-of-mouth in vendor communities is the primary acquisition channel at scale

---

## 15. UX Principles & Design Decisions

These principles were incorporated after external product design review (rated PRD 8.8/10). All implementation subsystems must honour these.

---

### 15.1 "Help You Win" Positioning

**Decision:** The hero tagline on landing + onboarding is "सरकारी टेंडर जीतो, आसानी से" — not "आसान तरीके से".

**Why it matters:** "आसान" (easy) positions TenderSarthi as a simplification tool. "जीतो" (win) positions it as a success tool. For a vendor evaluating ₹499/month spend, "will I win more tenders?" is a far more compelling question than "will this be easier?". The brand tagline remains "सरकारी टेंडर, आसान तरीके से" — the landing/onboarding hero specifically uses the "win" variant.

**Implementation:** Landing page hero, onboarding Step 1 header, and PWA splash screen use "जीतो" tagline.

---

### 15.2 Trust Signals as a Core Product Feature

**Decision:** Trust signals are not just landing page decoration — they appear inside the app on the Dashboard for all users.

**Signals to surface:**
- Platform-level: total vendors on TenderSarthi, total tenders filed, tenders won
- Personal-level: "You have saved 7 tenders and won 2" (Pro users)
- Social proof: rotating success stories widget ("Rajesh from Bihar won ₹12L contract")

**Data source:** A single `platformStats` Firestore document updated daily by a background Cloud Function.

**Why it matters:** GeM vendors are skeptical. A tool that shows "8,200 tenders won on our platform" is not just marketing — it reduces the anxiety of first-time use and upgrades the perceived ROI of Pro.

---

### 15.3 Win Probability Score

**Decision:** Before generating a bid document, show the user a probability score for this specific tender.

**Factors (V1 — simple heuristics, not ML):**
- Category match: does the user's profile match the tender category? (high weight)
- Experience: years of experience in profile vs. typical winner profile (medium weight)
- State competition: historically how competitive is this state/category combo? (medium weight)
- Tender value: smaller-value tenders have higher win probability for small vendors (low weight)

**Display:** A scored card (0–100%) with a 3-tier label:
```
< 40% → "कठिन — लेकिन कोशिश करें"  (Hard, but try)
40–70% → "अच्छा मौका है"              (Good chance)
> 70% → "Strong bid position! 🎯"
```

**Powered by:** Gemini Flash 2.0 as part of the bid generation call (no separate API call needed — the probability is computed in the same prompt).

**Caution:** Never present probability as a guarantee. Always include: "यह estimate है — GeM पर जाकर verify करें।"

---

### 15.4 AI Confidence Indicators

**Decision:** All AI-generated content displays a consistent disclaimer. Non-negotiable.

**Standard disclaimer (all AI outputs):**
```
ℹ️ AI Summary — verify on GeM portal before acting.
```

**Where it appears:**
- Tender Finder AI summary (below every generated summary)
- Bid Helper AI chat (below every response)
- Bid Document Generator (on the preview screen + in the PDF footer)
- Document checklist AI suggestions (if added in future)

**Design:** Muted gray (#6B7280), 12px, italic. Never colored, never alarming. Builds trust by being consistently honest — not by hiding AI's limitations.

---

### 15.5 Progressive Disclosure

**Decision:** New users (first 14 days or < 3 tenders saved) see a simplified dashboard with only 3 feature modules visible. More unlock as they engage.

**Unlock sequence:**
```
Day 0 (signup):       Find Tenders + My Tenders + Bid Helper
First tender saved:   Deadline Tracker unlocked
First bid generated:  Orders Tracker unlocked
Day 14 or Pro:        All features visible, no progressive hiding
```

**"Discover more →" chip:** Always present below the 3 initial cards — never hides that more exists. Progressive disclosure ≠ hiding features.

**Why it matters:** Our users are non-technical small business owners, many filling their first-ever GeM tender. Showing 9 modules on day 1 creates decision paralysis. Showing 3 creates a path forward.

---

### 15.6 Anxiety-Reducing UX Patterns

**Decision:** The UI actively reduces uncertainty at every step. Tendering is stressful — TenderSarthi should feel like a calm guide, not another bureaucratic interface.

**Patterns to implement across all subsystems:**

| Pattern | Where | Implementation |
|---|---|---|
| **Checklist-style flows** | Document Vault, Bid Generator | Show steps as a checklist, check off as user completes each one |
| **"You're ready" confirmation screens** | After bid generation, after document upload | Full-screen confirmation: "आपका [X] तैयार है! ✅" — explicit, reassuring |
| **Progress bars** | Onboarding, Document Vault, Bid Generator form | Never show a blank form — always show "Step 2 of 4" progress |
| **Pre-filled smart defaults** | Bid Generator form, Alert config | Pre-fill from user profile (state, category, experience) — user edits rather than starts from blank |
| **Undo / cancel affordance** | All destructive actions | "Archive" not "Delete" for tenders; confirmation before clearing bid history |
| **Friendly empty states** | My Tenders (0 tenders), Orders (no wins yet) | "अभी कोई tender नहीं — चलो खोजते हैं! [Find Tenders →]" — never blank |
| **Error messages in plain language** | Form validation, API failures | Never "Error 422" — always "Phone number 10 digits का होना चाहिए।" |

**"You're ready to bid" screen (mandatory in Bid Generator):**
```
┌──────────────────────────────────────────┐
│         ✅ आप bid के लिए तैयार हैं!     │
│                                          │
│ आपका bid document बन गया है।            │
│                                          │
│ अगला step:                               │
│ 1. Document review करें (नीचे)           │
│ 2. PDF download करें                     │
│ 3. GeM portal पर upload करें            │
│                                          │
│ [PDF Download करें] [GeM पर जाएं →]     │
│                                          │
│ 💡 AI-generated — GeM submit करने से    │
│    पहले एक बार review करें।             │
└──────────────────────────────────────────┘
```

---

## 16. GTM & Marketing Strategy

### Phase 1 — Validate (Month 1–3)

**Goal:** First 50 free users, 5 paying Pro users.

| Channel | Action |
|---|---|
| Father's vendor network | WhatsApp broadcast to his GeM vendor contacts — first 20 users |
| YouTube Hindi | 3–5 short tutorials: "GeM tender kaise bhare", "EMD kya hota hai" — SEO + trust |
| Instagram Reels | 30-second problem-solution reels in Hindi — "Tender fill karna ab easy hai" |
| LinkedIn | Founder story — building TenderSarthi, what GeM vendors face |
| Waitlist page | Simple landing page — collect emails before launch, build anticipation |

**Distribution strategy:** Bootstrap-first, zero paid ads. Organic content compounds; paid ads for a pre-PMF product burns money.

---

### Phase 2 — Beta (Month 3–6)

**Goal:** 50 Pro users, ₹25,000 MRR.

| Channel | Action |
|---|---|
| WhatsApp vendor groups | Join GeM vendor WhatsApp communities; share genuinely useful tips + tool |
| Product Hunt launch | List on Product Hunt — targets startup/product community, earns backlinks |
| YourStory / Inc42 | Pitch "AI for GeM vendors" angle — Indian startup press |
| MSME workshops | Partner with MSME helpdesks for free vendor training sessions |
| Referral soft-launch | Give existing users a referral link — friend gets 1 free Pro month, referrer gets ₹100 credit |

---

### Phase 3 — Scale (Month 6–12)

**Goal:** 500+ Pro users, ₹2.5L+ MRR.

| Channel | Action |
|---|---|
| SEO via Learning Center | 50+ Hindi articles ranking for "GeM tender", "EMD kya hai", category-specific guides |
| CA partnerships | CA firms and MSME consultants who serve vendor clients — affiliate/referral |
| Regional content | Tamil, Marathi, Bengali language content for state-specific vendor communities |
| Paid ads (small test) | ₹5,000/month Google Search — "GeM tender software", "GeM bid help" |
| WhatsApp Business API | Broadcast tender alerts to opted-in users — viral sharing in vendor groups |

---

### GTM Key Insight

**The father is the unfair advantage.** A real GeM vendor in the network = first user, feedback loop, and referral seed. Every startup wishes it had a domain expert on day 1. TenderSarthi does.

**Word of mouth compounds in vendor communities.** One vendor wins a tender using TenderSarthi → tells 5 others in their WhatsApp group → exponential growth that no paid ad can replicate.

---

## 17. Compliance & Legal Checklist

TenderSarthi operates in a regulated space (government data, payments, user data, AI outputs). The following compliance obligations must be addressed before public launch.

---

### 17.1 DPDP Act 2023 — Digital Personal Data Protection

India's new data protection law is partially in force. TenderSarthi collects names, phone numbers, business details, and uploaded documents.

**Obligations:**

| Requirement | Implementation |
|---|---|
| Explicit consent before data collection | Consent checkbox on signup (pre-checked not allowed) |
| Privacy Policy in English + Hindi | `/privacy` route, linked in footer + signup |
| Right to erasure | "Delete my account" flow in Settings — deletes Firestore + Storage data within 30 days |
| Data Fiduciary registration | Monitor MeitY notifications; register once rules are fully notified |
| Breach notification | Notify affected users within 72 hours of any breach |

**Firestore implication:** Add a `deletionRequested: true` flag + `deletionRequestedAt` timestamp to `/users/{uid}`. A Cloud Function processes deletions nightly.

---

### 17.2 GST Compliance

Software subscriptions attract **18% GST** in India.

| Rule | Action |
|---|---|
| Register on GST portal when turnover > ₹20L | Register proactively at ₹10L to avoid disruption |
| Collect GST on ₹499/month | Display "₹499 + 18% GST = ₹589/month" clearly at checkout |
| Issue GST invoices | Use Razorpay Invoices API or generate via Cloud Function |
| File GSTR-1 + GSTR-3B monthly | Assign to accountant from Month 1 |

---

### 17.3 GeM Data Scraping — Legal Risk Management

GeM's Terms of Service prohibit automated scraping. The 3-source alert strategy mitigates this:

| Source | Legal Status | Usage |
|---|---|---|
| NIC/CPP RSS feeds | Fully legal — public government data | Primary source for all alerts |
| User-submitted tenders | Legal — crowdsourced, user-initiated | Secondary source |
| GeM portal scraper | Grey zone — monitor carefully | Last resort only |

**Scraper safeguards (if used):**
- Respect `robots.txt`
- Rate limit to 1 request per 10 seconds per IP
- Use rotating residential proxies
- Frame in ToS as "user-agent browsing on user's behalf"
- Shut off instantly if GeM sends cease and desist

---

### 17.4 IT Act 2000 — Intermediary Liability

TenderSarthi aggregates government data and stores user-uploaded documents.

**Required:**
- Terms of Service stating TenderSarthi is an information aggregator, not a legal advisor
- Disclaimer on all AI outputs: "AI-generated content — verify on GeM portal before use"
- No liability clause for tender accuracy or bid outcome
- Grievance Officer: Name + email + phone on website (mandatory under IT Rules 2021)
- Respond to grievances within 15 days

**ToS must explicitly state:**
"Bid documents generated by TenderSarthi are AI-assisted drafts. They do not constitute legal advice. Always verify tender requirements on the official GeM portal before submitting."

---

### 17.5 Consumer Protection (E-Commerce) Rules 2020

| Requirement | Where |
|---|---|
| Display total price including taxes before purchase | Checkout screen |
| Refund policy clearly stated | Pricing page + checkout |
| Grievance officer contact | Footer and /contact page |
| No dark patterns (pre-checked upgrades, hidden fees) | Checkout UI audit |

**Refund Policy (recommended):** 7-day full refund for annual plans, no refund for monthly after first 48 hours.

---

### 17.6 Startup India — DPIIT Registration

| Benefit | Eligibility |
|---|---|
| 80IC tax exemption — 100% profit deduction for 3 years | Register before first profitable year |
| Self-certification for 9 labour laws | Applicable from Day 1 |
| Fast-track patent filing (80% fee reduction) | Apply if IP is created |

**Action:** Register at startupindia.gov.in in Month 1. Free, online, takes approximately 7 working days.

---

### 17.7 Trademark Registration

Register "TenderSarthi" under Class 42 (Software as a Service) on the IP India portal.

| Detail | Value |
|---|---|
| Class | 42 (Computer software, SaaS) |
| Fee (Startup/Individual) | Rs 4,500 |
| Timeline | 18 to 24 months for registration |
| Interim protection | From date of filing |

**Action:** File trademark before any public marketing to establish priority date.

---

### 17.8 Pre-Launch Compliance Checklist

| Item | Priority | When |
|---|---|---|
| Privacy Policy (EN + HI) live at /privacy | Critical | Before any users |
| Terms of Service live at /terms | Critical | Before any users |
| Consent checkbox on signup | Critical | Before any users |
| GST registration | Critical | Before first paid user |
| Account deletion flow in Settings | Critical | V1 launch |
| AI-generated disclaimer on all AI outputs | Critical | V1 launch |
| Grievance Officer name + email on website | Critical | Before launch |
| Razorpay GST invoice config | High | Before first paid user |
| DPIIT Startup India registration | High | Month 1 |
| Trademark filing (TenderSarthi, Class 42) | High | Before marketing |
| Scraper rate-limiting + robots.txt compliance | High | Before alerts go live |
| DPDP deletion Cloud Function | Medium | V1 launch |
| DPDP Data Fiduciary registration | Monitor | When notified by MeitY |

---
*End of PRD — TenderSarthi v1.0*

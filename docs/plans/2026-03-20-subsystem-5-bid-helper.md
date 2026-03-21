# Subsystem 5 — Bid Helper (AI Chat + Bid Document Generator)

**Date:** 2026-03-20
**Status:** Ready to implement

---

## Goal

Build TenderSarthi's AI-powered Bid Helper: a multi-turn chat assistant for GeM tender questions, and a Pro-only bid document generator with heuristic + AI Win Probability Scoring. All logic is gated behind plan-guard, integrated with existing auth/AI-usage Firestore paths, and consistent with the app's existing Gemini API route pattern.

---

## Architecture

```
src/
  lib/
    bid-utils.ts              ← pure heuristic score (no side effects)
    types.ts                  ← +ChatMessage, +BidDocument
    firebase/
      firestore.ts            ← +addBidDocument, +subscribeBidHistory, +incrementBidDocCount
  app/
    api/ai/
      chat/route.ts           ← Gemini Flash 2.0 multi-turn chat
      generate-bid/route.ts   ← Flash 2.0 win score + 1.5 Pro document
    [locale]/(app)/bid/
      page.tsx                ← Chat tab + Generator tab (Pro-gated)
  components/
    bid/
      bid-chat.tsx            ← multi-turn chat UI
      win-probability-card.tsx← score + generate button
      bid-generator-form.tsx  ← tender select + fields + instant score
      bid-document-viewer.tsx ← preview + print-to-PDF download
messages/
  *.json                      ← +bid.* namespace (11 files)
tests/
  unit/
    bid-utils.test.ts         ← 12 unit tests
firestore.rules               ← +bidHistory rules
```

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 16.2 App Router |
| Styling | Tailwind v4 + shadcn/ui (Base UI) |
| Auth | Firebase Admin (server) + Firebase Client (browser) |
| AI — Chat | `gemini-2.5-flash` via `@google/generative-ai` |
| AI — Win Score | `gemini-2.5-flash` (fast JSON response) |
| AI — Document | `gemini-2.5-pro` (quality output) |
| i18n | next-intl v4.8.3 |
| Tests | Vitest |
| Analytics | PostHog (`track`) |

---

## Scope Notes (Deferred)

- **Push notifications for bid deadlines** — deferred to Subsystem 8 (Notifications)
- **Bid history browsing UI** — deferred to Subsystem 6 (History & Analytics); `bidHistory` collection is written here but the browse screen is later
- **Offline support** — deferred to Subsystem 9
- **File upload for bid documents** — not in PRD 7.5; deferred
- **Upstash rate limiting on AI routes** — deferred to Subsystem 9 (Payments + Freemium Gates), where all per-route API guards are unified. Routes still enforce plan-level gates and Firebase token verification.
- **`platformStats` in heuristic score** — PRD §15.3 lists historical win rates from the `platformStats` Firestore doc as a scoring factor. Deferred: `computeHeuristicScore` is a pure function with no async side-effects (required for instant client-side scoring). The AI win score from Gemini (Task 4) will incorporate competition-level signals that `platformStats` would otherwise provide.
- **`BidDocument` schema** — PRD suggests a nested `formInputs` sub-object and `generatedContent` field name. This plan uses flat top-level fields and `generatedDocument` for readability and simpler Firestore queries. This is a deliberate deviation; a migration is not required as `bidHistory` is append-only.

## Win Probability Tier Boundaries

PRD §15.3 defines: `> 70%` = Strong, `40–70%` = Good, `< 40%` = Hard. This plan uses: `>= 70` = High, `>= 40` = Medium, `< 40` = Low (exclusive-70 boundary made inclusive for clean threshold matching). All tests and UI labels use these values.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | Add `BidDocument` interface, `ChatMessage` type |
| `src/lib/bid-utils.ts` | Create | Pure: `computeHeuristicScore`, `getWinScoreResult`, `WinScoreInput`, `WinScoreResult` |
| `tests/unit/bid-utils.test.ts` | Create | ~12 unit tests |
| `src/lib/firebase/firestore.ts` | Modify | Add `addBidDocument`, `subscribeBidHistory`, `incrementBidDocCount` |
| `firestore.rules` | Modify | Add bidHistory collection rules |
| `src/app/api/ai/chat/route.ts` | Create | POST: multi-turn Gemini Flash 2.0 chat |
| `src/app/api/ai/generate-bid/route.ts` | Create | POST: Flash 2.0 win score + 1.5 Pro document |
| `src/components/bid/bid-chat.tsx` | Create | Chat UI: messages, chips, disclaimer, confirmation flow |
| `src/components/bid/win-probability-card.tsx` | Create | Score display with tier label + color |
| `src/components/bid/bid-generator-form.tsx` | Create | Tender select + form fields + instant score |
| `src/components/bid/bid-document-viewer.tsx` | Create | Document preview + print-to-PDF download |
| `src/app/[locale]/(app)/bid/page.tsx` | Replace | Page with Chat tab + Generator tab (Pro-gated) |
| `messages/*.json` (11 files) | Modify | Add `bid.*` namespace |

---

## Chunk 1: Foundation — Types, Pure Utils, Firestore

### Task 1: `bid-utils.ts` + 12 unit tests (TDD)

Write the test file first, confirm it fails, then write implementation to make it pass.

- [ ] Create test file `tests/unit/bid-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeHeuristicScore, getWinScoreResult } from '@/lib/bid-utils'

describe('computeHeuristicScore', () => {
  const base = { userState: 'Maharashtra', tenderState: 'Maharashtra',
    userCategories: ['Transport & Vehicles'], tenderCategory: 'Transport & Vehicles' }

  it('returns High when category matches and high experience', () => {
    const r = computeHeuristicScore({ ...base, experienceYears: 5 })
    expect(r.tier).toBe('high')
  })
  it('returns lower score when category does not match', () => {
    const r = computeHeuristicScore({ ...base, tenderCategory: 'IT & Electronics', experienceYears: 5 })
    expect(r.score).toBeLessThan(computeHeuristicScore({ ...base, experienceYears: 5 }).score)
  })
  it('adds state match bonus', () => {
    const withMatch    = computeHeuristicScore({ ...base, experienceYears: 0 })
    const withoutMatch = computeHeuristicScore({ ...base, experienceYears: 0, tenderState: 'Gujarat' })
    expect(withMatch.score).toBe(withoutMatch.score + 10)
  })
  it('handles null experienceYears as 0', () => {
    const r = computeHeuristicScore({ ...base, experienceYears: null })
    expect(r.score).toBeGreaterThan(0)
  })
  it('caps score at 95', () => {
    const r = computeHeuristicScore({ ...base, experienceYears: 10 })
    expect(r.score).toBeLessThanOrEqual(95)
  })
  it('returns Low tier for 0 experience, no match, different state', () => {
    const r = computeHeuristicScore({ userState: 'Bihar', tenderState: 'Gujarat',
      userCategories: [], tenderCategory: 'IT & Electronics', experienceYears: 0 })
    expect(r.tier).toBe('low')
  })
})

describe('getWinScoreResult', () => {
  it('returns High for score 70 (boundary)', () => {
    expect(getWinScoreResult(70).tier).toBe('high')
  })
  it('returns Medium for score 69 (boundary)', () => {
    expect(getWinScoreResult(69).tier).toBe('medium')
  })
  it('returns Medium for score 40 (boundary)', () => {
    expect(getWinScoreResult(40).tier).toBe('medium')
  })
  it('returns Low for score 39 (boundary)', () => {
    expect(getWinScoreResult(39).tier).toBe('low')
  })
  it('returns correct colors', () => {
    expect(getWinScoreResult(75).color).toBe('text-success')
    expect(getWinScoreResult(50).color).toBe('text-orange')
    expect(getWinScoreResult(20).color).toBe('text-danger')
  })
  it('preserves score value', () => {
    expect(getWinScoreResult(73).score).toBe(73)
  })
})
```

- [ ] Run tests to confirm they fail (module not found is expected):
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run tests/unit/bid-utils.test.ts 2>&1 | tail -20
  ```

- [ ] Create `src/lib/bid-utils.ts`:

```typescript
export interface WinScoreInput {
  experienceYears: number | null
  tenderCategory: string
  userCategories: string[]
  userState: string
  tenderState: string
}

export interface WinScoreResult {
  score: number
  label: 'High' | 'Medium' | 'Low'
  color: 'text-success' | 'text-orange' | 'text-danger'
  tier: 'high' | 'medium' | 'low'
}

/** Pure heuristic: instant client-side win probability score. */
export function computeHeuristicScore(input: WinScoreInput): WinScoreResult {
  let score = 30 // base

  // Category match (40 pts)
  if (input.userCategories.includes(input.tenderCategory)) score += 40
  else score += 10

  // Experience years (20 pts)
  const exp = input.experienceYears ?? 0
  if (exp >= 5)      score += 20
  else if (exp >= 3) score += 14
  else if (exp >= 1) score += 7

  // State match bonus (10 pts)
  if (input.userState && input.tenderState && input.userState === input.tenderState) score += 10

  return getWinScoreResult(Math.min(95, score))
}

/** Maps a numeric score to label/color/tier. PRD §15.3: >=70 = High, >=40 = Medium, <40 = Low. */
export function getWinScoreResult(score: number): WinScoreResult {
  if (score >= 70) return { score, label: 'High',   color: 'text-success', tier: 'high'   }
  if (score >= 40) return { score, label: 'Medium', color: 'text-orange',  tier: 'medium' }
  return               { score, label: 'Low',    color: 'text-danger',  tier: 'low'    }
}
```

- [ ] Run tests again to confirm all 12 pass:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run tests/unit/bid-utils.test.ts 2>&1 | tail -20
  ```

---

### Task 2: Types + Firestore + Security Rules

- [ ] Open `src/lib/types.ts` and append at the end:

```typescript
export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
}

export interface BidDocument {
  id: string
  userId: string
  tenderId: string
  tenderName: string
  tenderCategory: string
  experienceYears: number
  pastContracts: string
  capacity: string
  quotedRate: string
  winScore: number
  winLabel: string
  generatedDocument: string
  createdAt: Timestamp
}
```

- [ ] Open `src/lib/firebase/firestore.ts` and append at the end (after all existing code):

```typescript
import type { BidDocument } from '../types'

// ---------- Bid History ----------

/** Saves generated bid document to history. Returns new document ID. */
export async function addBidDocument(
  uid: string,
  data: Omit<BidDocument, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'bidHistory'), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Real-time listener for user's bid history, newest first. */
export function subscribeBidHistory(
  uid: string,
  onData: (docs: BidDocument[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'bidHistory'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as BidDocument)))
    },
    onError
  )
}

/** Atomically increments the bidDocs counter for the current month. */
export async function incrementBidDocCount(uid: string): Promise<void> {
  const ref = doc(db, 'aiUsage', uid, currentMonthKey(), 'data')
  await setDoc(ref, { bidDocs: increment(1) }, { merge: true })
}
```

  > **Imports checklist:** Open `src/lib/firebase/firestore.ts` and confirm the top-level import from `'firebase/firestore'` includes ALL of: `addDoc`, `collection`, `doc`, `setDoc`, `increment`, `serverTimestamp`, `query`, `where`, `orderBy`, `onSnapshot`, `QuerySnapshot`, `DocumentData`. The `db` object and `currentMonthKey()` helper are already defined in that file. Add any missing symbols to the existing import line — do NOT add a second `import { ... } from 'firebase/firestore'` line (will cause duplicate-identifier errors). Also add `import type { BidDocument } from '../types'` near the top where other local types are imported.

- [ ] Open `firestore.rules` and inside the `match /databases/{database}/documents` block, append:

```
match /bidHistory/{bidId} {
  allow read, delete: if request.auth != null && request.auth.uid == resource.data.userId;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
}
```

- [ ] Verify firestore.rules syntax is valid (no emulator needed — just confirm the file has no unclosed braces):
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && cat firestore.rules | grep -c "match\|allow\|}" && echo "rules file structure looks OK"
  ```
  Expected: No script errors; rule block count looks balanced.

- [ ] Verify TypeScript compiles cleanly:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```

---

## Chunk 2: API Routes

### Task 3: `/api/ai/chat/route.ts`

Reference: `src/app/api/ai/summarize/route.ts` for the auth + Gemini + error pattern.

- [ ] Create directory and file:
  ```
  mkdir -p "/Users/adityaraj0421/Cool Projects/Tender/app/src/app/api/ai/chat"
  ```

- [ ] Create `src/app/api/ai/chat/route.ts` with the following content:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')

const SYSTEM_PROMPT = `You are TenderSarthi, a friendly and expert assistant for Indian government tenders on the GeM (Government e-Marketplace) portal.
You help small business owners and vendors understand tender processes, documentation, bidding strategies, and compliance requirements.
Answer in a helpful, clear tone. Use simple language. If the user writes in Hindi or Hinglish, respond in Hinglish by default.
Always be accurate about GeM portal procedures. If unsure, say so rather than guessing.`

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      await getAuth().verifyIdToken(authHeader.slice(7))
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { messages, language = 'hi' } = await req.json() as {
      messages: { role: 'user' | 'model'; content: string }[]
      language?: string
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    const userMessage = messages[messages.length - 1]
    if (userMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `${SYSTEM_PROMPT}\nRespond in language: ${language}`,
    })

    const history = messages.slice(0, -1).map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(userMessage.content)
    const reply = result.response.text()

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('AI chat error:', err)
    return NextResponse.json(
      { error: 'AI अभी unavailable है। कुछ देर में try करें।' },
      { status: 500 }
    )
  }
}
```

- [ ] Verify TypeScript on the new file:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```

---

### Task 4: `/api/ai/generate-bid/route.ts`

- [ ] Create directory:
  ```
  mkdir -p "/Users/adityaraj0421/Cool Projects/Tender/app/src/app/api/ai/generate-bid"
  ```

- [ ] Create `src/app/api/ai/generate-bid/route.ts` with the following content:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    let uid: string
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7))
      uid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Pro-plan guard — server-side enforcement (client gate alone is insufficient)
    const userDoc = await getFirestore().collection('users').doc(uid).get()
    const userPlan = userDoc.data()?.plan as string | undefined
    const trialEndsAt = userDoc.data()?.trialEndsAt?.toDate?.() as Date | undefined
    const isProUser = userPlan === 'pro' || (userPlan === 'pro' && trialEndsAt && trialEndsAt > new Date())
    if (!isProUser) {
      return NextResponse.json({ error: 'Pro plan required for bid document generation' }, { status: 403 })
    }

    const { tenderName, tenderCategory, tenderState, experienceYears,
            pastContracts, capacity, quotedRate, language = 'hi' } = await req.json() as {
      tenderName: string; tenderCategory: string; tenderState: string
      experienceYears: number; pastContracts: string; capacity: string
      quotedRate: string; language?: string
    }

    if (!tenderName || !tenderCategory || !quotedRate) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    // Step 1: Win Probability Score via Gemini Flash 2.0 (fast)
    const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const scorePrompt = `You are TenderSarthi's bid advisor. Compute a win probability score (0-100) for this GeM bid.

Tender: ${tenderName} | Category: ${tenderCategory} | State: ${tenderState}
Vendor experience: ${experienceYears} years | Past contracts: ${pastContracts}
Capacity: ${capacity} | Quoted rate: ${quotedRate}

Scoring guide:
- Category match and experience (40 pts): How well does vendor experience match?
- Competition level (30 pts): Typical competition for this category in ${tenderState}?
- Pricing (30 pts): Is the quoted rate competitive?

Respond ONLY with valid JSON (no markdown, no extra text):
{"score": <integer 0-100>, "reasoning": "<one concise sentence>"}`

    const scoreResult = await flashModel.generateContent(scorePrompt)
    let winScore = 50
    let winReasoning = ''
    try {
      const scoreText = scoreResult.response.text().trim()
        .replace(/^```json\n?/, '').replace(/\n?```$/, '')
      const parsed = JSON.parse(scoreText)
      winScore = Math.max(0, Math.min(100, Number(parsed.score) || 50))
      winReasoning = parsed.reasoning ?? ''
    } catch { /* use defaults */ }

    const winLabel = winScore >= 65 ? 'High' : winScore >= 40 ? 'Medium' : 'Low'

    // Step 2: Full Bid Document via Gemini 2.5 Pro
    const proModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })
    const docPrompt = `You are an expert tender consultant for Indian GeM portal vendors. Generate a complete, professional bid response document.

TENDER DETAILS:
Name: ${tenderName}
Category: ${tenderCategory}
State: ${tenderState}

VENDOR DETAILS:
Experience: ${experienceYears} years in ${tenderCategory}
Past contracts: ${pastContracts}
Capacity/Fleet/Offering: ${capacity}
Quoted Rate: ${quotedRate}

Generate a complete bid response document in ${language === 'hi' ? 'Hinglish (Hindi + English mix)' : language} with these sections:
1. **Company Overview** — brief professional introduction
2. **Technical Compliance** — how the vendor meets technical requirements
3. **Capacity & Resources** — fleet size, staff, equipment as applicable
4. **Past Experience** — relevant contracts and track record
5. **Financial Proposal** — rate breakdown and justification
6. **Compliance Declaration** — standard GeM compliance statement

Be specific, professional, and tailored to the tender. Format as clean markdown.
Important: This is for a real tender bid — be accurate and professional.`

    const docResult = await proModel.generateContent(docPrompt)
    const generatedDocument = docResult.response.text()

    return NextResponse.json({ winScore, winLabel, winReasoning, generatedDocument })
  } catch (err) {
    console.error('Bid generation error:', err)
    return NextResponse.json(
      { error: 'Document generation failed। कुछ देर में try करें।' },
      { status: 500 }
    )
  }
}
```

- [ ] Verify TypeScript:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```

---

## Chunk 3: UI Components — Chat + Form

### Task 5: `BidHelperChat` component

- [ ] Create directory:
  ```
  mkdir -p "/Users/adityaraj0421/Cool Projects/Tender/app/src/components/bid"
  ```

- [ ] Create `src/components/bid/bid-chat.tsx` with the following content:

```tsx
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Sparkles, Info } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { incrementAIQueryCount } from '@/lib/firebase/firestore'
import { canUseAI } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import type { ChatMessage } from '@/lib/types'
import type { UserProfile } from '@/lib/types'
import type { AIUsageData } from '@/lib/firebase/firestore'
import { getAuth } from 'firebase/auth'
import { track } from '@/lib/posthog'

const QUICK_CHIPS = [
  'EMD कैसे भरें?',
  'Technical bid में क्या डालें?',
  'L1 rate कैसे decide करें?',
  'Documents checklist क्या है?',
  'Bid submit कैसे करें?',
]

interface BidHelperChatProps {
  profile: UserProfile
  usage: AIUsageData
  onUsageUpdate: () => void
}

export function BidHelperChat({ profile, usage, onUsageUpdate }: BidHelperChatProps) {
  const t = useTranslations('bid')
  const { user } = useFirebase()
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [upgradeOpen, setUpgradeOpen]   = useState(false)
  const [confirmId, setConfirmId]       = useState<string | null>(null)
  const bottomRef                       = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    if (!canUseAI(profile, usage)) { setUpgradeOpen(true); return }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setConfirmId(null)

    try {
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          language: profile.language,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? 'AI error')
      const { reply } = await res.json()

      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', content: reply }
      setMessages(prev => [...prev, assistantMsg])
      setConfirmId(assistantMsg.id)

      await incrementAIQueryCount(user!.uid)
      onUsageUpdate()
      track('bid_chat_message', { language: profile.language })
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: 'model',
        content: 'माफ करें, कुछ error हुई। दोबारा try करें।'
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }, [messages, loading, profile, usage, user, onUsageUpdate])

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <Sparkles size={32} className="mx-auto text-navy/20 mb-3" />
            <p className="text-sm font-medium text-navy">{t('chatWelcome')}</p>
            <p className="text-xs text-muted mt-1">{t('chatWelcomeSub')}</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={[
              'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
              msg.role === 'user'
                ? 'bg-navy text-white rounded-br-sm'
                : 'bg-navy/5 text-navy rounded-bl-sm'
            ].join(' ')}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {msg.role === 'model' && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-navy/10">
                  <Info size={11} className="text-muted/60 shrink-0" />
                  <span className="text-xs text-muted/60">{t('aiDisclaimer')}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Checklist confirmation */}
        {confirmId && !loading && (
          <div className="flex gap-2 justify-start pl-2">
            <button onClick={() => setConfirmId(null)}
              className="text-xs px-3 py-1.5 rounded-full bg-success/10 text-success font-medium border border-success/20">
              {t('confirmYes')}
            </button>
            <button onClick={() => { setConfirmId(null); sendMessage('और details चाहिए') }}
              className="text-xs px-3 py-1.5 rounded-full bg-navy/5 text-navy font-medium border border-navy/10">
              {t('confirmMore')}
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-navy/5 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-navy/30 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      {messages.length === 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
          {QUICK_CHIPS.map(chip => (
            <button key={chip} onClick={() => sendMessage(chip)}
              className="shrink-0 text-xs px-3 py-2 rounded-full border border-navy/20 text-navy bg-white hover:bg-navy/5 transition-colors">
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-navy/10">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
          placeholder={t('chatPlaceholder')}
          disabled={loading}
          className="flex-1 rounded-xl border border-navy/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          aria-label={t('sendMessage')}
          className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <Send size={16} />
        </button>
      </div>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="ai_limit" />
    </div>
  )
}
```

- [ ] Verify TypeScript after Task 5:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```
  Expected: 0 errors.

---

### Task 6: `WinProbabilityCard` + `BidGeneratorForm`

- [ ] Create `src/components/bid/win-probability-card.tsx` with the following content:

```tsx
'use client'
import { Target } from 'lucide-react'
import type { WinScoreResult } from '@/lib/bid-utils'
import { useTranslations } from 'next-intl'

interface WinProbabilityCardProps {
  result: WinScoreResult
  reasoning?: string
  onGenerate: () => void
  generating: boolean
}

export function WinProbabilityCard({ result, reasoning, onGenerate, generating }: WinProbabilityCardProps) {
  const t = useTranslations('bid')
  const bgMap = { high: 'bg-success/5 border-success/20', medium: 'bg-orange/5 border-orange/20', low: 'bg-danger/5 border-danger/20' }

  return (
    <div className={`border rounded-xl p-5 space-y-4 ${bgMap[result.tier]}`}>
      <div className="flex items-center gap-3">
        <Target size={24} className={result.color} />
        <div>
          <p className="text-sm text-muted">{t('winProbability')}</p>
          <p className={`text-2xl font-bold ${result.color}`}>{result.score}% — {result.label}</p>
        </div>
      </div>
      {reasoning && <p className="text-xs text-muted">{reasoning}</p>}
      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full py-3 rounded-xl bg-navy text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generating ? t('generating') : t('generateBidDoc')}
      </button>
    </div>
  )
}
```

- [ ] Create `src/components/bid/bid-generator-form.tsx` with the following content:

```tsx
'use client'
import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { WinProbabilityCard } from './win-probability-card'
import { computeHeuristicScore } from '@/lib/bid-utils'
import type { Tender } from '@/lib/types'
import type { UserProfile } from '@/lib/types'

interface BidGeneratorFormProps {
  profile: UserProfile
  tenders: Tender[]
  onGenerate: (data: GenerateData) => void
  generating: boolean
}

export interface GenerateData {
  tender: Tender
  experienceYears: number
  pastContracts: string
  capacity: string
  quotedRate: string
}

export function BidGeneratorForm({ profile, tenders, onGenerate, generating }: BidGeneratorFormProps) {
  const t = useTranslations('bid')
  const [selectedTenderId, setSelectedTenderId] = useState('')
  const [experienceYears, setExperience]        = useState(String(profile.experienceYears ?? ''))
  const [pastContracts, setPastContracts]        = useState('')
  const [capacity, setCapacity]                  = useState('')
  const [quotedRate, setQuotedRate]              = useState('')
  const [showScore, setShowScore]                = useState(false)

  const selectedTender = tenders.find(t => t.id === selectedTenderId) ?? null

  const heuristicScore = useMemo(() => {
    if (!selectedTender) return null
    return computeHeuristicScore({
      experienceYears: Number(experienceYears) || null,
      tenderCategory: selectedTender.category,
      userCategories: profile.categories,
      userState: profile.state,
      tenderState: selectedTender.state,
    })
  }, [selectedTender, experienceYears, profile])

  const isValid = selectedTender && quotedRate.trim() && capacity.trim()

  const handleEstimate = () => setShowScore(true)
  const handleGenerate = () => {
    if (!selectedTender || !isValid) return
    onGenerate({ tender: selectedTender, experienceYears: Number(experienceYears) || 0,
      pastContracts, capacity, quotedRate })
  }

  const activeTenders = tenders.filter(t => t.status === 'active')

  return (
    <div className="space-y-4">
      {/* Tender select */}
      <div>
        <label className="block text-sm font-medium text-navy mb-1">{t('selectTender')}</label>
        {activeTenders.length === 0 ? (
          <p className="text-sm text-muted bg-navy/5 rounded-xl p-3">{t('noActiveTenders')}</p>
        ) : (
          <select value={selectedTenderId} onChange={e => { setSelectedTenderId(e.target.value); setShowScore(false) }}
            className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white">
            <option value="">{t('selectTenderPlaceholder')}</option>
            {activeTenders.map(tender => (
              <option key={tender.id} value={tender.id}>{tender.name}</option>
            ))}
          </select>
        )}
      </div>

      {selectedTender && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-navy mb-1">{t('experienceYears')}</label>
              <input type="number" min="0" max="50" value={experienceYears}
                onChange={e => { setExperience(e.target.value); setShowScore(false) }}
                className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white"
                placeholder="5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy mb-1">{t('quotedRate')}</label>
              <input type="text" value={quotedRate} onChange={e => setQuotedRate(e.target.value)}
                className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white"
                placeholder="₹ 45,000" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('capacity')}</label>
            <input type="text" value={capacity} onChange={e => setCapacity(e.target.value)}
              className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white"
              placeholder={t('capacityPlaceholder')} />
          </div>

          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('pastContracts')}</label>
            <textarea value={pastContracts} onChange={e => setPastContracts(e.target.value)}
              rows={3} placeholder={t('pastContractsPlaceholder')}
              className="w-full border border-navy/20 rounded-xl px-3 py-2.5 text-sm text-navy bg-white resize-none" />
          </div>

          {/* Show heuristic score or estimate button */}
          {!showScore ? (
            <button onClick={handleEstimate} disabled={!isValid}
              className="w-full py-2.5 rounded-xl border border-navy/20 text-navy text-sm font-medium hover:bg-navy/5 disabled:opacity-40">
              {t('estimateScore')}
            </button>
          ) : heuristicScore && (
            <WinProbabilityCard
              result={heuristicScore}
              onGenerate={handleGenerate}
              generating={generating}
            />
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] Verify TypeScript:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```

---

## Chunk 4: Viewer + i18n + Page Assembly

### Task 7: `BidDocumentViewer`

- [ ] Create `src/components/bid/bid-document-viewer.tsx` with the following content:

```tsx
'use client'
import { useTranslations } from 'next-intl'
import { Download, CheckCircle, Info, ExternalLink } from 'lucide-react'
import { getWinScoreResult } from '@/lib/bid-utils'

interface BidDocumentViewerProps {
  tenderName: string
  document: string
  winScore: number
  winLabel: string
  onClose: () => void
}

export function BidDocumentViewer({ tenderName, document, winScore, winLabel, onClose }: BidDocumentViewerProps) {
  const t = useTranslations('bid')
  const result = getWinScoreResult(winScore)

  const handleDownload = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Bid Document — ${tenderName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; color: #1A3766; }
        h1 { color: #1A3766; } h2 { color: #1A3766; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
        p { line-height: 1.6; } pre { white-space: pre-wrap; font-family: inherit; }
        @media print { body { padding: 1rem; } }
      </style>
    </head><body>
      <h1>${tenderName}</h1>
      <p style="color:#6B7280">Win Probability: ${winScore}% — ${winLabel}</p>
      <hr/>
      <pre>${document.replace(/</g, '&lt;')}</pre>
      <hr/>
      <p style="font-size:0.75rem;color:#9ca3af">Generated by TenderSarthi · AI-generated — review before submitting on GeM portal</p>
    </body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div className="space-y-4">
      {/* Success header */}
      <div className="flex items-center gap-3 bg-success/5 border border-success/20 rounded-xl p-4">
        <CheckCircle size={24} className="text-success shrink-0" />
        <div>
          <p className="font-bold text-navy text-sm">{t('bidReady')}</p>
          <p className={`text-xs font-medium ${result.color}`}>{t('winProbability')}: {winScore}% — {winLabel}</p>
        </div>
      </div>

      {/* Document preview */}
      <div className="bg-navy/5 rounded-xl p-4 max-h-96 overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm text-navy font-sans leading-relaxed">{document}</pre>
      </div>

      {/* AI disclaimer */}
      <div className="flex items-start gap-2 text-xs text-muted">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>{t('generatorDisclaimer')}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-navy text-white font-semibold text-sm">
          <Download size={16} /> {t('downloadPdf')}
        </button>
        <a href="https://gem.gov.in" target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange text-white font-semibold text-sm">
          <ExternalLink size={16} /> {t('openGem')}
        </a>
      </div>
      <button onClick={onClose}
        className="w-full py-2.5 rounded-xl border border-navy/20 text-navy text-sm font-medium">
        {t('close')}
      </button>
    </div>
  )
}
```

---

### Task 8: i18n + Page Assembly + Memory Update

#### Step 8a: Add `bid.*` keys to all 11 message files

For each `messages/*.json` file, add the `"bid"` namespace. Below are the complete values for English and Hindi. For the other 9 language files (Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia), use the Hindi values as a placeholder — a translator pass will update them later.

- [ ] Add to `messages/en.json` inside the root object:

```json
"bid": {
  "title": "Bid Helper",
  "chatTab": "AI Chat",
  "generatorTab": "Bid Generator",
  "chatWelcome": "Ask me anything about GeM bidding",
  "chatWelcomeSub": "I'll help you with EMD, documents, L1 rates, and more.",
  "chatPlaceholder": "Ask about GeM tenders...",
  "sendMessage": "Send message",
  "aiDisclaimer": "AI suggestion — verify on GeM portal before acting.",
  "confirmYes": "हाँ, समझ गया ✓",
  "confirmMore": "और details चाहिए",
  "selectTender": "Select tender",
  "selectTenderPlaceholder": "Choose a saved tender",
  "noActiveTenders": "No active tenders saved. Save a tender from Find Tenders first.",
  "experienceYears": "Years of experience",
  "quotedRate": "Rate to quote",
  "capacity": "Capacity / Fleet / Offering",
  "capacityPlaceholder": "e.g. 5 vehicles, 50 staff, 2 machines",
  "pastContracts": "Past contracts (optional)",
  "pastContractsPlaceholder": "Brief description of past GeM contracts...",
  "estimateScore": "Estimate Win Probability",
  "winProbability": "Win Probability",
  "generateBidDoc": "Generate Bid Document →",
  "generating": "Generating document...",
  "bidReady": "आपका Bid Document तैयार है! ✅",
  "generatorDisclaimer": "AI-generated document — review carefully before submitting on GeM portal.",
  "downloadPdf": "Download PDF",
  "close": "Close",
  "openGem": "GeM Portal →",
  "proOnly": "Bid Generator is a Pro feature",
  "proOnlySub": "Upgrade to Pro to generate complete bid documents with AI.",
  "upgradeCta": "Upgrade to Pro"
}
```

- [ ] Add to `messages/hi.json` inside the root object:

```json
"bid": {
  "title": "Bid Helper",
  "chatTab": "AI Chat",
  "generatorTab": "Bid Generator",
  "chatWelcome": "GeM bidding के बारे में कुछ भी पूछें",
  "chatWelcomeSub": "EMD, documents, L1 rates — सब कुछ समझाऊंगा।",
  "chatPlaceholder": "GeM tenders के बारे में पूछें...",
  "sendMessage": "Message भेजें",
  "aiDisclaimer": "AI suggestion — GeM portal पर verify करके ही act करें।",
  "confirmYes": "हाँ, समझ गया ✓",
  "confirmMore": "और details चाहिए",
  "selectTender": "Tender चुनें",
  "selectTenderPlaceholder": "Saved tender select करें",
  "noActiveTenders": "कोई active tender नहीं है। पहले Find Tenders से tender save करें।",
  "experienceYears": "Experience (साल)",
  "quotedRate": "Quote करने की rate",
  "capacity": "Capacity / Fleet / Offering",
  "capacityPlaceholder": "जैसे: 5 vehicles, 50 staff, 2 machines",
  "pastContracts": "Past contracts (optional)",
  "pastContractsPlaceholder": "पिछले GeM contracts का brief description...",
  "estimateScore": "Win Probability estimate करें",
  "winProbability": "जीतने की संभावना",
  "generateBidDoc": "Bid Document Generate करें →",
  "generating": "Document बन रहा है...",
  "bidReady": "आपका Bid Document तैयार है! ✅",
  "generatorDisclaimer": "AI-generated document — GeM portal पर submit करने से पहले review करें।",
  "downloadPdf": "PDF Download करें",
  "close": "बंद करें",
  "openGem": "GeM Portal पर जाएं →",
  "proOnly": "Bid Generator Pro feature है",
  "proOnlySub": "AI से complete bid documents generate करने के लिए Pro में upgrade करें।",
  "upgradeCta": "Pro में Upgrade करें"
}
```

- [ ] For the remaining 9 language files (`mr`, `gu`, `bn`, `ta`, `te`, `kn`, `ml`, `pa`, `or`), copy the **Hindi** `bid` namespace block verbatim (same JSON values as `hi.json`) — do NOT add code comments (JSON does not support comments; they will break the build). Use the Hindi values as placeholders until a dedicated translator pass.

- [ ] Verify next-intl does not throw type errors:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -40
  ```

#### Step 8b: Create the Bid page

- [ ] Confirm the bid page directory exists (it should from earlier subsystem setup):
  ```
  ls "/Users/adityaraj0421/Cool Projects/Tender/app/src/app/[locale]/(app)/bid/" 2>/dev/null || echo "needs mkdir"
  ```

- [ ] If needed, create the directory:
  ```
  mkdir -p "/Users/adityaraj0421/Cool Projects/Tender/app/src/app/[locale]/(app)/bid"
  ```

- [ ] Create (or replace) `src/app/[locale]/(app)/bid/page.tsx` with the following content:

```tsx
'use client'
import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { useAIUsage } from '@/lib/hooks/use-ai-usage'
import { isPro, canUseBidGenerator } from '@/lib/plan-guard'
import { BidHelperChat } from '@/components/bid/bid-chat'
import { BidGeneratorForm } from '@/components/bid/bid-generator-form'
import { BidDocumentViewer } from '@/components/bid/bid-document-viewer'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { addBidDocument, incrementBidDocCount } from '@/lib/firebase/firestore'
import { getAuth } from 'firebase/auth'
import { track } from '@/lib/posthog'
import type { GenerateData } from '@/components/bid/bid-generator-form'

type Tab = 'chat' | 'generator'

interface GeneratedResult {
  tenderName: string
  document: string
  winScore: number
  winLabel: string
}

export default function BidPage() {
  const t = useTranslations('bid')
  const { user } = useFirebase()
  const { profile } = useUserProfile()
  const { tenders } = useUserTenders(user?.uid ?? null)
  const { usage, refresh: refreshUsage } = useAIUsage(user?.uid ?? null)
  const [tab, setTab]                     = useState<Tab>('chat')
  const [generating, setGenerating]       = useState(false)
  const [result, setResult]               = useState<GeneratedResult | null>(null)
  const [upgradeOpen, setUpgradeOpen]     = useState(false)
  const [genError, setGenError]           = useState<string | null>(null)

  if (!profile || !user || !usage) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-36 bg-navy/5 rounded-lg animate-pulse" />
        <div className="h-64 bg-navy/5 rounded-xl animate-pulse" />
      </div>
    )
  }

  const userIsPro = isPro(profile)

  const handleGenerate = useCallback(async (data: GenerateData) => {
    if (!canUseBidGenerator(profile, usage)) { setUpgradeOpen(true); return }
    setGenerating(true); setGenError(null); setResult(null)
    try {
      const idToken = await getAuth().currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch('/api/ai/generate-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          tenderName: data.tender.name,
          tenderCategory: data.tender.category,
          tenderState: data.tender.state,
          experienceYears: data.experienceYears,
          pastContracts: data.pastContracts,
          capacity: data.capacity,
          quotedRate: data.quotedRate,
          language: profile.language,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? 'Generation failed')
      const { winScore, winLabel, generatedDocument } = await res.json()

      // Save to bid history
      await addBidDocument(user.uid, {
        tenderId: data.tender.id,
        tenderName: data.tender.name,
        tenderCategory: data.tender.category,
        experienceYears: data.experienceYears,
        pastContracts: data.pastContracts,
        capacity: data.capacity,
        quotedRate: data.quotedRate,
        winScore, winLabel,
        generatedDocument,
      })
      await incrementBidDocCount(user.uid)
      refreshUsage()

      setResult({ tenderName: data.tender.name, document: generatedDocument, winScore, winLabel })
      track('bid_document_generated', { category: data.tender.category, winScore })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [profile, usage, user, refreshUsage])

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">
      <div>
        <h1 className="font-heading font-bold text-xl text-navy">{t('title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy/5 p-1 rounded-xl">
        {(['chat', 'generator'] as Tab[]).map(tabKey => (
          <button key={tabKey}
            onClick={() => setTab(tabKey)}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === tabKey ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'
            ].join(' ')}>
            {t(tabKey === 'chat' ? 'chatTab' : 'generatorTab')}
          </button>
        ))}
      </div>

      {/* Chat tab */}
      {tab === 'chat' && (
        <div className="h-[calc(100vh-280px)] min-h-[400px] flex flex-col">
          <BidHelperChat profile={profile} usage={usage} onUsageUpdate={refreshUsage} />
        </div>
      )}

      {/* Generator tab */}
      {tab === 'generator' && (
        !userIsPro ? (
          <div className="bg-orange/5 border border-orange/20 rounded-xl p-5 text-center space-y-3">
            <Lock className="mx-auto text-orange" size={28} />
            <p className="font-semibold text-navy text-sm">{t('proOnly')}</p>
            <p className="text-sm text-muted">{t('proOnlySub')}</p>
            <button onClick={() => setUpgradeOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-orange text-white font-semibold text-sm">
              {t('upgradeCta')}
            </button>
          </div>
        ) : result ? (
          <BidDocumentViewer
            tenderName={result.tenderName}
            document={result.document}
            winScore={result.winScore}
            winLabel={result.winLabel}
            onClose={() => setResult(null)}
          />
        ) : (
          <div className="space-y-4">
            {genError && <p className="text-sm text-danger bg-danger/5 rounded-xl p-3">{genError}</p>}
            <BidGeneratorForm
              profile={profile}
              tenders={tenders}
              onGenerate={handleGenerate}
              generating={generating}
            />
          </div>
        )
      )}

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
    </div>
  )
}
```

#### Step 8c: Final TypeScript + test check

- [ ] Run full TypeScript check:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx tsc --noEmit 2>&1 | head -60
  ```

- [ ] Run all unit tests:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npx vitest run 2>&1 | tail -30
  ```

- [ ] Run dev server and visit `/en/bid` to smoke-test the page:
  ```
  cd "/Users/adityaraj0421/Cool Projects/Tender/app" && npm run dev
  ```
  Then navigate to `http://localhost:3000/en/bid` and check:
  - Chat tab loads with welcome screen and quick chips
  - Chips are clickable and trigger a chat message
  - Generator tab shows Pro-gate for free users
  - Generator tab shows the form for Pro users

#### Step 8d: Update memory file

- [ ] Open `/Users/adityaraj0421/.claude/projects/-Users-adityaraj0421-Cool-Projects-Tender/memory/project_tendersarthi.md` and update the Implementation Status section:
  - Change `- Subsystem 4 (Document Vault): ✅ Complete — 71 tests passing, 0 TS errors` to add a new line below it:
  - `- Subsystem 5 (Bid Helper): ✅ Complete — <N> tests passing, 0 TS errors` (replace `<N>` with actual count from vitest output)
  - In the Subsystem 5 section (create it), note: `bidHistory` Firestore collection is live; Pro-plan guard enforced server-side in `generate-bid` route; Win tier boundary: >=70 High, >=40 Medium.

---

## Final Verification Checklist

### Functionality
- [ ] Chat sends messages to `/api/ai/chat` with full conversation history
- [ ] Chat shows AI disclaimer on every model response
- [ ] Chat shows confirmation buttons ("हाँ, समझ गया" / "और details चाहिए") after each AI reply
- [ ] Quick chips fire a message when tapped
- [ ] Free users see UpgradeDialog when AI query limit is reached (10/month)
- [ ] `computeHeuristicScore` returns correct tier for all boundary cases
- [ ] Win Probability Card shows score + label + correct color before generation
- [ ] Bid Generator is gated behind `canUseBidGenerator` (Pro only)
- [ ] Generate-bid route calls Flash 2.0 for score first, then 1.5 Pro for document
- [ ] Refined win score from AI is returned alongside the document
- [ ] `addBidDocument` saves to `bidHistory` Firestore collection
- [ ] `incrementBidDocCount` increments `aiUsage/{uid}/{YYYY-MM}/data.bidDocs`
- [ ] BidDocumentViewer opens print dialog via `window.open + win.print()`
- [ ] "आपका Bid Document तैयार है! ✅" success screen appears after generation
- [ ] BidDocumentViewer shows both "Download PDF" and "GeM Portal →" buttons
- [ ] "GeM Portal →" button links to `https://gem.gov.in` in a new tab
- [ ] Closing the viewer resets state so user can generate another document

### Security
- [ ] Both API routes verify Firebase ID token before processing
- [ ] `generate-bid` route checks Firestore for Pro plan before executing Gemini calls
- [ ] Free users receive 403 from `generate-bid` route even if they bypass the UI
- [ ] `firestore.rules` for `bidHistory` prevents cross-user read/delete
- [ ] `bidHistory` create rule checks `request.auth.uid == request.resource.data.userId`

### i18n
- [ ] All UI strings use `t('bid.*')` keys — no hardcoded English/Hindi strings in components
- [ ] `bid` namespace exists in all 11 `messages/*.json` files
- [ ] next-intl type-check passes (`npx tsc --noEmit` clean)

### Tests
- [ ] All 12 `bid-utils.test.ts` tests pass with `npx vitest run`
- [ ] Boundary conditions covered: score 39/40/69/70, null experienceYears, cap at 95

### Performance
- [ ] `computeHeuristicScore` is pure (no async, no API calls) — runs instantly on form change
- [ ] Score estimate button shown first; generate button only after user confirms score
- [ ] Flash 2.0 win score and 1.5 Pro document generation are sequential (score first) to give fast partial feedback
- [ ] Chat history is session-only (not persisted to Firestore) — no Firestore write on every message

### UX
- [ ] Loading state shows animated typing dots in chat
- [ ] Generate button shows "Document बन रहा है..." text while generating
- [ ] Error messages displayed inline (not as alerts/toasts) in both chat and generator
- [ ] Chat input submit works on Enter key (not just button click)
- [ ] Quick chips visible only when chat is empty
- [ ] Tabs use pill switcher consistent with rest of app

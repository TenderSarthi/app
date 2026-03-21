import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'  // ensure admin app is initialized

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
  let uid = ''
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7))
      uid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Server-side usage check
    const db = getFirestore()
    const userDoc = await db.doc(`users/${uid}`).get()
    const userData = userDoc.data()
    const userPlan = userData?.plan ?? 'free'

    const now = new Date()

    // Treat trial-expired users as free even if plan field still says 'pro'
    const isTrialExpired =
      userPlan === 'pro' &&
      !userData?.razorpaySubscriptionId &&
      userData?.trialEndsAt &&
      userData.trialEndsAt.toDate() <= now

    // Treat users whose subscription grace period has ended as free
    const scheduledDowngradeAt = userData?.scheduledDowngradeAt
    const isGracePeriodEnded = scheduledDowngradeAt && scheduledDowngradeAt.toDate() <= now

    if (userPlan !== 'pro' || isTrialExpired || isGracePeriodEnded) {
      // Free user: check monthly query count
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const usageDoc = await db.doc(`aiUsage/${uid}/${monthKey}/data`).get()
      const queryCount = usageDoc.data()?.queries ?? 0
      const FREE_AI_QUERY_LIMIT = 10

      if (queryCount >= FREE_AI_QUERY_LIMIT) {
        return NextResponse.json({ error: 'Monthly AI query limit reached. Upgrade to Pro.' }, { status: 429 })
      }

      // Increment counter server-side
      await db.doc(`aiUsage/${uid}/${monthKey}/data`).set(
        { queries: (queryCount + 1), updatedAt: Timestamp.now() },
        { merge: true }
      )
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `${SYSTEM_PROMPT}

Respond in language: ${language}

TENDER TEXT:
${text}`

    const AI_TIMEOUT_MS = 30_000
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI request timed out')), AI_TIMEOUT_MS)
      ),
    ])
    const summary = result.response.text()

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('AI summarize error', { uid, err })
    return NextResponse.json(
      { error: 'AI अभी unavailable है। कुछ देर में try करें।' },
      { status: 500 }
    )
  }
}

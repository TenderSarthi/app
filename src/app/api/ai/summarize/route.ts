import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuth } from 'firebase-admin/auth'
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
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.slice(7)
    try {
      await getAuth().verifyIdToken(idToken)
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
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

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('AI summarize error:', err)
    return NextResponse.json(
      { error: 'AI अभी unavailable है। कुछ देर में try करें।' },
      { status: 500 }
    )
  }
}

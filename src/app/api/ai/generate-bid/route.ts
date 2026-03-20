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
    const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
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

    const winLabel = winScore >= 70 ? 'High' : winScore >= 40 ? 'Medium' : 'Low'

    // Step 2: Full Bid Document via Gemini 1.5 Pro
    const proModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
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

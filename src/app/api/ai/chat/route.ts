import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
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
    let uid: string
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

    if (userPlan !== 'pro') {
      // Free user: check monthly query count
      const now = new Date()
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

    const { messages, language = 'hi' } = await req.json() as {
      messages: { role: 'user' | 'model'; content: string }[]
      language?: string
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    // Input length validation to prevent token exhaustion
    if (messages.length > 50) {
      return NextResponse.json({ error: 'Too many messages. Maximum 50 allowed.' }, { status: 400 })
    }
    for (const msg of messages) {
      if (msg.content && msg.content.length > 4000) {
        return NextResponse.json({ error: 'Message content too long. Maximum 4000 characters per message.' }, { status: 400 })
      }
    }

    const userMessage = messages[messages.length - 1]
    if (userMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
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

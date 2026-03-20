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

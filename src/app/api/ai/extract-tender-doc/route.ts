import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')

// Allowed MIME types for document extraction
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number]

function isAllowedMime(m: unknown): m is AllowedMime {
  return ALLOWED_MIME_TYPES.includes(m as AllowedMime)
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      await getAuth().verifyIdToken(authHeader.slice(7))
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // ── Validate payload ─────────────────────────────────────────────────
    const { base64, mimeType } = await req.json() as { base64?: string; mimeType?: string }

    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json({ error: 'base64 field required' }, { status: 400 })
    }
    if (!isAllowedMime(mimeType)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, JPG, or PNG.' }, { status: 400 })
    }
    // Sanity-check size: base64 inflates by ~33%, so 10MB file → ~13.3MB string
    if (base64.length > 14 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
    }

    // ── Gemini Vision extraction ─────────────────────────────────────────
    // Gemini 2.5 Flash handles PDFs natively (including scanned/image-based ones)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `You are extracting key information from a government tender document for a vendor who wants to bid on it.

Extract and summarise the most important details in clear, concise prose:
- Tender name and scope of work
- Eligibility criteria (turnover, experience, certifications required)
- Technical specifications and deliverables
- Quantity / duration / service area
- Any important compliance requirements

Do NOT include page numbers, headers, footers, or boilerplate legal text.
Output in plain text, no markdown formatting. Keep it under 1500 words.
If the document is not a tender, extract whatever useful business information is present.`

    const AI_TIMEOUT_MS = 45_000
    const result = await Promise.race([
      model.generateContent([
        { inlineData: { mimeType, data: base64 } },
        prompt,
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Extraction timed out')), AI_TIMEOUT_MS)
      ),
    ])

    const text = result.response.text().trim()
    return NextResponse.json({ text })

  } catch (err) {
    console.error('[extract-tender-doc] error:', err)
    return NextResponse.json(
      { error: 'Could not extract text from document.' },
      { status: 500 }
    )
  }
}

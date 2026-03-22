import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'
import { CATEGORY_KEYWORDS, INDIAN_STATES } from '@/lib/constants'

const CPPP_BASE = 'https://eprocure.gov.in/cppp/latestactivetendersnew'
const FETCH_PAGES = 3   // ~30 tenders per fetch

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── CPPP HTML parser ──────────────────────────────────────────────────────────

interface RawTender {
  title:       string
  link:        string
  org:         string
  pubDate:     Date
  closingDate: string
}

function parseCPPPPage(html: string): RawTender[] {
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []

  return rows.slice(1).flatMap(row => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[0])
    if (cells.length < 6) return []

    const text  = (cell: string) => cell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const href  = (cell: string) => { const m = cell.match(/href="([^"]+)"/); return m?.[1] ?? '' }

    const titleCell  = cells[4]
    const rawText    = text(titleCell)
    // Title is everything before the first "/" (ref number follows)
    const title      = rawText.split('/')[0].trim()
    const link       = href(titleCell)
    const org        = text(cells[5])
    const pubDateStr = text(cells[1])   // e.g. "22-Mar-2026 12:10 PM"

    if (!title || !link) return []

    const pubDate = new Date(pubDateStr.replace(/(\d{2})-([A-Za-z]{3})-(\d{4})/, '$2 $1 $3'))

    return [{ title, link, org, pubDate: isNaN(pubDate.getTime()) ? new Date() : pubDate, closingDate: text(cells[2]) }]
  })
}

// ── Category + state extraction (mirrors alert-utils logic) ──────────────────

function extractCategories(text: string): string[] {
  const lower = text.toLowerCase()
  const cats = Object.entries(CATEGORY_KEYWORDS)
    .filter(([, kws]) => kws.some(k => lower.includes(k)))
    .map(([cat]) => cat)
  return cats.length > 0 ? cats : ['Other']
}

function extractStates(text: string): string[] {
  const lower = text.toLowerCase()
  return INDIAN_STATES.filter(s => lower.includes(s.toLowerCase()))
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await getAuth().verifyIdToken(authHeader.slice(7))
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Filters from query string
  const { searchParams } = new URL(req.url)
  const state      = searchParams.get('state') ?? ''
  const categories = searchParams.get('categories')?.split(',').filter(Boolean) ?? []

  // Fetch CPPP pages concurrently
  const pages = await Promise.allSettled(
    Array.from({ length: FETCH_PAGES }, (_, i) =>
      fetch(`${CPPP_BASE}?cpage=${i + 1}`, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(12_000),
      }).then(r => r.text())
    )
  )

  const raw: RawTender[] = pages
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .flatMap(r => parseCPPPPage(r.value))

  // Deduplicate by link
  const seen = new Set<string>()
  const unique = raw.filter(t => {
    if (seen.has(t.link)) return false
    seen.add(t.link)
    return true
  })

  // Enrich with categories + states
  const enriched = unique.map(t => {
    const combined = `${t.title} ${t.org}`
    return {
      ...t,
      categories: extractCategories(combined),
      states:     extractStates(combined),
    }
  })

  // Filter — category uses keyword matching; state matching is best-effort
  const filtered = enriched.filter(t => {
    const categoryMatch = categories.length === 0 || categories.some(c => t.categories.includes(c))
    const stateMatch    = !state || state === 'all' || t.states.includes(state) || t.states.length === 0
    return categoryMatch && stateMatch
  })

  const tenders = filtered
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 25)
    .map(t => ({
      title:       t.title,
      link:        t.link,
      org:         t.org,
      pubDate:     t.pubDate.toISOString(),
      closingDate: t.closingDate,
      categories:  t.categories,
      states:      t.states,
    }))

  return NextResponse.json(
    { tenders },
    { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
  )
}

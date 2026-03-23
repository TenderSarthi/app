import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'
import { INDIAN_STATES } from '@/lib/constants'

// GeM-only endpoint on CPPP — ~3,000 pages of live GeM bids
// Column layout differs from regular CPPP latestactivetendersnew
const GEM_CPPP_BASE = 'https://eprocure.gov.in/cppp/gemtender'
const FETCH_PAGES   = 5   // 50 GeM bids per fetch (10 rows/page × 5 pages)

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── GeM HTML parser ───────────────────────────────────────────────────────────
// GeM CPPP column layout:
//   [0] Sl.No
//   [1] Bid Start Date   ← pubDate
//   [2] Bid End Date     ← closingDate
//   [3] Bid Number       ← <a>GEM/2026/B/NNNNNNN</a>/Qty
//   [4] Product Category ← structured category string
//   [5] Organisation
//   [6] Department

interface RawTender {
  bidNumber:    string   // e.g. "GEM/2026/B/7195650" — the stable, human-readable GeM bid ID
  org:          string   // Organisation Name (e.g. "Indian Army")
  dept:         string   // Department Name (e.g. "Department of Military Affairs")
  category:     string   // Product/Service Category (structured, not inferred)
  bidStartDate: Date
  bidEndDate:   string   // raw string for display
}

function parseGeMPage(html: string): RawTender[] {
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []

  return rows.slice(1).flatMap(row => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[0])
    if (cells.length < 7) return []

    const text = (cell: string) => cell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const anchorText = (cell: string) => {
      const m = cell.match(/<a[^>]*>([\s\S]*?)<\/a>/)
      return m?.[1]?.replace(/<[^>]+>/g, '').trim() ?? ''
    }

    const bidNumber   = anchorText(cells[3])
    const category    = text(cells[4])
    const org         = text(cells[5])
    const dept        = text(cells[6])
    const bidStartStr = text(cells[1])
    const bidEndDate  = text(cells[2])

    // Only accept real GeM bid numbers — filter out header/footer rows
    if (!bidNumber.startsWith('GEM/')) return []

    // CPPP date format: "22-Mar-2026 12:10 PM" → parse as "Mar 22 2026"
    const bidStartDate = new Date(
      bidStartStr.replace(/(\d{2})-([A-Za-z]{3})-(\d{4})/, '$2 $1 $3')
    )

    return [{
      bidNumber,
      org,
      dept,
      category,
      bidStartDate: isNaN(bidStartDate.getTime()) ? new Date() : bidStartDate,
      bidEndDate,
    }]
  })
}

// ── State extraction (best-effort from org + dept text) ───────────────────────

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

  // Fetch GeM CPPP pages concurrently
  // GeM endpoint uses ?page=N (not ?cpage=N like regular CPPP)
  const pages = await Promise.allSettled(
    Array.from({ length: FETCH_PAGES }, (_, i) =>
      fetch(`${GEM_CPPP_BASE}?page=${i + 1}`, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(12_000),
      }).then(r => r.text())
    )
  )

  const raw: RawTender[] = pages
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .flatMap(r => parseGeMPage(r.value))

  // Deduplicate by bid number
  const seen = new Set<string>()
  const unique = raw.filter(t => {
    if (seen.has(t.bidNumber)) return false
    seen.add(t.bidNumber)
    return true
  })

  // Enrich with states (extracted from org + dept names)
  const enriched = unique.map(t => ({
    ...t,
    states: extractStates(`${t.org} ${t.dept}`),
  }))

  // Filter — category: partial case-insensitive match against GeM's structured category string
  const filtered = enriched.filter(t => {
    const categoryMatch =
      categories.length === 0 ||
      categories.some(c => t.category.toLowerCase().includes(c.toLowerCase()))
    // Pass central/national tenders (no state detected) so they're never hidden
    const stateMatch =
      !state || state === 'all' || t.states.includes(state) || t.states.length === 0
    return categoryMatch && stateMatch
  })

  const tenders = filtered
    .sort((a, b) => b.bidStartDate.getTime() - a.bidStartDate.getTime())
    .slice(0, 60)
    .map(t => ({
      title:       t.category || t.bidNumber,   // GeM category IS the tender title
      // gemtendersfullview URLs are session-bound just like regular CPPP.
      // Link to the CPPP GeM list page instead; bid number lets user find the exact bid.
      link:        'https://eprocure.gov.in/cppp/gemtender',
      refId:       t.bidNumber,                  // "GEM/2026/B/7195650" — searchable on GeM & CPPP
      org:         t.org,
      dept:        t.dept,
      pubDate:     t.bidStartDate.toISOString(),
      closingDate: t.bidEndDate,
      categories:  [t.category].filter(Boolean),
      states:      t.states,
    }))

  return NextResponse.json(
    { tenders },
    { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
  )
}

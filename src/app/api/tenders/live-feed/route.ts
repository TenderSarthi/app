import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'
import Parser from 'rss-parser'
import { parseRSSItem } from '@/lib/alert-utils'

const RSS_URLS = (
  process.env.ALERT_RSS_URLS ?? 'https://eprocure.gov.in/eprocure/app/rssxml'
).split(',').map(u => u.trim()).filter(Boolean)

export async function GET(req: NextRequest) {
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

  // ── Query params ─────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url)
  const state      = searchParams.get('state') ?? ''
  const categories = searchParams.get('categories')?.split(',').filter(Boolean) ?? []

  // ── Fetch RSS ─────────────────────────────────────────────────────────
  const parser = new Parser({ timeout: 10_000 })

  const results = await Promise.allSettled(
    RSS_URLS.map(url => parser.parseURL(url))
  )

  const allItems = results
    .filter((r): r is PromiseFulfilledResult<Parser.Output<Record<string, string>>> => r.status === 'fulfilled')
    .flatMap(r => r.value.items ?? [])

  // Deduplicate by link
  const seen = new Set<string>()
  const unique = allItems.filter(item => {
    if (!item.link || seen.has(item.link)) return false
    seen.add(item.link)
    return true
  })

  // ── Parse + filter ────────────────────────────────────────────────────
  const parsed = unique.map(parseRSSItem)

  const filtered = parsed.filter(t => {
    const stateMatch      = !state || state === 'all' || t.states.includes(state)
    const categoryMatch   = categories.length === 0 || categories.some(c => t.categories.includes(c))
    return stateMatch && categoryMatch
  })

  // ── Sort + shape ──────────────────────────────────────────────────────
  const tenders = filtered
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 25)
    .map(t => ({
      title:       t.title,
      link:        t.link,
      description: t.description,
      pubDate:     t.pubDate.toISOString(),
      categories:  t.categories,
      states:      t.states,
    }))

  return NextResponse.json(
    { tenders },
    { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
  )
}

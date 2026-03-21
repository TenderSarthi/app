import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { listAdminArticles, createAdminArticle, type ArticleInput } from '@/lib/firebase/admin-queries'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const articles = await listAdminArticles()
  return Response.json({ articles })
}

const VALID_CATEGORIES: string[] = ['getting_started', 'bidding_strategy', 'finance_compliance', 'post_win']

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const body = await req.json() as ArticleInput

  // Trim string enum fields before validation
  if (body.id)       body.id       = body.id.trim()
  if (body.category) body.category = body.category.trim()

  if (!body.id || !body.titleEn) {
    return Response.json({ error: 'id and titleEn are required' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(body.id)) {
    return Response.json({ error: 'id must be alphanumeric with hyphens/underscores only' }, { status: 400 })
  }
  if (body.titleEn.length > 200 || (body.titleHi && body.titleHi.length > 200)) {
    return Response.json({ error: 'title must be ≤ 200 characters' }, { status: 400 })
  }
  if (body.bodyEn && body.bodyEn.length > 50_000) {
    return Response.json({ error: 'bodyEn must be ≤ 50,000 characters' }, { status: 400 })
  }
  if (body.bodyHi && body.bodyHi.length > 50_000) {
    return Response.json({ error: 'bodyHi must be ≤ 50,000 characters' }, { status: 400 })
  }
  // Paragraph count limit: max 100 paragraphs per body (each paragraph is a line)
  const enParaCount = body.bodyEn ? body.bodyEn.split('\n').filter(Boolean).length : 0
  const hiParaCount = body.bodyHi ? body.bodyHi.split('\n').filter(Boolean).length : 0
  if (enParaCount > 100 || hiParaCount > 100) {
    return Response.json({ error: 'article body must have ≤ 100 paragraphs' }, { status: 400 })
  }
  if (body.readMinutes !== undefined && (body.readMinutes < 1 || body.readMinutes > 120)) {
    return Response.json({ error: 'readMinutes must be between 1 and 120' }, { status: 400 })
  }
  if (body.category && !VALID_CATEGORIES.includes(body.category)) {
    return Response.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
  }

  await createAdminArticle(body)
  return Response.json({ ok: true })
}

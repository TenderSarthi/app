import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { listAdminArticles, createAdminArticle, type ArticleInput } from '@/lib/firebase/admin-queries'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const articles = await listAdminArticles()
  return Response.json({ articles })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const body = await req.json() as ArticleInput
  if (!body.id || !body.titleEn) {
    return Response.json({ error: 'id and titleEn are required' }, { status: 400 })
  }
  await createAdminArticle(body)
  return Response.json({ ok: true })
}

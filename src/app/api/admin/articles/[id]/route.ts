import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { updateAdminArticle, deleteAdminArticle } from '@/lib/firebase/admin-queries'
import type { ArticleInput } from '@/lib/firebase/admin-queries'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const { id } = await params
  const body    = await req.json() as Partial<Omit<ArticleInput, 'id'>>
  await updateAdminArticle(id, body)
  return Response.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const { id } = await params
  await deleteAdminArticle(id)
  return Response.json({ ok: true })
}

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

  const { id: rawId } = await params
  const id = rawId.trim()
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return Response.json({ error: 'Invalid article id' }, { status: 400 })
  }
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

  const { id: rawId } = await params
  const id = rawId.trim()
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return Response.json({ error: 'Invalid article id' }, { status: 400 })
  }
  await deleteAdminArticle(id)
  return Response.json({ ok: true })
}

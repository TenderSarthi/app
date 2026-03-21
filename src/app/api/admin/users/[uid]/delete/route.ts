import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { deleteUserData } from '@/lib/firebase/admin-queries'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const { uid } = await params
  await deleteUserData(uid)
  return Response.json({ ok: true })
}

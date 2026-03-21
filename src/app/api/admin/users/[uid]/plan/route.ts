import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { setUserPlan } from '@/lib/firebase/admin-queries'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const { uid } = await params
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    return Response.json({ error: 'Invalid uid' }, { status: 400 })
  }
  const body = await req.json() as { plan?: string }
  if (body.plan !== 'free' && body.plan !== 'pro') {
    return Response.json({ error: 'Invalid plan' }, { status: 400 })
  }
  await setUserPlan(uid.trim(), body.plan)
  return Response.json({ ok: true })
}

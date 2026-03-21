import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { listUsers } from '@/lib/firebase/admin-queries'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const users = await listUsers()
  return Response.json({ users })
}

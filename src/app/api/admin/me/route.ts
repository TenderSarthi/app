import { NextRequest } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  return Response.json({ isAdmin: !!admin })
}

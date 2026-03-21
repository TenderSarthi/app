import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return Response.json({ error: 'CRON_SECRET not set' }, { status: 500 })

  const vercelUrl = process.env.VERCEL_URL
  const baseUrl = vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/alerts/trigger`, {
    method:  'GET',
    headers: { Authorization: `Bearer ${cronSecret}` },
  })

  return Response.json({ ok: res.ok, status: res.status })
}

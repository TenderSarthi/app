import { NextRequest } from 'next/server'
import { verifyAdminToken, unauthorized } from '@/lib/admin-auth'
import { getAdminStats } from '@/lib/firebase/admin-queries'
import { calcMRR, formatPercent, formatCurrency } from '@/lib/admin-utils'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req)
  if (!admin) return unauthorized()

  const stats = await getAdminStats()
  return Response.json({
    ...stats,
    mrr:            calcMRR(stats.proUsers),
    mrrFormatted:   formatCurrency(calcMRR(stats.proUsers)),
    conversionRate: formatPercent(stats.proUsers, stats.totalUsers),
  })
}

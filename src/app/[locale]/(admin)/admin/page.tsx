'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Users, TrendingUp, UserCheck, Calendar, Trash2 } from 'lucide-react'

interface Stats {
  totalUsers:      number
  proUsers:        number
  freeUsers:       number
  signupsToday:    number
  signupsWeek:     number
  signupsMonth:    number
  deletionRequests: number
  mrrFormatted:    string
  conversionRate:  string
}

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string
}) {
  return (
    <div className="bg-white border rounded-xl p-5 space-y-2">
      <div className="flex items-center gap-2 text-muted text-sm">
        <Icon size={16} />
        {label}
      </div>
      <p className="font-heading font-bold text-2xl text-navy">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}

export default function AdminOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    user.getIdToken().then((token) =>
      fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
    ).then((r) => {
      if (!r.ok) throw new Error('Failed to load stats')
      return r.json() as Promise<Stats>
    }).then(setStats).catch((e: Error) => setError(e.message))
  }, [user])

  if (error) return <p className="text-red-600 text-sm">{error}</p>
  if (!stats) return <p className="text-muted text-sm">Loading…</p>

  return (
    <div className="space-y-6">
      <h1 className="font-heading font-bold text-2xl text-navy">Overview</h1>

      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4">
        <StatCard label="Total Users"      value={stats.totalUsers}    icon={Users}      />
        <StatCard label="Pro Users"        value={stats.proUsers}      icon={UserCheck}  sub={`${stats.conversionRate} conversion`} />
        <StatCard label="Free Users"       value={stats.freeUsers}     icon={Users}      />
        <StatCard label="Est. MRR"         value={stats.mrrFormatted}  icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4">
        <StatCard label="Signups Today"     value={stats.signupsToday}    icon={Calendar} />
        <StatCard label="Signups This Week" value={stats.signupsWeek}     icon={Calendar} />
        <StatCard label="Signups 30 days"   value={stats.signupsMonth}    icon={Calendar} />
        <StatCard label="Deletion Pending"  value={stats.deletionRequests} icon={Trash2}  />
      </div>
    </div>
  )
}

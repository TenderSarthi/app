'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, Play, Rss } from 'lucide-react'

const FEEDS = [
  { name: 'NIC CPP RSS',          url: 'https://eprocure.gov.in/eprocure/app', status: 'active' },
  { name: 'GeM Scraper',          url: 'gem.gov.in',                           status: 'disabled' },
  { name: 'User-submitted queue', url: 'Firestore communityTenders',           status: 'active' },
]

export default function AdminAlertsPage() {
  const { user } = useAuth()
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)

  const handleTrigger = async () => {
    if (!user) return
    setTriggering(true)
    setTriggerMsg(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/trigger-alerts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setTriggerMsg(res.ok ? 'Alerts triggered successfully.' : 'Trigger failed — check Vercel logs.')
    } catch {
      setTriggerMsg('Network error.')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading font-bold text-2xl text-navy">Alert System Health</h1>

      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-navy flex items-center gap-2">
          <Clock size={16} className="text-orange" />
          Cron Schedule
        </h2>
        <div className="flex items-center gap-3">
          <code className="text-sm bg-lightbg px-3 py-1.5 rounded font-mono">0 */6 * * *</code>
          <span className="text-sm text-muted">Every 6 hours (Vercel Pro required)</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Button
            size="sm"
            className="bg-orange text-white hover:bg-orange/90"
            disabled={triggering}
            onClick={handleTrigger}
          >
            <Play size={14} className="mr-1.5" />
            {triggering ? 'Triggering…' : 'Trigger Now'}
          </Button>
          {triggerMsg && (
            <p className="text-sm text-muted">{triggerMsg}</p>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-navy flex items-center gap-2">
          <Rss size={16} className="text-orange" />
          Feed Sources
        </h2>
        <div className="space-y-3">
          {FEEDS.map((feed) => (
            <div key={feed.name} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-navy">{feed.name}</p>
                <p className="text-xs text-muted font-mono">{feed.url}</p>
              </div>
              <Badge className={
                feed.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }>
                {feed.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-lightbg border rounded-xl p-4 flex items-start gap-2">
        <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm text-muted">
          Detailed logs are available in the Vercel dashboard under Functions → /api/alerts/trigger.
          Health data will appear here once the systemHealth Firestore integration is added.
        </p>
      </div>
    </div>
  )
}

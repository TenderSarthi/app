'use client'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props { onAllow: () => void; onSkip: () => void; loading: boolean }

export function Step4Notifications({ onAllow, onSkip, loading }: Props) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-orange/10 flex items-center justify-center">
          <Bell className="text-orange" size={36} />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-gray-700 text-sm leading-relaxed">जब आपकी category में नया tender आए, हम आपको <strong>तुरंत notify</strong> करेंगे।</p>
        <p className="text-muted text-xs">आप कभी भी Settings में से notifications बंद कर सकते हैं।</p>
      </div>
      <div className="space-y-3">
        <Button onClick={onAllow} disabled={loading} className="w-full h-11 bg-orange hover:bg-orange/90 text-white">🔔 Notifications चालू करें</Button>
        <button type="button" onClick={onSkip} className="w-full text-sm text-muted underline py-2">अभी नहीं</button>
      </div>
    </div>
  )
}

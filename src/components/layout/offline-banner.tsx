'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function OfflineBanner() {
  const t = useTranslations('offline')
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)

    const goOnline  = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-800"
    >
      <WifiOff size={14} className="shrink-0" />
      {t('message')}
    </div>
  )
}

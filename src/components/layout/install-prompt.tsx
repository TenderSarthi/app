'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const t = useTranslations('install')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  if (!deferredPrompt || dismissed) return null

  return (
    <div className="fixed bottom-20 desktop:bottom-4 left-4 right-4 desktop:left-auto desktop:right-4 desktop:max-w-xs z-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 flex items-center gap-3">
        <Download size={20} className="text-orange shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy">{t('title')}</p>
        </div>
        <Button size="sm" className="bg-orange text-white hover:bg-orange/90" onClick={handleInstall}>
          {t('cta')}
        </Button>
        <button
          aria-label="Dismiss"
          className="text-muted hover:text-navy"
          onClick={() => setDismissed(true)}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { subscribeAlertConfig, saveAlertConfig } from '@/lib/firebase/firestore'
import type { AlertConfig } from '@/lib/types'

interface UseAlertConfigResult {
  config: AlertConfig | null
  loading: boolean
  saving: boolean
  save: (config: Omit<AlertConfig, 'userId' | 'createdAt'>) => Promise<void>
}

export function useAlertConfig(uid: string | null): UseAlertConfigResult {
  const [config, setConfig]   = useState<AlertConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const unsub = subscribeAlertConfig(uid, c => { setConfig(c); setLoading(false) }, () => setLoading(false))
    return unsub
  }, [uid])

  const save = async (data: Omit<AlertConfig, 'userId' | 'createdAt'>) => {
    if (!uid) return
    setSaving(true)
    try {
      await saveAlertConfig(uid, data)
    } finally {
      setSaving(false)
    }
  }

  return { config, loading, saving, save }
}

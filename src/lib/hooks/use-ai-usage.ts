'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAIUsage } from '@/lib/firebase/firestore'
import type { AIUsageData } from '@/lib/firebase/firestore'

export interface UseAIUsageResult {
  usage: AIUsageData
  loading: boolean
  refresh: () => void
}

export function useAIUsage(uid: string | null): UseAIUsageResult {
  const [usage, setUsage] = useState<AIUsageData>({ queries: 0, bidDocs: 0 })
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(() => {
    if (!uid) {
      setTimeout(() => {
        setUsage({ queries: 0, bidDocs: 0 })
        setLoading(false)
      }, 0)
      return
    }
    setLoading(true)
    getAIUsage(uid)
      .then(data => setUsage(data))
      .catch(() => setUsage({ queries: 0, bidDocs: 0 }))
      .finally(() => setLoading(false))
  }, [uid])

  useEffect(() => { fetch() }, [fetch])

  return { usage, loading, refresh: fetch }
}

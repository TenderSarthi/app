'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const cancelledRef = useRef(false)

  const fetch = useCallback(() => {
    cancelledRef.current = false
    if (!uid) {
      const timer = setTimeout(() => {
        if (!cancelledRef.current) {
          setUsage({ queries: 0, bidDocs: 0 })
          setLoading(false)
        }
      }, 0)
      return () => { cancelledRef.current = true; clearTimeout(timer) }
    }
    setLoading(true)
    getAIUsage(uid)
      .then(data => { if (!cancelledRef.current) setUsage(data) })
      .catch((err: unknown) => {
        console.warn('[useAIUsage] Failed to load AI usage:', err)
        if (!cancelledRef.current) setUsage({ queries: 0, bidDocs: 0 })
      })
      .finally(() => { if (!cancelledRef.current) setLoading(false) })
  }, [uid])

  useEffect(() => {
    cancelledRef.current = false
    const cleanup = fetch()
    return () => {
      cancelledRef.current = true
      cleanup?.()
    }
  }, [fetch])

  return { usage, loading, refresh: fetch }
}

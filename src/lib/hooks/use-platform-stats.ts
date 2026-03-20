'use client'

import { useState, useEffect } from 'react'
import { getPlatformStats } from '@/lib/firebase/firestore'
import type { PlatformStats } from '@/lib/types'

export interface UsePlatformStatsResult {
  stats: PlatformStats | null
  loading: boolean
}

export function usePlatformStats(): UsePlatformStatsResult {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getPlatformStats()
      .then(data => { if (!cancelled) setStats(data) })
      .catch(() => { if (!cancelled) setStats(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { stats, loading }
}

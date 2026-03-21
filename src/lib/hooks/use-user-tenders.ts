'use client'

import { useState, useEffect } from 'react'
import { subscribeUserTenders } from '@/lib/firebase/firestore'
import type { Tender } from '@/lib/types'

export interface UseUserTendersResult {
  tenders: Tender[]
  loading: boolean
  error: string | null
}

export function useUserTenders(uid: string | null): UseUserTendersResult {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      const timer = setTimeout(() => {
        setTenders([])
        setLoading(false)
        setError(null)
      }, 0)
      return () => clearTimeout(timer)
    }

    setLoading(true)
    const unsub = subscribeUserTenders(
      uid,
      (data) => {
        setTenders(data)
        setLoading(false)
        setError(null)
      },
      (_err) => {
        setError('Tenders load नहीं हुए। फिर try करें।')
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  return { tenders, loading, error }
}

'use client'
import { useEffect, useState } from 'react'
import { subscribeOrders } from '@/lib/firebase/firestore'
import type { Order } from '@/lib/types'

export function useOrders(uid: string | null) {
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    return subscribeOrders(
      uid,
      (data) => { setOrders(data); setLoading(false); setError(null) },
      (err)  => { setLoading(false); setError(err instanceof Error ? err.message : 'Orders load नहीं हुए।') }
    )
  }, [uid])

  return { orders, loading, error }
}

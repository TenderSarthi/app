'use client'
import { useEffect, useState } from 'react'
import { subscribeOrders } from '@/lib/firebase/firestore'
import type { Order } from '@/lib/types'

export function useOrders(uid: string | null) {
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeOrders(
      uid,
      (data) => { setOrders(data); setLoading(false) },
      ()     => setLoading(false)
    )
  }, [uid])

  return { orders, loading }
}

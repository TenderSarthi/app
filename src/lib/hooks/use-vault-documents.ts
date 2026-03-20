'use client'
import { useEffect, useState } from 'react'
import { subscribeUserDocuments } from '@/lib/firebase/firestore'
import type { VaultDocument } from '@/lib/types'

export function useVaultDocuments(uid: string | null) {
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!uid) {
      setDocuments([])
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeUserDocuments(
      uid,
      (docs) => { setDocuments(docs); setLoading(false) },
      () => setLoading(false)
    )
  }, [uid])

  return { documents, loading }
}

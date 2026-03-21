'use client'
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from './use-auth'
import type { UserProfile } from '@/lib/types'

/** Real-time Firestore listener — updates all open sessions within ~1s on any change */
export function useUserProfile() {
  const { uid } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!uid) {
      const timer = setTimeout(() => { setProfile(null); setLoading(false) }, 0)
      return () => clearTimeout(timer)
    }
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null)
        setLoading(false)
      },
      (err) => {
        console.error('[useUserProfile] onSnapshot error:', err)
        setProfile(null)
        setLoading(false)
      }
    )
  }, [uid])
  return { profile, loading }
}

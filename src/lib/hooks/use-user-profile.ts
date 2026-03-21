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
      // Auth resolved with no user — clear immediately
      setProfile(null)
      setLoading(false)
      return
    }
    // uid just became available: reset to loading so the app waits for the
    // first snapshot before making any routing decisions. Without this, the
    // loading=false state from the previous uid=null path can linger and
    // cause AppLayout to redirect to onboarding on every page reload.
    setLoading(true)
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

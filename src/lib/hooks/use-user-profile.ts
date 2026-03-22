'use client'
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from './use-auth'
import type { UserProfile } from '@/lib/types'

/** Real-time Firestore listener — updates all open sessions within ~1s on any change */
export function useUserProfile() {
  const { uid, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!uid) {
      // Only declare "done loading" once Firebase Auth has fully resolved.
      // If authLoading is still true, another effect run will follow when
      // auth settles — don't prematurely set loading=false here, because
      // that creates a window where profileLoading=false + user=null →
      // user=set causes the onboarding guard to fire on locale switches.
      if (!authLoading) {
        setProfile(null)
        setLoading(false)
      }
      return
    }
    // uid just became available: reset to loading so the app waits for the
    // first snapshot before making any routing decisions.
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
  }, [uid, authLoading])
  return { profile, loading }
}

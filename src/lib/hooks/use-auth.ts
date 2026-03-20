'use client'
import { useFirebase } from '@/components/providers/firebase-provider'

export function useAuth() {
  const { user, loading } = useFirebase()
  return { user, loading, isAuthenticated: !loading && user !== null, uid: user?.uid ?? null }
}

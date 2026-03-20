'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthChange, type User } from '@/lib/firebase/auth'

interface Ctx { user: User | null; loading: boolean }
const FirebaseContext = createContext<Ctx>({ user: null, loading: true })

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => onAuthChange((u) => { setUser(u); setLoading(false) }), [])
  return <FirebaseContext.Provider value={{ user, loading }}>{children}</FirebaseContext.Provider>
}

export function useFirebase() { return useContext(FirebaseContext) }

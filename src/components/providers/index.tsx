'use client'
import type { ReactNode } from 'react'
import { FirebaseProvider } from './firebase-provider'
import { PostHogProvider } from './posthog-provider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider>
      <PostHogProvider>{children}</PostHogProvider>
    </FirebaseProvider>
  )
}

'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Admin error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-6">
      <p className="font-semibold text-danger text-lg">Something went wrong</p>
      <p className="text-sm text-muted max-w-xs">{error.message}</p>
      <Button size="sm" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}

// src/app/[locale]/(app)/find/page.tsx
// /find is merged into /tenders — redirect to preserve any bookmarks or external links
'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function FindPage() {
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()

  useEffect(() => {
    router.replace(`/${locale}/tenders`)
  }, [router, locale])

  return null
}

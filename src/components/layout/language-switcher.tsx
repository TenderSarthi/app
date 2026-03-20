'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { updateLanguage } from '@/lib/firebase/firestore'
import { SUPPORTED_LANGUAGES } from '@/lib/constants'
import type { LanguageCode } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { uid } = useAuth()

  async function handleChange(locale: string | null) {
    if (!locale) return
    if (uid) await updateLanguage(uid, locale as LanguageCode)
    router.push(pathname.replace(`/${currentLocale}`, `/${locale}`))
  }

  return (
    <Select defaultValue={currentLocale} onValueChange={handleChange}>
      <SelectTrigger className="w-36 h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>{l.nativeLabel}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

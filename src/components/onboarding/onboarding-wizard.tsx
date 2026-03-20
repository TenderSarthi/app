'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Step1Profile } from './step1-profile'
import { Step2State } from './step2-state'
import { Step3Categories } from './step3-categories'
import { Step4Notifications } from './step4-notifications'
import { saveOnboardingData } from '@/lib/firebase/firestore'
import { useAuth } from '@/lib/hooks/use-auth'
import { track } from '@/lib/posthog'
import type { LanguageCode } from '@/lib/types'
import { isValidLanguageCode } from '@/lib/types'

const TITLES = ['आपका Profile', 'आपका State', 'आपकी Categories', 'Notifications']
const SUBTITLES = ['TenderSarthi में आपका स्वागत है!', 'हम आपके state के tenders filter करेंगे', 'जो लागू हों वो सब चुनें', 'Tender alerts तुरंत पाएं']

export function OnboardingWizard({ locale }: { locale: string }) {
  const { uid } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [state, setState] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  const canProceed = step === 1 ? name.trim() && businessName.trim() : step === 2 ? state : categories.length > 0

  async function complete(fcmToken: string | null, declined: boolean) {
    if (!uid) return
    setSaving(true)
    try {
      await saveOnboardingData(uid, { name, businessName, state, categories, language: (isValidLanguageCode(locale) ? locale : 'hi') as LanguageCode, fcmToken, notificationsDeclined: declined })
      track('onboarding_completed', { state, categoriesCount: categories.length, locale })
      router.replace(`/${locale}/dashboard`)
    } finally { setSaving(false) }
  }

  async function handleAllow() {
    let token: string | null = null
    if ('Notification' in window && (await Notification.requestPermission()) === 'granted') {
      token = 'pending-fcm-setup' // Full FCM integration in Subsystem 6
    }
    await complete(token, false)
  }

  return (
    <div className="min-h-screen bg-lightbg flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted font-medium">Step {step} of 4</span>
            <span className="text-xs text-muted">{Math.round((step / 4) * 100)}%</span>
          </div>
          <Progress value={(step / 4) * 100} className="h-1.5" />
        </div>
      </div>
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-4 py-8">
        {step < 4 && (
          <div className="mb-6">
            <h2 className="font-heading font-bold text-xl text-navy">{TITLES[step - 1]}</h2>
            <p className="text-muted text-sm mt-1">{SUBTITLES[step - 1]}</p>
          </div>
        )}
        <div className="flex-1">
          {step === 1 && <Step1Profile name={name} businessName={businessName} onChange={(f, v) => f === 'name' ? setName(v) : setBusinessName(v)} />}
          {step === 2 && <Step2State value={state} onChange={setState} />}
          {step === 3 && <Step3Categories selected={categories} onChange={setCategories} />}
          {step === 4 && <Step4Notifications onAllow={handleAllow} onSkip={() => complete(null, true)} loading={saving} />}
        </div>
        {step < 4 && (
          <div className="flex gap-3 mt-8">
            {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-11">वापस</Button>}
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed} className="flex-1 h-11 bg-navy hover:bg-navy/90 text-white">
              {step === 3 ? 'लगभग हो गया!' : 'अगला →'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

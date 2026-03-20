'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendOtp, verifyOtp, type ConfirmationResult } from '@/lib/firebase/auth'
import { createUser, userExists } from '@/lib/firebase/firestore'
import { track, identifyUser } from '@/lib/posthog'

export function PhoneOtpForm({ locale }: { locale: string }) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (phone.length < 10) { setError('Phone number 10 digits का होना चाहिए।'); return }
    setLoading(true); setError(null)
    try {
      const e164 = phone.startsWith('+') ? phone : `+91${phone}`
      setConfirmation(await sendOtp(e164, 'recaptcha-container'))
    } catch { setError('OTP भेजने में error। फिर try करें।') }
    finally { setLoading(false) }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (!confirmation) return
    setLoading(true); setError(null)
    try {
      const user = await verifyOtp(confirmation, otp)
      identifyUser(user.uid, { phone: user.phoneNumber, method: 'phone' })
      if (!(await userExists(user.uid))) {
        await createUser(user.uid, null, user.phoneNumber)
        track('signup_completed', { method: 'phone' })
        router.push(`/${locale}/onboarding`)
      } else { router.push(`/${locale}/dashboard`) }
    } catch { setError('OTP गलत है। फिर try करें।') }
    finally { setLoading(false) }
  }

  if (!confirmation) return (
    <form onSubmit={handleSend} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="phone">Mobile Number</Label>
        <div className="flex gap-2">
          <span className="flex items-center px-3 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">+91</span>
          <Input id="phone" type="tel" inputMode="numeric" maxLength={10} placeholder="9876543210"
            value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="flex-1 h-11" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full h-11 bg-navy hover:bg-navy/90" disabled={loading}>
        {loading ? 'Sending...' : 'OTP भेजें'}
      </Button>
      <div id="recaptcha-container" />
    </form>
  )

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <p className="text-sm text-muted text-center">
        OTP sent to +91{phone}.{' '}
        <button type="button" className="text-orange underline" onClick={() => setConfirmation(null)}>गलत number?</button>
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="otp">Enter OTP</Label>
        <Input id="otp" type="text" inputMode="numeric" maxLength={6} placeholder="______"
          value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="h-11 text-center text-lg tracking-widest" />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full h-11 bg-navy hover:bg-navy/90" disabled={loading || otp.length < 6}>
        {loading ? 'Verifying...' : 'OTP Verify करें'}
      </Button>
    </form>
  )
}

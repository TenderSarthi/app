import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { PhoneOtpForm } from '@/components/auth/phone-otp-form'

export const metadata: Metadata = {
  title: 'Login — TenderSarthi',
  description: 'Sign in to TenderSarthi — the AI-powered GeM tender assistant for Indian vendors.',
}

function CompassLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="24" fill="#1A3766"/>
      <circle cx="26" cy="26" r="17" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
      <line x1="26" y1="9" x2="26" y2="43" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <line x1="9"  y1="26" x2="43" y2="26" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <polygon points="26,11 23,26 26,24 29,26" fill="#F97316"/>
      <polygon points="26,41 23,26 26,28 29,26" fill="white" opacity="0.5"/>
      <circle cx="26" cy="26" r="2.5" fill="white"/>
    </svg>
  )
}

export default async function AuthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('auth')
  return (
    <div className="min-h-screen bg-lightbg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><CompassLogo /></div>
          <h1 className="font-heading font-bold text-2xl text-navy">TenderSarthi</h1>
          <p className="text-muted text-sm mt-1">सरकारी टेंडर जीतो, आसानी से</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <GoogleSignInButton locale={locale} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-muted">या (or)</span></div>
          </div>
          <PhoneOtpForm locale={locale} />
        </div>
        <p className="text-center text-xs text-muted mt-4">
          {t('privacyNote')}
        </p>
      </div>
    </div>
  )
}

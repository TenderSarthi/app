import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing')
  return { title: `${t('footer.privacy')} — TenderSarthi` }
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-12 max-w-3xl mx-auto space-y-6">
      <h1 className="font-heading font-bold text-2xl text-navy">Privacy Policy</h1>
      <p className="text-sm text-muted">Last updated: March 2026</p>
      <p className="text-sm text-muted leading-relaxed">
        TenderSarthi collects your name, phone number, email address, and business details solely to
        provide AI-powered tender assistance. We do not sell your data to third parties. Payment is
        processed by Razorpay and is subject to their privacy policy. You may request account deletion
        at any time from Settings.
      </p>
      <p className="text-sm text-muted leading-relaxed">
        We use Firebase Authentication and Firestore (Google Cloud) to store your data securely.
        Analytics are powered by PostHog. For questions, contact us at privacy@tendersarthi.in.
      </p>
      <Link href="/" className="text-sm text-orange hover:underline">Back to Home</Link>
    </main>
  )
}

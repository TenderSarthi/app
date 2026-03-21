import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing')
  return { title: `${t('footer.terms')} — TenderSarthi` }
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-12 max-w-3xl mx-auto space-y-6">
      <h1 className="font-heading font-bold text-2xl text-navy">Terms of Service</h1>
      <p className="text-sm text-muted">Last updated: March 2026</p>
      <p className="text-sm text-muted leading-relaxed">
        By using TenderSarthi you agree to use the platform for lawful tender-related activities only.
        TenderSarthi is a tool — it does not guarantee tender wins. The 7-day free trial gives full Pro
        access; after expiry, you must subscribe to continue Pro features.
      </p>
      <p className="text-sm text-muted leading-relaxed">
        Subscriptions auto-renew monthly or annually. You may cancel at any time from Settings.
        Refunds are subject to Razorpay's refund policy. We reserve the right to suspend accounts
        that misuse the platform.
      </p>
      <Link href="/" className="text-sm text-orange hover:underline">Back to Home</Link>
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle, Bell, FileText, Zap, Quote } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/hooks/use-auth'
import { getPlatformStats } from '@/lib/firebase/firestore'
import { formatStat } from '@/lib/landing-utils'
import type { PlatformStats } from '@/lib/types'

export default function LandingPage() {
  const t      = useTranslations('landing')
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ locale: string }>()
  const locale = params.locale

  const [stats, setStats] = useState<PlatformStats | null>(null)

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) router.replace(`/${locale}/dashboard`)
  }, [loading, user, locale, router])

  // Fetch platform stats for trust bar
  useEffect(() => {
    getPlatformStats().then(setStats).catch(() => {})
  }, [])

  // Show nothing while auth resolves (avoids flash of landing for logged-in users)
  if (loading || user) return null

  return (
    <div className="min-h-screen bg-white font-body">

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <span className="font-heading font-bold text-navy text-lg">TenderSarthi</span>
        <div className="flex gap-2">
          <Link href={`/${locale}/auth`} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
            {t('nav.login')}
          </Link>
          <Link href={`/${locale}/auth`} className={buttonVariants({ size: 'sm', className: 'bg-orange text-white hover:bg-orange/90' })}>
            {t('nav.getStarted')}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-navy text-white px-4 py-16 text-center space-y-6">
        <Badge className="bg-orange/20 text-orange border-orange/30">{t('hero.badge')}</Badge>
        <h1 className="font-heading font-bold text-3xl desktop:text-5xl leading-tight max-w-2xl mx-auto">
          {t('hero.headline')}
        </h1>
        <p className="text-white/80 text-base desktop:text-lg max-w-xl mx-auto">
          {t('hero.subheadline')}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href={`/${locale}/auth`} className={buttonVariants({ size: 'lg', className: 'bg-orange text-white hover:bg-orange/90' })}>
            {t('hero.cta')}
          </Link>
          <Link href="#pricing" className={buttonVariants({ size: 'lg', variant: 'outline', className: 'border-white/30 text-white hover:bg-white/10' })}>
            {t('hero.seePricing')}
          </Link>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-lightbg border-b border-gray-100 px-4 py-6">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-heading font-bold text-2xl text-navy">{formatStat(stats?.vendorCount ?? null)}</p>
            <p className="text-xs text-muted">{t('trust.vendors')}</p>
          </div>
          <div>
            <p className="font-heading font-bold text-2xl text-navy">{formatStat(stats?.tendersFiled ?? null)}</p>
            <p className="text-xs text-muted">{t('trust.filed')}</p>
          </div>
          <div>
            <p className="font-heading font-bold text-2xl text-navy">{formatStat(stats?.tendersWon ?? null)}</p>
            <p className="text-xs text-muted">{t('trust.won')}</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-14 max-w-4xl mx-auto space-y-10">
        <h2 className="font-heading font-bold text-2xl text-navy text-center">{t('features.title')}</h2>
        <div className="grid desktop:grid-cols-3 gap-6">
          {[
            { icon: Bell,     accentBg: 'bg-orange/10', accentText: 'text-orange', title: t('features.alerts.title'), desc: t('features.alerts.desc') },
            { icon: Zap,      accentBg: 'bg-gold/10',   accentText: 'text-gold',   title: t('features.ai.title'),    desc: t('features.ai.desc') },
            { icon: FileText, accentBg: 'bg-navy/8',    accentText: 'text-navy',   title: t('features.bid.title'),   desc: t('features.bid.desc') },
          ].map(({ icon: Icon, accentBg, accentText, title, desc }) => (
            <div key={title} className="bg-white border border-navy/10 rounded-xl p-5 space-y-3 shadow-sm hover:shadow-md hover:border-navy/20 transition-all">
              <div className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center`}>
                <Icon size={20} className={accentText} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-navy">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-lightbg px-4 py-14">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="font-heading font-bold text-2xl text-navy text-center">{t('pricing.title')}</h2>
          <div className="grid desktop:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-navy">{t('pricing.free.title')}</h3>
                <p className="text-2xl font-bold text-navy mt-1">{t('pricing.free.price')}</p>
              </div>
              <ul className="space-y-2">
                {(['f1','f2','f3'] as const).map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm text-muted">
                    <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                    {t(`pricing.free.${k}`)}
                  </li>
                ))}
              </ul>
              <Link href={`/${locale}/auth`} className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
                {t('pricing.freeCta')}
              </Link>
            </div>
            <div className="bg-navy text-white border border-navy rounded-xl p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{t('pricing.pro.title')}</h3>
                  <Badge className="bg-orange text-white text-xs">Popular</Badge>
                </div>
                <p className="text-sm text-white/50 line-through mt-1">{t('pricing.pro.mrp')}</p>
                <p className="text-2xl font-bold">{t('pricing.pro.price')}</p>
              </div>
              <ul className="space-y-2">
                {(['p1','p2','p3','p4'] as const).map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm text-white/80">
                    <CheckCircle size={14} className="text-orange mt-0.5 shrink-0" />
                    {t(`pricing.pro.${k}`)}
                  </li>
                ))}
              </ul>
              <Link href={`/${locale}/auth`} className={buttonVariants({ className: 'w-full bg-orange hover:bg-orange/90 text-white' })}>
                {t('pricing.proCta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-14 max-w-4xl mx-auto space-y-8">
        <h2 className="font-heading font-bold text-2xl text-navy text-center">{t('testimonials.title')}</h2>
        <div className="grid desktop:grid-cols-3 gap-6">
          {(['t1','t2','t3'] as const).map((k) => (
            <div key={k} className="bg-white border border-navy/10 rounded-xl p-5 space-y-3 shadow-sm">
              <Quote size={16} className="text-orange/40" aria-hidden="true" />
              <p className="text-sm text-navy/80 italic leading-relaxed">{t(`testimonials.${k}.text`)}</p>
              <div className="pt-1 border-t border-navy/5">
                <p className="text-sm font-semibold text-navy">{t(`testimonials.${k}.name`)}</p>
                <p className="text-xs text-muted mt-0.5">{t(`testimonials.${k}.role`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-4 py-8 text-center space-y-3">
        <p className="font-heading font-bold text-navy">TenderSarthi</p>
        <div className="flex justify-center gap-4 text-sm">
          <Link href={`/${locale}/privacy`} className="text-muted hover:text-navy">{t('footer.privacy')}</Link>
          <Link href={`/${locale}/terms`}   className="text-muted hover:text-navy">{t('footer.terms')}</Link>
        </div>
        <p className="text-xs text-muted">{t('footer.copyright')}</p>
      </footer>
    </div>
  )
}

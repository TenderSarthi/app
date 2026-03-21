'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Script from 'next/script'
import { useTranslations } from 'next-intl'
import { Zap, Shield, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFirebase }      from '@/components/providers/firebase-provider'
import { useUserProfile }   from '@/lib/hooks/use-user-profile'
import { isPro, isOnTrial, isPaidPro, isTrialExpired } from '@/lib/plan-guard'
import { updateLanguage }   from '@/lib/firebase/firestore'
import { track }            from '@/lib/posthog'
import { LOCALE_CODES }     from '@/lib/constants'
import type { LanguageCode } from '@/lib/types'

// useSearchParams requires a Suspense boundary in Next.js App Router
export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-8 w-32 bg-muted/30 animate-pulse rounded" />}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const t             = useTranslations('settings')
  const { user }      = useFirebase()
  const { profile }   = useUserProfile()
  const router        = useRouter()
  const params        = useParams()
  const locale        = params.locale as string
  const searchParams  = useSearchParams()
  const upgradeParam  = searchParams.get('upgrade') as 'monthly' | 'annual' | null

  const [rzpReady,        setRzpReady]        = useState(false)
  const [upgrading,       setUpgrading]       = useState(false)
  const [cancelling,      setCancelling]      = useState(false)
  const [confirmCancel,   setConfirmCancel]   = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(false)
  const [deletionSent,    setDeletionSent]    = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [successMsg,      setSuccessMsg]      = useState<string | null>(null)

  // ── Checkout ──────────────────────────────────────────────────────────
  const handleUpgrade = useCallback(async (plan: 'monthly' | 'annual') => {
    if (!user || !profile || !rzpReady) return
    setUpgrading(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res   = await fetch('/api/payments/create-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan }),
      })
      if (!res.ok) throw new Error('Failed to create subscription')

      const { subscriptionId, keyId } = await res.json() as {
        subscriptionId: string
        keyId: string
      }

      const rzpInstance = new (window as { Razorpay: new (o: unknown) => { open(): void } }).Razorpay({
        key:             keyId,
        subscription_id: subscriptionId,
        name:            'TenderSarthi',
        description:     plan === 'monthly' ? '₹499/month' : '₹3,999/year',
        prefill: {
          name:    profile.name ?? '',
          email:   profile.email ?? '',
          contact: profile.phone ?? '',
        },
        handler: async (response: {
          razorpay_payment_id:      string
          razorpay_subscription_id: string
          razorpay_signature:       string
        }) => {
          const token2    = await user.getIdToken()
          const verifyRes = await fetch('/api/payments/verify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
            body:    JSON.stringify(response),
          })
          if (verifyRes.ok) {
            track('upgrade_completed', { plan })
            setSuccessMsg(t('upgradeSuccess'))
          } else {
            setError(t('verifyFailed'))
          }
          setUpgrading(false)
        },
        modal: { ondismiss: () => setUpgrading(false) },
      })
      rzpInstance.open()
    } catch {
      setError(t('checkoutFailed'))
      setUpgrading(false)
    }
  }, [user, profile, rzpReady, t])

  // Auto-trigger checkout when arriving from UpgradeDialog (?upgrade=monthly)
  useEffect(() => {
    if (upgradeParam && rzpReady && profile && user) {
      handleUpgrade(upgradeParam)
      router.replace(`/${locale}/settings`, { scroll: false })
    }
  }, [upgradeParam, rzpReady, router, locale, handleUpgrade, profile, user])

  // ── Cancel ────────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (!user) return
    setConfirmCancel(false)
    setCancelling(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res   = await fetch('/api/payments/cancel-subscription', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Cancel failed')
      track('plan_cancelled', {})
    } catch {
      setError(t('cancelFailed'))
    } finally {
      setCancelling(false)
    }
  }, [user, t])

  // ── Delete account ────────────────────────────────────────────────────
  const handleDeleteRequest = useCallback(async () => {
    if (!user) return
    setConfirmDelete(false)
    const token = await user.getIdToken()
    await fetch('/api/payments/delete-request', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })
    setDeletionSent(true)
    track('account_deletion_requested', {})
  }, [user])

  // ── Language ──────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback(async (lang: LanguageCode) => {
    if (!user) return
    await updateLanguage(user.uid, lang)
    router.push(`/${lang}/settings`)
  }, [user, router])

  if (!profile) return null

  return (
    <div className="space-y-6 max-w-lg">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setRzpReady(true)}
      />

      <h1 className="font-heading font-bold text-2xl text-navy">{t('title')}</h1>

      {error      && <p role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {successMsg && <p role="status" className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{successMsg}</p>}

      {/* ── Plan Card ───────────────────────────────────────────────── */}
      <div className="border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-navy flex items-center gap-2">
            <Zap size={18} className="text-orange" />
            {t('planCard')}
          </h2>
          {isPro(profile) && (
            <Badge className="bg-orange text-white">Pro</Badge>
          )}
        </div>

        <PlanContent
          profile={profile}
          upgrading={upgrading}
          cancelling={cancelling}
          confirmCancel={confirmCancel}
          onUpgrade={handleUpgrade}
          onCancelClick={() => setConfirmCancel(true)}
          onCancelConfirm={handleCancel}
          onCancelDismiss={() => setConfirmCancel(false)}
          t={t}
        />
      </div>

      {/* ── Language ────────────────────────────────────────────────── */}
      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-navy">{t('language')}</h2>
        <Select
          value={profile.language}
          onValueChange={(v) => handleLanguageChange(v as LanguageCode)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALE_CODES.map((code) => (
              <SelectItem key={code} value={code}>{code.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
      <div className="border border-red-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-red-600">{t('dangerZone')}</h2>
        {deletionSent ? (
          <p className="text-sm text-muted flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            {t('deleteRequested')}
          </p>
        ) : confirmDelete ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">{t('deleteWarning')}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" type="button" onClick={handleDeleteRequest}>
                {t('deleteConfirm')}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setConfirmDelete(false)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm" variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            {t('deleteAccount')}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── PlanContent — renders the correct plan state UI ─────────────────────
interface PlanContentProps {
  profile:         NonNullable<ReturnType<typeof useUserProfile>['profile']>
  upgrading:       boolean
  cancelling:      boolean
  confirmCancel:   boolean
  onUpgrade:       (plan: 'monthly' | 'annual') => void
  onCancelClick:   () => void
  onCancelConfirm: () => void
  onCancelDismiss: () => void
  t:               ReturnType<typeof useTranslations>
}

function PlanContent({
  profile, upgrading, cancelling, confirmCancel,
  onUpgrade, onCancelClick, onCancelConfirm, onCancelDismiss, t,
}: PlanContentProps) {
  const renewDate = profile.proRenewsAt?.toDate().toLocaleDateString('en-IN')
  const trialEnd  = profile.trialEndsAt?.toDate().toLocaleDateString('en-IN')

  const UpgradeCTAs = (
    <div className="flex gap-2 flex-wrap">
      <Button
        size="sm" type="button"
        variant="outline"
        className="border-orange text-orange hover:bg-orange/5"
        disabled={upgrading}
        onClick={() => onUpgrade('monthly')}
      >
        {upgrading ? <Loader2 size={14} className="animate-spin" /> : `₹499/${t('month')}`}
      </Button>
      <Button
        size="sm" type="button"
        className="bg-gold text-white hover:bg-gold/90"
        disabled={upgrading}
        onClick={() => onUpgrade('annual')}
      >
        {upgrading ? <Loader2 size={14} className="animate-spin" /> : `₹3,999/${t('year')}`}
      </Button>
    </div>
  )

  if (isPaidPro(profile)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-navy">
          {t('planPro')} · {t('renewsOn', { date: renewDate ?? '—' })}
        </p>
        {confirmCancel ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">{t('cancelConfirm')}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" type="button" disabled={cancelling} onClick={onCancelConfirm}>
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : t('cancelPlan')}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={onCancelDismiss}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-muted text-xs" type="button" onClick={onCancelClick}>
            {t('cancelPlan')}
          </Button>
        )}
      </div>
    )
  }

  if (isOnTrial(profile) && !isTrialExpired(profile)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-navy flex items-center gap-1.5">
          <Shield size={14} className="text-orange" />
          {t('planTrial')} · {t('trialExpiresOn', { date: trialEnd ?? '—' })}
        </p>
        {UpgradeCTAs}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('planFree')}</p>
      {UpgradeCTAs}
    </div>
  )
}

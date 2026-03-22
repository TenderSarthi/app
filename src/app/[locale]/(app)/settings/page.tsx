'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Script from 'next/script'
import { useTranslations } from 'next-intl'
import { Zap, Shield, Loader2, CheckCircle, LogOut, ChevronDown, ChevronUp, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFirebase }      from '@/components/providers/firebase-provider'
import { useUserProfile }   from '@/lib/hooks/use-user-profile'
import { isPro, isOnTrial, isPaidPro, isTrialExpired } from '@/lib/plan-guard'
import { updateLanguage, updateProfile }   from '@/lib/firebase/firestore'
import { signOut } from '@/lib/firebase/auth'
import { track }            from '@/lib/posthog'
import { SUPPORTED_LANGUAGES, INDIAN_STATES, GEM_CATEGORIES } from '@/lib/constants'
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
  const [loggingOut,      setLoggingOut]      = useState(false)

  // ── Profile form state ─────────────────────────────────────────────────
  const [profileName,     setProfileName]     = useState('')
  const [profileBusiness, setProfileBusiness] = useState('')
  const [profileState,    setProfileState]    = useState('')
  const [profileCats,     setProfileCats]     = useState<string[]>([])
  const [profileGstin,    setProfileGstin]    = useState('')
  const [profileUdyam,    setProfileUdyam]    = useState('')
  const [profileExp,      setProfileExp]      = useState('')
  const [profileSaving,   setProfileSaving]   = useState(false)
  const [profileSaved,    setProfileSaved]    = useState(false)
  const [profileError,    setProfileError]    = useState<string | null>(null)
  const [showCats,        setShowCats]        = useState(false)

  // Seed form once when profile first loads — keyed on uid so it doesn't
  // re-seed on every Firestore snapshot (would erase in-progress edits)
  const seeded = useRef(false)
  useEffect(() => {
    if (!profile || seeded.current) return
    seeded.current = true
    setProfileName(profile.name ?? '')
    setProfileBusiness(profile.businessName ?? '')
    setProfileState(profile.state ?? '')
    setProfileCats(profile.categories ?? [])
    setProfileGstin(profile.gstin ?? '')
    setProfileUdyam(profile.udyamNumber ?? '')
    setProfileExp(profile.experienceYears != null ? String(profile.experienceYears) : '')
  }, [profile])

  // ── Save profile ───────────────────────────────────────────────────────
  const handleSaveProfile = useCallback(async () => {
    if (!user) return
    setProfileSaving(true)
    setProfileError(null)
    setProfileSaved(false)
    try {
      await updateProfile(user.uid, {
        name:            profileName.trim(),
        businessName:    profileBusiness.trim(),
        state:           profileState,
        categories:      profileCats,
        gstin:           profileGstin.trim() || null,
        udyamNumber:     profileUdyam.trim() || null,
        experienceYears: profileExp ? Number(profileExp) : null,
      })
      setProfileSaved(true)
      track('profile_updated', {})
      setTimeout(() => setProfileSaved(false), 3000)
    } catch {
      setProfileError(t('profileError'))
    } finally {
      setProfileSaving(false)
    }
  }, [user, profileName, profileBusiness, profileState, profileCats, profileGstin, profileUdyam, profileExp, t])

  // ── Logout ─────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await signOut()
      router.replace(`/${locale}/auth`)
    } catch {
      setLoggingOut(false)
    }
  }, [router, locale])

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

      const rzpInstance = new (window as unknown as { Razorpay: new (o: unknown) => { open(): void } }).Razorpay({
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
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/payments/delete-request', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setError(t('requestFailed')); return }
      setDeletionSent(true)
      track('account_deletion_requested', {})
    } catch {
      setError(t('requestFailed'))
    }
  }, [user, t])

  // ── Language ──────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback(async (lang: LanguageCode) => {
    if (!user) return
    await updateLanguage(user.uid, lang)
    router.push(`/${lang}/settings`)
  }, [user, router])

  if (!profile) return null

  const toggleCategory = (cat: string) => {
    setProfileCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  return (
    <div className="space-y-5 max-w-lg pb-8">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setRzpReady(true)}
      />

      <h1 className="font-heading font-bold text-2xl text-navy">{t('title')}</h1>

      {error      && <p role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {successMsg && <p role="status" className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{successMsg}</p>}

      {/* ── Profile Section ──────────────────────────────────────────── */}
      <div className="border rounded-xl p-4 space-y-4">
        <h2 className="font-semibold text-navy flex items-center gap-2">
          <User size={18} className="text-orange" />
          {t('profile')}
        </h2>

        {profileError && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{profileError}</p>
        )}

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('fullName')}</label>
            <input
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              className="w-full border border-navy/20 rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-orange/30"
              placeholder="Ramesh Kumar"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('businessName')}</label>
            <input
              value={profileBusiness}
              onChange={e => setProfileBusiness(e.target.value)}
              className="w-full border border-navy/20 rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-orange/30"
              placeholder="Kumar Enterprises"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('state')}</label>
            <select
              value={profileState}
              onChange={e => setProfileState(e.target.value)}
              className="w-full border border-navy/20 rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-orange/30"
            >
              <option value="">{t('selectState')}</option>
              {INDIAN_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Category multi-select (collapsible) */}
          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('categories')}</label>
            <button
              type="button"
              onClick={() => setShowCats(v => !v)}
              className="w-full border border-navy/20 rounded-lg px-3 py-2 text-sm text-navy bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-orange/30"
            >
              <span className="truncate">
                {profileCats.length > 0 ? profileCats.join(', ') : '— select —'}
              </span>
              {showCats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showCats && (
              <div className="mt-1 border border-navy/10 rounded-lg bg-white p-2 grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                {GEM_CATEGORIES.map(cat => (
                  <label key={cat} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-navy/5 cursor-pointer text-xs text-navy">
                    <input
                      type="checkbox"
                      checked={profileCats.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="accent-orange"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-navy mb-1">{t('gstin')} <span className="font-normal text-muted">(optional)</span></label>
              <input
                value={profileGstin}
                onChange={e => setProfileGstin(e.target.value)}
                className="w-full border border-navy/20 rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-orange/30"
                placeholder={t('gstinPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy mb-1">{t('experience')} <span className="font-normal text-muted">(optional)</span></label>
              <input
                type="number" min="0" max="50"
                value={profileExp}
                onChange={e => setProfileExp(e.target.value)}
                className="w-full border border-navy/20 rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-orange/30"
                placeholder="5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-navy mb-1">{t('udyam')} <span className="font-normal text-muted">(optional)</span></label>
            <input
              value={profileUdyam}
              onChange={e => setProfileUdyam(e.target.value)}
              className="w-full border border-navy/20 rounded-lg px-3 py-2 text-sm text-navy bg-white focus:outline-none focus:ring-2 focus:ring-orange/30"
              placeholder={t('udyamPlaceholder')}
            />
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="bg-navy text-white hover:bg-navy/90 w-full"
          disabled={profileSaving}
          onClick={handleSaveProfile}
        >
          {profileSaving ? (
            <><Loader2 size={14} className="animate-spin mr-1" />{t('loggingOut')}</>
          ) : profileSaved ? (
            <><CheckCircle size={14} className="mr-1 text-green-300" />{t('profileSaved')}</>
          ) : (
            t('saveProfile')
          )}
        </Button>
      </div>

      {/* ── Log Out ─────────────────────────────────────────────────── */}
      <div className="border rounded-xl p-4">
        <Button
          type="button"
          variant="outline"
          className="border-navy/30 text-navy hover:bg-navy/5 w-full"
          disabled={loggingOut}
          onClick={handleLogout}
        >
          {loggingOut ? (
            <><Loader2 size={14} className="animate-spin mr-2" />{t('loggingOut')}</>
          ) : (
            <><LogOut size={14} className="mr-2" />{t('logout')}</>
          )}
        </Button>
      </div>

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
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>{lang.nativeLabel}</SelectItem>
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
        {upgrading ? <Loader2 size={14} className="animate-spin" /> : (
          <><span className="line-through text-xs opacity-60 mr-1">₹899</span>₹499/{t('month')}</>
        )}
      </Button>
      <Button
        size="sm" type="button"
        className="bg-gold text-white hover:bg-gold/90"
        disabled={upgrading}
        onClick={() => onUpgrade('annual')}
      >
        {upgrading ? <Loader2 size={14} className="animate-spin" /> : (
          <><span className="line-through text-xs opacity-60 mr-1">₹7,999</span>₹3,999/{t('year')}</>
        )}
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

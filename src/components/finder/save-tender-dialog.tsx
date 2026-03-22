'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GEM_CATEGORIES } from '@/lib/constants'
import { saveTender } from '@/lib/firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { canSaveTenders } from '@/lib/plan-guard'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { track } from '@/lib/posthog'
import type { UserProfile } from '@/lib/types'

interface SaveTenderDialogProps {
  open: boolean
  onClose: () => void
  aiSummary?: string
  uid: string
  profile: UserProfile
  currentTenderCount: number
  /** Pre-fill the tender name (e.g. when saving from live feed) */
  initialName?: string
  /** Pre-fill the category (e.g. when saving from live feed) */
  initialCategory?: string
}

export function SaveTenderDialog({
  open, onClose, aiSummary, uid, profile, currentTenderCount,
  initialName = '', initialCategory,
}: SaveTenderDialogProps) {
  const t = useTranslations('finder')
  const [name, setName] = useState(initialName)
  const [gemId, setGemId] = useState('')
  const [category, setCategory] = useState(
    initialCategory ?? profile.categories[0] ?? GEM_CATEGORIES[0] ?? 'Transport & Vehicles'
  )
  const [deadlineStr, setDeadlineStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const canSave = canSaveTenders(profile, currentTenderCount)

  const handleSave = async () => {
    if (!canSave) { setUpgradeOpen(true); return }
    if (!name.trim()) return

    setSaving(true)
    setSaveError(null)
    try {
      const deadline = deadlineStr
        ? Timestamp.fromDate(new Date(deadlineStr))
        : null

      await saveTender(uid, {
        name: name.trim(),
        gemId: gemId.trim(),
        category,
        state: profile.state,
        deadline,
        status: 'active',
        aiSummary: aiSummary ?? null,
        gemUrl: gemId.trim()
          ? `https://bidplus.gem.gov.in/bidlists?bid_number=${gemId.trim()}`
          : null,
      })

      track('tender_saved', { category, state: profile.state, plan: profile.plan })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Tender save नहीं हुआ। फिर try करें।')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">{t('saveTenderTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="tender-name">{t('tenderName')}</Label>
              <Input
                id="tender-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. CRPF Vehicle Rental — Bihar"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gem-id">GeM ID (optional)</Label>
              <Input
                id="gem-id"
                value={gemId}
                onChange={e => setGemId(e.target.value)}
                placeholder="e.g. GEM/2026/B/1234567"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('category')}</Label>
                <Select value={category} onValueChange={(v) => { if (v) setCategory(v) }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEM_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('deadline')}</Label>
                <Input
                  type="date"
                  value={deadlineStr}
                  onChange={e => setDeadlineStr(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {!canSave && (
              <p className="text-sm text-danger">
                Free plan में 5 tenders save कर सकते हैं। Upgrade करें।
              </p>
            )}

            {saveError && (
              <p className="text-sm text-danger">{saveError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-navy text-white hover:bg-navy/90"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? 'Saving...' : t('saveTender')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="tender_limit"
      />
    </>
  )
}

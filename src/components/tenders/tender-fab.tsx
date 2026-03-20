'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SaveTenderDialog } from '@/components/finder/save-tender-dialog'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { canSaveTenders } from '@/lib/plan-guard'
import type { UserProfile } from '@/lib/types'

interface TenderFabProps {
  uid: string
  profile: UserProfile
  currentTenderCount: number
}

/** Floating action button fixed bottom-right. Mobile: above bottom nav (bottom-24). Desktop: bottom-6. */
export function TenderFab({ uid, profile, currentTenderCount }: TenderFabProps) {
  const [saveOpen, setSaveOpen]       = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const handleTap = () => {
    if (!canSaveTenders(profile, currentTenderCount)) { setUpgradeOpen(true); return }
    setSaveOpen(true)
  }

  return (
    <>
      <button
        onClick={handleTap}
        aria-label="Add tender"
        className="fixed bottom-24 right-4 desktop:bottom-6 desktop:right-6 z-50 w-14 h-14 bg-orange text-white rounded-full shadow-lg flex items-center justify-center hover:bg-orange/90 active:scale-95 transition-all"
      >
        <Plus size={24} />
      </button>

      <SaveTenderDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        uid={uid}
        profile={profile}
        currentTenderCount={currentTenderCount}
      />

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        trigger="tender_limit"
      />
    </>
  )
}

'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { UploadDocumentDialog } from './upload-document-dialog'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import { isPro } from '@/lib/plan-guard'
import type { UserProfile } from '@/lib/types'

interface VaultFabProps { uid: string; profile: UserProfile }

export function VaultFab({ uid, profile }: VaultFabProps) {
  const [uploadOpen,  setUploadOpen]  = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const handleTap = () => {
    if (!isPro(profile)) { setUpgradeOpen(true); return }
    setUploadOpen(true)
  }

  return (
    <>
      <button
        onClick={handleTap}
        aria-label="Upload document"
        className="fixed bottom-24 right-4 desktop:bottom-6 desktop:right-6 z-50 w-14 h-14 bg-navy text-white rounded-full shadow-lg flex items-center justify-center hover:bg-navy/90 active:scale-95 transition-all"
      >
        <Plus size={24} />
      </button>
      <UploadDocumentDialog open={uploadOpen} onClose={() => setUploadOpen(false)} uid={uid} />
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} trigger="feature_gate" />
    </>
  )
}

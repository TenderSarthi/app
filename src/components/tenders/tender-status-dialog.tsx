'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Trophy, XCircle, Archive, RefreshCw } from 'lucide-react'
import { updateTenderStatus } from '@/lib/firebase/firestore'
import type { Tender, TenderStatus } from '@/lib/types'

interface TenderStatusDialogProps {
  tender: Tender | null
  onClose: () => void
}

const OPTIONS: { value: TenderStatus; label: string; Icon: React.ElementType; cls: string }[] = [
  { value: 'active',  label: 'Mark Active',  Icon: RefreshCw, cls: 'text-navy'    },
  { value: 'won',     label: 'Mark Won',     Icon: Trophy,    cls: 'text-success'  },
  { value: 'lost',    label: 'Mark Lost',    Icon: XCircle,   cls: 'text-danger'   },
  { value: 'expired', label: 'Mark Expired', Icon: Archive,   cls: 'text-muted'    },
]

export function TenderStatusDialog({ tender, onClose }: TenderStatusDialogProps) {
  const t = useTranslations('tenders')
  const [busy, setBusy] = useState(false)

  const handleSelect = async (status: TenderStatus) => {
    if (!tender) return
    setBusy(true)
    try { await updateTenderStatus(tender.id, status) } catch { /* hook reconciles */ }
    finally { setBusy(false); onClose() }
  }

  return (
    <Sheet open={!!tender} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-navy text-left text-base">{tender?.name ?? ''}</SheetTitle>
          <p className="text-sm text-muted text-left">{t('updateStatus')}</p>
        </SheetHeader>
        <div className="space-y-2">
          {OPTIONS.filter(o => o.value !== tender?.status).map(({ value, label, Icon, cls }) => (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={busy}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-navy/10 hover:bg-navy/5 transition-colors ${cls}`}
            >
              <Icon size={18} />
              <span className="font-medium text-sm">{label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

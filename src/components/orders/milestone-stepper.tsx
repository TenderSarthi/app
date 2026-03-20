'use client'

import type { Order } from '@/lib/types'
import { getInvoiceDaysSince } from '@/lib/order-utils'
import { CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MilestoneStepperProps {
  order: Order
}

const MILESTONES = [
  { key: 'deliveryDate'   as const, label: 'Delivery',   statusBefore: 'delivery_pending'   as const },
  { key: 'inspectionDate' as const, label: 'Inspection', statusBefore: 'inspection_pending' as const },
  { key: 'invoiceDate'    as const, label: 'Invoice',    statusBefore: 'invoice_pending'    as const },
  { key: 'paymentDate'    as const, label: 'Payment',    statusBefore: 'payment_pending'    as const },
]

// TODO: i18n — replace hardcoded labels once orders namespace is added (Task 6)

export function MilestoneStepper({ order }: MilestoneStepperProps) {
  return (
    <div className="flex items-start gap-0 w-full mt-3">
      {MILESTONES.map((milestone, idx) => {
        const milestoneDate = order.milestones[milestone.key]
        const isDone    = milestoneDate !== null
        const isCurrent = !isDone && order.status === milestone.statusBefore

        const invoiceDays =
          milestone.key === 'invoiceDate' && isDone
            ? getInvoiceDaysSince(milestoneDate)
            : null

        const nextMilestoneDone =
          idx < MILESTONES.length - 1
            ? order.milestones[MILESTONES[idx + 1].key] !== null
            : false

        return (
          <div key={milestone.key} className="flex-1 flex flex-col items-center">
            {/* Connector row */}
            <div className="flex items-center w-full">
              {/* Left connector — green only if BOTH this step and previous step are done */}
              <div
                className={cn(
                  'flex-1 h-0.5',
                  idx === 0
                    ? 'invisible'
                    : isDone && order.milestones[MILESTONES[idx - 1].key] !== null
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                )}
              />

              {/* Step icon */}
              <div className="relative flex items-center justify-center">
                {isDone ? (
                  <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                ) : isCurrent ? (
                  <div className="relative">
                    <Clock size={20} className="text-orange-500 shrink-0" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 bg-white shrink-0" />
                )}
              </div>

              {/* Right connector */}
              <div
                className={cn(
                  'flex-1 h-0.5',
                  idx === MILESTONES.length - 1
                    ? 'invisible'
                    : isDone && nextMilestoneDone
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                )}
              />
            </div>

            {/* Label + date */}
            <div className="mt-1 flex flex-col items-center gap-0.5">
              <span
                className={cn(
                  'text-[10px] font-medium leading-none',
                  isDone
                    ? 'text-green-600'
                    : isCurrent
                    ? 'text-orange-500'
                    : 'text-gray-400'
                )}
              >
                {milestone.label}
              </span>

              {isDone && milestoneDate && (
                <span className="text-[9px] text-gray-400 leading-none">
                  {milestoneDate.toDate().toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}

              {invoiceDays !== null && invoiceDays >= 0 && (
                <span className="text-[9px] text-blue-500 leading-none font-medium">
                  {invoiceDays}d ago
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { useState, useMemo, useCallback } from 'react'
import { Lock, Plus } from 'lucide-react'
import { useFirebase } from '@/components/providers/firebase-provider'
import { useUserProfile } from '@/lib/hooks/use-user-profile'
import { useOrders } from '@/lib/hooks/use-orders'
import { useUserTenders } from '@/lib/hooks/use-user-tenders'
import { isPro } from '@/lib/plan-guard'
import { OrderCard } from '@/components/orders/order-card'
import { AddOrderDialog } from '@/components/orders/add-order-dialog'
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog'
import type { Order } from '@/lib/types'

// TODO: i18n — replace hardcoded strings once orders namespace is added (Task 6)

export default function OrdersPage() {
  const { user }    = useFirebase()
  const { profile } = useUserProfile()
  const { orders, loading, error } = useOrders(user?.uid ?? null)
  const { tenders }         = useUserTenders(user?.uid ?? null)

  const [dialogOpen,    setDialogOpen]    = useState(false)
  const [editOrder,     setEditOrder]     = useState<Order | null>(null)
  const [upgradeOpen,   setUpgradeOpen]   = useState(false)

  // Only active tenders can be linked to new orders
  const activeTenders = useMemo(
    () => tenders.filter((t) => t.status === 'active'),
    [tenders]
  )

  // Stable callbacks — defined before early returns so useCallback is unconditional
  const handleEdit = useCallback((order: Order) => {
    setEditOrder(order)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditOrder(null)
  }, [])

  // Loading skeleton — shown before profile/auth resolves
  if (!profile || !user) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-40 bg-navy/5 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-navy/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const userIsPro = isPro(profile)

  // Free users: Pro gate
  if (!userIsPro) {
    return (
      <div className="space-y-4 pb-6">
        <div>
          <h1 className="font-heading font-bold text-xl text-navy">Orders Tracker</h1>
          <p className="text-sm text-muted mt-0.5">Track work orders and milestone progress</p>
        </div>

        <div className="bg-orange/5 border border-orange/20 rounded-xl p-5 text-center space-y-3">
          <Lock className="mx-auto text-orange" size={28} />
          <p className="font-semibold text-navy text-sm">Orders Tracker is a Pro feature</p>
          <p className="text-sm text-muted">
            Upgrade to Pro to log work orders and track Delivery → Inspection → Invoice → Payment milestones.
          </p>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="mt-1 px-6 py-2.5 rounded-xl bg-orange text-white font-semibold text-sm"
          >
            Upgrade to Pro
          </button>
        </div>

        <UpgradeDialog
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          trigger="feature_gate"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-32 desktop:pb-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading font-bold text-xl text-navy">Orders Tracker</h1>
          <p className="text-sm text-muted mt-0.5">Track milestones for your won tenders</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditOrder(null); setDialogOpen(true) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy text-white text-sm font-semibold"
          aria-label="Add work order"
        >
          <Plus size={15} />
          Add Order
        </button>
      </div>

      {/* Order list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-navy/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="font-semibold text-danger">Could not load orders</p>
          <p className="text-sm text-muted mt-1 max-w-xs">
            Please check your connection and try again.
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-semibold text-navy">No work orders yet</p>
          <p className="text-sm text-muted mt-1 max-w-xs">
            Tap &ldquo;Add Order&rdquo; to log a won tender and start tracking milestones.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <AddOrderDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        tenders={activeTenders}
        editOrder={editOrder}
        uid={user.uid}
      />
    </div>
  )
}

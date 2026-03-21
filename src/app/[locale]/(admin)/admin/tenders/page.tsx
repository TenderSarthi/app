import { FileCheck, Clock } from 'lucide-react'

export default function AdminTendersPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading font-bold text-2xl text-navy">Community Tender Moderation</h1>
      <div className="bg-white border rounded-xl p-8 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 bg-lightbg rounded-full flex items-center justify-center">
          <FileCheck size={24} className="text-orange" />
        </div>
        <div>
          <h2 className="font-semibold text-navy">No submissions yet</h2>
          <p className="text-sm text-muted mt-1 max-w-sm">
            Community-submitted tenders will appear here once the vendor submission flow is built.
            Approved tenders will be broadcast to vendors with matching categories.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Clock size={12} />
          Planned for V1.1
        </div>
      </div>
    </div>
  )
}

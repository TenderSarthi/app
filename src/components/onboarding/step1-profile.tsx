'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props { name: string; businessName: string; onChange: (f: 'name' | 'businessName', v: string) => void }

export function Step1Profile({ name, businessName, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">आपका नाम *</Label>
        <Input id="name" placeholder="Full name" value={name} onChange={(e) => onChange('name', e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="biz">Business / Firm का नाम *</Label>
        <Input id="biz" placeholder="e.g. Sharma Enterprises" value={businessName} onChange={(e) => onChange('businessName', e.target.value)} className="h-11" />
      </div>
    </div>
  )
}

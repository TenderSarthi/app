'use client'
import { INDIAN_STATES } from '@/lib/constants'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props { value: string; onChange: (s: string) => void }

export function Step2State({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={(v) => { if (v !== null) onChange(v) }}>
      <SelectTrigger className="h-11 w-full"><SelectValue placeholder="अपना state चुनें" /></SelectTrigger>
      <SelectContent className="max-h-64">
        {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

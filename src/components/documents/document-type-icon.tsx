import { FileText, ShieldCheck, Car, Receipt, Award, CreditCard, Building, File } from 'lucide-react'
import type { DocumentType } from '@/lib/types'

type IconComponent = React.ComponentType<{ size?: number; className?: string }>

const TYPE_CONFIG: Record<DocumentType, { label: string; Icon: IconComponent; color: string }> = {
  rc:        { label: 'RC',        Icon: Car,         color: 'text-navy'    },
  gst:       { label: 'GST',       Icon: Receipt,     color: 'text-success' },
  insurance: { label: 'Insurance', Icon: ShieldCheck,  color: 'text-navy'   },
  itr:       { label: 'ITR',       Icon: FileText,    color: 'text-orange'  },
  msme:      { label: 'MSME',      Icon: Award,       color: 'text-gold'    },
  pan:       { label: 'PAN',       Icon: CreditCard,  color: 'text-navy'    },
  udyam:     { label: 'Udyam',     Icon: Building,    color: 'text-navy'    },
  other:     { label: 'Other',     Icon: File,        color: 'text-muted'   },
}

interface DocumentTypeIconProps {
  type: DocumentType
  size?: number
  showLabel?: boolean
}

export function DocumentTypeIcon({ type, size = 20, showLabel = false }: DocumentTypeIconProps) {
  const { Icon, color, label } = TYPE_CONFIG[type]
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={size} className={color} />
      {showLabel && <span className="text-sm font-medium text-navy">{label}</span>}
    </div>
  )
}

export function getDocTypeLabel(type: DocumentType): string {
  return TYPE_CONFIG[type].label
}

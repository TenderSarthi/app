import type { VaultDocument } from './types'

export function getRequiredDocTypes(categories: string[]): string[] {
  const required = new Set<string>(['gst', 'pan'])
  const REQS: Record<string, string[]> = {
    'Transport & Vehicles':          ['rc', 'insurance', 'gst', 'pan'],
    'IT & Electronics':              ['gst', 'pan', 'msme'],
    'Medical & Healthcare':          ['gst', 'pan', 'msme', 'udyam'],
    'Construction & Infrastructure': ['gst', 'pan', 'msme', 'itr'],
    'Stationery & Office Supplies':  ['gst', 'pan'],
    'Furniture & Fixtures':          ['gst', 'pan', 'msme'],
    'Uniforms & Clothing':           ['gst', 'pan', 'msme'],
    'Agriculture & Food':            ['gst', 'pan', 'msme'],
    'Security Services':             ['gst', 'pan', 'msme', 'itr'],
    'Printing & Publishing':         ['gst', 'pan', 'msme'],
    'Electrical & Lighting':         ['gst', 'pan', 'msme'],
    'Plumbing & Sanitation':         ['gst', 'pan', 'msme'],
    'Cleaning & Housekeeping':       ['gst', 'pan', 'msme'],
    'Other':                         ['gst', 'pan'],
  }
  for (const cat of categories) {
    for (const type of REQS[cat] ?? []) required.add(type)
  }
  return [...required]
}

export interface VaultProgress { uploaded: number; required: number; percent: number }

export function getVaultProgress(docs: VaultDocument[], categories: string[]): VaultProgress {
  if (categories.length === 0) return { uploaded: 0, required: 0, percent: 100 }
  const requiredTypes = getRequiredDocTypes(categories)
  const uploadedTypes = new Set(docs.map(d => d.type))
  const uploaded = requiredTypes.filter(t => uploadedTypes.has(t as any)).length
  const required = requiredTypes.length
  return { uploaded, required, percent: required === 0 ? 100 : Math.round((uploaded / required) * 100) }
}

export function isDocumentExpiringSoon(doc: VaultDocument): boolean {
  if (!doc.expiresAt) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expireDay = doc.expiresAt.toDate(); expireDay.setHours(0, 0, 0, 0)
  const daysLeft = Math.round((expireDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return daysLeft >= 0 && daysLeft <= 30
}

export function isDocumentExpired(doc: VaultDocument): boolean {
  if (!doc.expiresAt) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expireDay = doc.expiresAt.toDate(); expireDay.setHours(0, 0, 0, 0)
  return expireDay.getTime() < today.getTime()
}

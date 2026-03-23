export const BRAND_COLORS = {
  navy: '#1A3766',
  orange: '#F97316',
  gold: '#D97706',
  success: '#16A34A',
  danger: '#DC2626',
  gray: '#6B7280',
  lightbg: '#F0F4FB',
} as const

export const GEM_CATEGORIES = [
  'Transport & Vehicles', 'IT & Electronics', 'Medical & Healthcare',
  'Construction & Infrastructure', 'Stationery & Office Supplies',
  'Furniture & Fixtures', 'Uniforms & Clothing', 'Agriculture & Food',
  'Security Services', 'Printing & Publishing', 'Electrical & Lighting',
  'Plumbing & Sanitation', 'Cleaning & Housekeeping', 'Other',
] as const

export type GeMCategory = (typeof GEM_CATEGORIES)[number]

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const

export type IndianState = (typeof INDIAN_STATES)[number]

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',   nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi',     nativeLabel: 'हिंदी' },
  { code: 'bn', label: 'Bengali',   nativeLabel: 'বাংলা' },
  { code: 'mr', label: 'Marathi',   nativeLabel: 'मराठी' },
  { code: 'ta', label: 'Tamil',     nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu',    nativeLabel: 'తెలుగు' },
  { code: 'gu', label: 'Gujarati',  nativeLabel: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ' },
  { code: 'pa', label: 'Punjabi',   nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'Odia',      nativeLabel: 'ଓଡ଼ିଆ' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
] as const

export const LOCALE_CODES =['en', 'hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'pa', 'or', 'ml'] as const

// --- Document Vault constants ---

export const DOCUMENT_TYPES = ['rc', 'gst', 'insurance', 'itr', 'msme', 'pan', 'udyam', 'other'] as const

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  rc:        'RC (Registration Certificate)',
  gst:       'GST Certificate',
  insurance: 'Insurance',
  itr:       'ITR (Income Tax Return)',
  msme:      'MSME Certificate',
  pan:       'PAN Card',
  udyam:     'Udyam Certificate',
  other:     'Other',
}

// Minimum docs required per GeM category. Union of user's categories determines checklist.
export const CATEGORY_DOCUMENT_REQUIREMENTS: Record<string, string[]> = {
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

export const BASE_REQUIRED_DOCS = ['gst', 'pan'] as const

// Keywords used to extract categories from RSS feed text
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Transport & Vehicles':           ['vehicle', 'transport', 'car', 'bus', 'truck', 'hiring', 'fleet', 'ambulance', 'motor', 'tyre', 'automobile', 'logistics', 'cargo', 'two wheeler', 'four wheeler'],
  'IT & Electronics':               ['computer', 'laptop', 'software', 'it ', 'electronics', 'hardware', 'server', 'printer', 'scanner', 'tablet', 'network', 'firewall', 'ict', 'telecom', 'cabling', 'router', 'switch', 'ups', 'projector', 'camera', 'biometric', 'digital', 'data center'],
  'Medical & Healthcare':           ['medical', 'health', 'hospital', 'medicine', 'surgical', 'diagnostic', 'laboratory', 'lab', 'oxygen', 'ppe', 'pharmaceutical', 'drug', 'clinical', 'patient', 'equipment', 'reagent', 'ventilator', 'x-ray', 'mri', 'ultrasound'],
  'Construction & Infrastructure':  ['construction', 'civil', 'road', 'building', 'infrastructure', 'bridge', 'renovation', 'repair', 'maintenance', 'flooring', 'roofing', 'concrete', 'steel', 'structure', 'dam', 'canal', 'project', 'works', 'erection', 'fabrication'],
  'Stationery & Office Supplies':   ['stationery', 'paper', 'office supply', 'printing press', 'toner', 'pen', 'file', 'envelope', 'cartridge', 'binding', 'foam', 'notebook', 'register', 'stamp pad'],
  'Furniture & Fixtures':           ['furniture', 'chair', 'table', 'cabinet', 'workstation', 'sofa', 'almirah', 'shelf', 'rack', 'locker', 'partition', 'curtain', 'blind', 'mattress', 'cot', 'desk'],
  'Uniforms & Clothing':            ['uniform', 'clothing', 'garment', 'textile', 'fabric', 'apparel', 'shoes', 'boot', 'cap', 'jacket', 'trouser', 'shirt', 'saree', 'blanket', 'linen', 'bedsheet', 'towel'],
  'Agriculture & Food':             ['agriculture', 'food', 'grain', 'seed', 'fertilizer', 'ration', 'vegetable', 'fruit', 'cattle', 'dairy', 'poultry', 'fishery', 'crop', 'manure', 'irrigation', 'pump', 'tractor', 'canteen', 'catering', 'meal'],
  'Security Services':              ['security', 'guard', 'cctv', 'surveillance', 'watchman', 'access control', 'fire alarm', 'detection', 'patrol', 'manpower'],
  'Printing & Publishing':          ['printing', 'publication', 'book', 'diary', 'calendar', 'banner', 'flex', 'brochure', 'pamphlet', 'hoarding', 'signage', 'label', 'form'],
  'Electrical & Lighting':          ['electrical', 'lighting', 'led', 'wiring', 'transformer', 'panel', 'cable', 'mcb', 'inverter', 'solar', 'generator', 'dg set', 'battery', 'substation', 'meter'],
  'Plumbing & Sanitation':          ['plumbing', 'sanitation', 'pipe', 'drainage', 'water supply', 'tank', 'pump', 'valve', 'fitting', 'toilet', 'sewage', 'effluent', 'water treatment'],
  'Cleaning & Housekeeping':        ['cleaning', 'housekeeping', 'janitorial', 'sweeping', 'washing', 'laundry', 'pest control', 'disinfection', 'waste', 'garbage'],
  'Other':                          [],
}

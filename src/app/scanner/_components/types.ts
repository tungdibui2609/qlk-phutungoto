export interface BoxItem {
  id: string
  code: string
  box_index: string
  quantity: number
  unit: string
  sku: string
  product_name: string
  lot_code?: string | null
  spec: string
  shift_group: string
  region: string
  production_date: string
  packaging_date: string
  raw_material_date?: string
  supplier?: string
  supplier_name?: string
  scan_type: 'label' | 'stamp'
  stamp_line1?: string
  stamp_line2?: string
  is_special_12?: boolean
  special_12_code?: string
  special_12_name?: string
  created_at: string
}

export interface PalletItem {
  id: string
  stt: string
  lot_id: string | null
  lot_code: string | null
  boxes_count: number
  total_weight: number
  is_linked: boolean
  product_name: string | null
  sku: string | null
  product_aliases?: string | null
  aliases?: string | null
  location_code?: string | null
  production_place?: string | null
  material_zone?: string | null
  tag?: string | null
  packaging_date: string | null
  production_date: string | null
  scan_type: 'label' | 'stamp'
  is_special_12?: boolean
  notes?: string | null
  created_at: string
}

export interface ProductSuggestion {
  id: string
  name: string
  sku?: string
  aliases?: string | null
}

export type ScannerTab = 'label' | 'stamp' | 'warehouse_map' | 'pallets' | 'settings'

export interface PendingStampData {
  stamp_line1: string
  stamp_line2: string
  decoded?: any
}

export interface ManualLabelFormState {
  sku: string
  lot_code: string
  product_name: string
  box_index: string
  weight: string
  spec: string
  shift_group: string
  region: string
  production_date: string
  packaging_date: string
}

export interface ScannerUserProfile {
  fullName: string
  email: string
  companyCode: string
  companyName: string
  roleName: string
}

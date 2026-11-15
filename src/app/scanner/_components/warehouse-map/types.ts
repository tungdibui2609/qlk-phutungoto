export type DateFilterType = 'packaging_date' | 'peeling_date' | 'raw_material_date' | 'inbound_date'

export const DATE_FILTER_OPTIONS: { id: DateFilterType; label: string; shortLabel: string; icon: string }[] = [
  { id: 'packaging_date', label: 'Ngày đóng gói (DD/MM)', shortLabel: 'Đóng gói', icon: '📦' },
  { id: 'peeling_date', label: 'Ngày sản xuất (bóc múi)', shortLabel: 'Sản xuất', icon: '🔪' },
  { id: 'raw_material_date', label: 'Ngày nhập nguyên liệu', shortLabel: 'Nguyên liệu', icon: '🚛' },
  { id: 'inbound_date', label: 'Ngày nhập kho lạnh', shortLabel: 'Nhập kho', icon: '📥' }
]

export interface UniqueProductItem {
  name: string
  sku: string | null
  aliases: string | null
  unit: string
  positionCount: number
  totalQuantity: number
  normName: string
  unaccName: string
  normSku: string
  unaccSku: string
  aliasList: Array<{
    raw: string
    norm: string
    unacc: string
  }>
}

export interface ZoneItem {
  id: string
  name: string
  parent_id: string | null
  system_type: string
  code?: string
  display_order?: number | null
  is_hall?: boolean | null
}


export interface PositionItem {
  id: string
  code: string
  lot_id: string | null
  zone_ids: string[]
  // Joined lot data
  stt?: string | null
  lot_code?: string | null
  product_name?: string | null
  sku?: string | null
  aliases?: string | null
  unit?: string | null
  tags?: string[]
  packaging_date?: string | null
  peeling_date?: string | null
  raw_material_date?: string | null
  inbound_date?: string | null
  material_zones?: string[]
  material_zone?: string | null
  production_code?: string | null
  batch_code?: string | null
  production_place?: string | null
  extra_info?: string | null
  quantity?: number | null
}


export interface WebWarehouseMapCache {
  zones: ZoneItem[]
  positions: PositionItem[]
  cachedAt: string | null
  timestamp: number
}

export type DateFilterType = 'packaging_date' | 'peeling_date' | 'raw_material_date' | 'inbound_date'

export type WarehouseSearchMode = 'all' | 'name' | 'code' | 'tag' | 'stt'

export const WAREHOUSE_SEARCH_MODES: {
  id: WarehouseSearchMode
  label: string
  shortLabel: string
  placeholder: string
  subHint?: string
}[] = [
  {
    id: 'all',
    label: 'Tổng hợp',
    shortLabel: 'Tổng hợp',
    placeholder: 'Tìm nhanh (hỗ trợ tên viết tắt, mã, mã phụ, STT)...',
    subHint: 'Hỗ trợ tên viết tắt',
  },
  {
    id: 'name',
    label: 'Theo Tên',
    shortLabel: 'Theo Tên',
    placeholder: 'Nhập tên sản phẩm hoặc tên viết tắt (đô c, ri6...)...',
    subHint: 'Hỗ trợ tên viết tắt',
  },
  {
    id: 'code',
    label: 'Theo Mã',
    shortLabel: 'Theo Mã',
    placeholder: 'Nhập mã SP (SKU), mã LOT, mã vị trí...',
    subHint: 'SKU, mã LOT, vị trí',
  },
  {
    id: 'tag',
    label: 'Theo Mã phụ',
    shortLabel: 'Mã phụ',
    placeholder: 'Nhập mã phụ (tag) hoặc tên SP để hiện các tag liên quan...',
    subHint: 'Tag hoặc gõ tên SP',
  },
  {
    id: 'stt',
    label: 'Theo STT',
    shortLabel: 'Theo STT',
    placeholder: 'Nhập số thứ tự STT (VD: G44, 25)...',
    subHint: 'Số thứ tự LOT',
  },
]

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
  unitsMap: Map<string, number>
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

export interface UniqueSttItem {
  stt: string
  normStt: string
  positionCodes: string[]
  positionCount: number
  totalQuantity: number
  productName: string | null
  sku: string | null
  lotCode: string | null
}

export interface UniqueTagItem {
  tag: string
  normTag: string
  unaccTag: string
  positionCount: number
  totalQuantity: number
  unitsMap: Map<string, number>
  sampleProductName: string | null
  productNames?: string[]
  skus?: string[]
  aliasesList?: string[]
}

export interface AvailableUnitOption {
  unit: string
  count: number
  totalQty: number
}

export interface AvailableTagOption {
  tag: string
  count: number
  totalQty: number
  unitsMap: Map<string, number>
  productNames: string[]
}

export interface PositionProductSubItem {
  name: string
  sku: string | null
  aliases: string | null
  quantity: number
  unit: string
  rawUnit: string
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
  items?: {
    product_id?: string | null
    sku?: string | null
    product_name?: string | null
    quantity?: number | null
    unit?: string | null
  }[] | null
}

export interface WebWarehouseMapCache {
  zones: ZoneItem[]
  positions: PositionItem[]
  cachedAt: string | null
  timestamp: number
}

export interface HallOption {
  id: string
  name: string
  warehouse_id?: string | null
  warehouse_name?: string | null
  full_path?: string | null
}

export type ProposalActionType = 'CLEAR' | 'SET_QTY' | 'ASSIGN_LOT' | 'MOVE' | 'NOTE'

export interface ProposalSubItem {
  product_id?: string | null
  product_name: string
  sku?: string | null
  current_quantity: number
  new_quantity: number
  unit: string
  is_new?: boolean
}

export interface ProposalItem {
  id: string
  position_id: string
  position_code: string
  warehouse_name?: string
  action_type: ProposalActionType
  lot_id?: string | null
  lot_code?: string | null
  lot_stt?: string | null
  lot_found?: boolean
  product_name?: string | null
  sku?: string | null
  current_quantity?: number | null
  unit?: string | null
  sub_items?: ProposalSubItem[]
  new_quantity?: number | null
  target_position_id?: string | null
  target_position_code?: string | null
  note?: string | null
  voice_note_url?: string | null
  updated_at: string
}

export const DRAFT_VOICE_SESSION_ID = 'WAREHOUSE_DRAFT_VOICE'
export const DRAFT_VOICE_ROOT_FOLDER = 'WMS_GhiAm_GhiNhap'

export interface DraftProposal {
  title: string
  notes: string
  items: ProposalItem[]
  updated_at: string
}

export interface SubmittedProposal {
  id: string
  code?: string
  system_code?: string
  title: string
  notes: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL' | string
  total_positions: number
  items: ProposalItem[]
  created_by?: string | null
  created_by_name?: string | null
  approved_by_name?: string | null
  approved_at?: string | null
  review_notes?: string | null
  created_at: string
  isOfflinePending?: boolean
  source?: 'table' | 'shift_tasks' | 'local'
}

export interface LookedUpLot {
  id: string
  code: string
  stt: string | null
  product_name: string
  sku: string | null
  quantity: number
  unit: string
  items?: Array<{
    product_id?: string | null
    product_name: string
    sku?: string | null
    quantity: number
    unit: string
  }>
  current_position_id?: string | null
  current_position_code?: string | null
}

export interface ProductSuggestion {
  id: string
  sku: string
  name: string
  internal_code?: string | null
  internal_name?: string | null
  unit: string
  aliases: string[]
  available_units: string[]
}

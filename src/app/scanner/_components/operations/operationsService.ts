import { supabase } from '@/lib/supabaseClient'
import {
  addHiddenId,
  reconcileHiddenIds,
  submitScannerApprovalRequest,
} from './approvalService'

export interface DeliveryShift {
  id: string
  company_id?: string | null
  system_code: string
  status: 'open' | 'closed'
  opened_by?: string | null
  opened_by_name?: string | null
  opened_at?: string
  closed_by?: string | null
  closed_by_name?: string | null
  closed_at?: string | null
  notes?: string | null
  summary_data?: {
    job_name?: string
    job_notes?: string
    template_id?: string | null
    pinned_products?: ShiftProductItem[]
    order_type_id?: string | null
    order_type_name?: string | null
    order_type_code?: string | null
    products_summary?: Record<
      string,
      {
        product_name: string
        unit: string
        in_qty: number
        out_qty: number
        count: number
      }
    >
    units_summary?: Record<string, { in_qty: number; out_qty: number; count: number }>
    total_records?: number
    reconciliations?: ReconcileSession[]
    is_offline?: boolean
    [key: string]: any
  } | null
}

export interface DeliveryJobTemplate {
  id: string
  company_id?: string | null
  system_code: string
  name: string
  description?: string | null
  notes?: string | null
  pinned_product_ids?: string[] | null
  default_products?: ShiftProductItem[] | null
  is_active?: boolean
}

export interface OrderTypeOption {
  id: string
  code?: string | null
  name: string
  scope?: string | null
  is_active?: boolean
}

export interface ShiftProductItem {
  id: string
  name: string
  sku: string
  unit: string
  units: string[]
  defaultUnit?: string
  aliases?: string | null
  internal_code?: string | null
  internal_name?: string | null
}

export interface JournalRecord {
  id: string
  delivery_code?: string
  company_id?: string | null
  system_code?: string
  item_name: string
  quantity_sent: number
  unit: string
  from_department: string
  to_department: string
  status: string
  notes?: string | null
  sent_by?: string | null
  sent_by_name?: string | null
  sent_at?: string
  result_item_name?: string | null
  result_quantity?: number | null
  result_unit?: string | null
  direction: 'in' | 'out'
  is_offline?: boolean
}

export interface SubShiftRecord {
  id: string
  shift_id: string
  company_id?: string | null
  system_code: string
  sub_shift_number: number
  from_time: string
  to_time: string
  closed_by?: string | null
  closed_by_name?: string | null
  notes?: string | null
  summary_data?: {
    total_records?: number
    products_summary?: Record<
      string,
      {
        product_name: string
        unit: string
        in_qty: number
        out_qty: number
        count: number
      }
    >
    units_summary?: Record<string, { in_qty: number; out_qty: number; count: number }>
    journal_ids?: string[]
    reconciliations?: ReconcileSession[]
    [key: string]: any
  } | null
  created_at?: string
  is_offline?: boolean
}

export interface ReconcileBatchRow {
  id: string
  startSeq: string
  endSeq: string
  note?: string
}

export interface ReconcileSession {
  key: string
  product_name: string
  unit: string
  calcType: 'range' | 'count'
  mode: 'in' | 'out' | 'net'
  batches: ReconcileBatchRow[]
  countExisting?: string
  countStt?: string
  updated_at?: string
}

export interface AggregatedProductJobBreakdown {
  id: string
  name: string
  in_qty: number
  out_qty: number
  count: number
}

export interface AggregatedProductItem {
  product_name: string
  sku?: string
  aliases?: string
  internal_code?: string
  internal_name?: string
  unit: string
  in_qty: number
  out_qty: number
  count: number
  jobs: AggregatedProductJobBreakdown[]
}

export interface AggregatedUnitItem {
  unit: string
  in_qty: number
  out_qty: number
  count: number
}

const CACHE_KEYS = {
  OPEN_SHIFTS: 'solieu_cache_open_shifts',
  PAST_SHIFTS: 'solieu_cache_past_shifts',
  JOURNALS_PREFIX: 'solieu_cache_journals_',
  SUB_SHIFTS_PREFIX: 'solieu_cache_sub_shifts_',
  PRODUCTS: 'solieu_cache_products',
  JOB_TEMPLATES: 'solieu_cache_job_templates',
  ORDER_TYPES: 'solieu_cache_order_types',
  OFFLINE_QUEUE: 'solieu_offline_queue_v1',
  RECONCILE_PREFIX: 'op_reconcile_',
}

export function getActiveSystemCode(overrideCode?: string): string {
  if (overrideCode && overrideCode.trim()) {
    return overrideCode.replace(/__solieu$/, '')
  }
  try {
    const saved = localStorage.getItem('config_system_code')
    if (saved && saved.trim()) {
      return saved.replace(/__solieu$/, '')
    }
  } catch {}
  return 'KHO_DONG_LANH'
}

export function getShiftSystemCode(baseCode?: string): string {
  const clean = getActiveSystemCode(baseCode)
  return `${clean}__solieu`
}

function getStorageJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function setStorageJson(key: string, val: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch (e) {
    console.warn('localStorage write warning:', key, e)
  }
}

export function normalizeViText(str?: string | null): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s\-_/.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatUnitWeight(unitName: string, weightKg?: number | null): string {
  const cleanUnit = (unitName || 'Thùng').trim()
  const w = Number(weightKg)
  if (!w || isNaN(w) || w <= 0) return cleanUnit
  if (cleanUnit.toLowerCase() === 'kg' || cleanUnit.includes('(')) return cleanUnit
  const formattedW = Number.isInteger(w) ? String(w) : w.toFixed(1).replace(/\.0$/, '')
  return `${cleanUnit} (${formattedW}kg)`
}

export function pickDefaultProductUnit(units: string[], baseUnit?: string): string {
  if (!units || units.length === 0) return baseUnit || 'Thùng (20kg)'
  const box20 = units.find(u => u.toLowerCase().includes('thùng (20kg)') || u.toLowerCase().includes('thung (20kg)'))
  if (box20) return box20
  const anyBoxWithWeight = units.find(u => u.toLowerCase().startsWith('thùng (') || u.toLowerCase().startsWith('thung ('))
  if (anyBoxWithWeight) return anyBoxWithWeight
  const anyBox = units.find(u => u.toLowerCase().startsWith('thùng') || u.toLowerCase().startsWith('thung'))
  if (anyBox) return anyBox
  return units[0] || baseUnit || 'Thùng (20kg)'
}

export function parseDirectionFromRow(row: any): 'in' | 'out' {
  if (row?.direction === 'in' || row?.direction === 'out') return row.direction
  const st = String(row?.status || '').toLowerCase()
  const toDept = String(row?.to_department || '').toLowerCase()
  const notes = String(row?.notes || '')
  if (st === 'received_by_warehouse' || toDept === 'kho' || notes.includes('Nhập kho')) {
    return 'in'
  }
  return 'out'
}

export function extractCleanUserNote(rawNotes?: string | null): string {
  if (!rawNotes) return ''
  const cleaned = rawNotes
    .replace(/\[CV_ID:[^\]]+\]/g, '')
    .replace(/\[PID:[^\]]+\]/g, '')
    .replace(/\[SKU:[^\]]+\]/g, '')
    .replace(/\[CV:[^\]]+\]/g, '')
    .trim()
  const dashMatch = cleaned.match(/^(?:Nhập kho|Xuất kho)\s*(?:-\s*(.*))?$/i)
  if (dashMatch) {
    return (dashMatch[1] || '').trim()
  }
  return cleaned
}

export function extractSkuFromNotes(rawNotes?: string | null): string | null {
  if (!rawNotes) return null
  const m = rawNotes.match(/\[SKU:\s*([^\]]+)\]/i)
  return m ? m[1].trim() : null
}

// ── OFFLINE QUEUE ─────────────────────────────────────────────
interface OfflineAction {
  id: string
  type:
    | 'OPEN_SHIFT'
    | 'CLOSE_SHIFT'
    | 'CREATE_SUB_SHIFT'
    | 'CREATE_JOURNAL'
    | 'UPDATE_JOURNAL'
    | 'DELETE_JOURNAL'
    | 'UPDATE_PINNED_PRODUCTS'
    | 'SAVE_RECONCILE'
  payload: any
  createdAt: string
}

function getOfflineQueue(): OfflineAction[] {
  return getStorageJson<OfflineAction[]>(CACHE_KEYS.OFFLINE_QUEUE, [])
}

function saveOfflineQueue(queue: OfflineAction[]): void {
  setStorageJson(CACHE_KEYS.OFFLINE_QUEUE, queue)
}

function enqueueOfflineAction(type: OfflineAction['type'], payload: any): void {
  const q = getOfflineQueue()
  q.push({
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  })
  saveOfflineQueue(q)
}

export async function getOfflineQueueCount(): Promise<number> {
  return getOfflineQueue().length
}

function mergePinnedProducts(serverPinned: any, localPinned: any): any[] | undefined {
  const sArr = Array.isArray(serverPinned) ? serverPinned : []
  const lArr = Array.isArray(localPinned) ? localPinned : []
  if (!Array.isArray(serverPinned) && !Array.isArray(localPinned)) return undefined

  const seen = new Set<string>()
  const merged: any[] = []
  const getKey = (item: any) =>
    item?.id ? `id:${item.id}` : `sku:${item?.sku || ''}::name:${item?.name || ''}`

  for (const item of [...sArr, ...lArr]) {
    if (!item) continue
    const key = getKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

function mergeReconcileSessions(serverRecs: any, localRecs: any): any {
  if (!serverRecs && !localRecs) return undefined
  if (Array.isArray(serverRecs) || Array.isArray(localRecs)) {
    const sArr = Array.isArray(serverRecs) ? serverRecs : []
    const lArr = Array.isArray(localRecs) ? localRecs : []
    const map = new Map<string, any>()
    for (const item of [...sArr, ...lArr]) {
      if (!item) continue
      const key = String(item.key || item.id || Math.random())
      const prev = map.get(key)
      if (!prev) {
        map.set(key, item)
      } else {
        const prevTs = new Date(prev.updated_at || 0).getTime()
        const curTs = new Date(item.updated_at || 0).getTime()
        map.set(key, curTs >= prevTs ? item : prev)
      }
    }
    return Array.from(map.values())
  }
  if (typeof serverRecs === 'object' || typeof localRecs === 'object') {
    return { ...(serverRecs || {}), ...(localRecs || {}) }
  }
  return localRecs ?? serverRecs
}

async function fetchAndMergeShiftSummary(
  realShiftId: string,
  localSummary: any,
  recomputeTotals: boolean
): Promise<{ mergedSummary: Record<string, any>; serverStatus?: string }> {
  const { data: serverShift } = await (supabase.from('delivery_shifts') as any)
    .select('id, status, system_code, summary_data')
    .eq('id', realShiftId)
    .maybeSingle()

  const serverSummary = serverShift?.summary_data || {}
  const mergedPinned = mergePinnedProducts(serverSummary.pinned_products, localSummary?.pinned_products)
  const mergedRecs = mergeReconcileSessions(serverSummary.reconciliations, localSummary?.reconciliations)

  const mergedSummary: Record<string, any> = {
    ...serverSummary,
    ...(localSummary || {}),
  }
  if (mergedPinned !== undefined) mergedSummary.pinned_products = mergedPinned
  if (mergedRecs !== undefined) mergedSummary.reconciliations = mergedRecs

  if (recomputeTotals) {
    const shiftSys = serverShift?.system_code
    const baseSys = shiftSys?.endsWith('__solieu') ? shiftSys.slice(0, -8) : shiftSys
    let q = (supabase.from('delivery_journal') as any)
      .select('id, item_name, unit, quantity_sent, to_department')
      .ilike('notes', `%[CV_ID: ${realShiftId}]%`)
    if (shiftSys) {
      q =
        baseSys && baseSys !== shiftSys
          ? q.in('system_code', [shiftSys, baseSys])
          : q.eq('system_code', shiftSys)
    }
    const { data: journalRows, error: jErr } = await q
    if (!jErr && Array.isArray(journalRows)) {
      const mapped = journalRows.map((r: any) => ({
        ...r,
        direction: r.to_department === 'Kho' ? 'in' : 'out',
      })) as JournalRecord[]
      const { productsSummary, unitsSummary } = computeSummariesFromJournals(mapped)
      mergedSummary.products_summary = productsSummary
      mergedSummary.units_summary = unitsSummary
      mergedSummary.total_records = mapped.length
    }
  }

  return { mergedSummary, serverStatus: serverShift?.status }
}

export async function syncOperationsOfflineQueue(): Promise<{
  syncedCount: number
  remainingCount: number
}> {
  const queue = getOfflineQueue()
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 }

  const shiftIdMap: Record<string, string> = {}
  const remaining: OfflineAction[] = []
  let syncedCount = 0
  const touchedShiftIds = new Set<string>()
  const closedInSync = new Set<string>()

  for (const action of queue) {
    try {
      const p = action.payload || {}
      if (p.shiftId && shiftIdMap[p.shiftId]) {
        p.shiftId = shiftIdMap[p.shiftId]
      }

      if (action.type === 'OPEN_SHIFT') {
        const { tempId, insertData } = p
        const { data, error } = await (supabase.from('delivery_shifts') as any)
          .insert([insertData])
          .select('*')
          .single()
        if (error) throw error
        if (tempId && data?.id) {
          shiftIdMap[tempId] = data.id
        }
        syncedCount++
      } else if (action.type === 'CREATE_JOURNAL') {
        const { insertRow, shiftId } = p
        const realShiftId = shiftIdMap[shiftId] || shiftId
        const updatedNotes = String(insertRow.notes || '').replace(
          /\[CV_ID:\s*[^\]]+\]/,
          `[CV_ID: ${realShiftId}]`
        )
        const { error } = await (supabase.from('delivery_journal') as any).insert([
          { ...insertRow, notes: updatedNotes },
        ])
        if (error) throw error
        if (realShiftId) touchedShiftIds.add(String(realShiftId))
        syncedCount++
      } else if (action.type === 'UPDATE_JOURNAL') {
        const { journalId, updateFields, shiftId } = p
        if (!String(journalId).startsWith('local_')) {
          const { error } = await (supabase.from('delivery_journal') as any)
            .update(updateFields)
            .eq('id', journalId)
          if (error) throw error
        }
        const realShiftId = shiftId ? shiftIdMap[shiftId] || shiftId : null
        if (realShiftId) touchedShiftIds.add(String(realShiftId))
        syncedCount++
      } else if (action.type === 'DELETE_JOURNAL') {
        const { journalId, shiftId } = p
        if (!String(journalId).startsWith('local_')) {
          const { error } = await (supabase.from('delivery_journal') as any)
            .delete()
            .eq('id', journalId)
          if (error) throw error
        }
        const realShiftId = shiftId ? shiftIdMap[shiftId] || shiftId : null
        if (realShiftId) touchedShiftIds.add(String(realShiftId))
        syncedCount++
      } else if (action.type === 'CREATE_SUB_SHIFT') {
        const { insertData } = p
        const realShiftId = shiftIdMap[insertData.shift_id] || insertData.shift_id
        let nextSubNum = Number(insertData.sub_shift_number) || 1
        const { data: latestSub } = await (supabase.from('delivery_sub_shifts') as any)
          .select('sub_shift_number')
          .eq('shift_id', realShiftId)
          .order('sub_shift_number', { ascending: false })
          .limit(1)
        const maxExisting = Number(latestSub?.[0]?.sub_shift_number) || 0
        if (maxExisting >= nextSubNum) {
          nextSubNum = maxExisting + 1
        }
        const { error } = await (supabase.from('delivery_sub_shifts') as any).insert([
          { ...insertData, shift_id: realShiftId, sub_shift_number: nextSubNum },
        ])
        if (error) throw error
        syncedCount++
      } else if (action.type === 'CLOSE_SHIFT') {
        const { shiftId, updateData } = p
        const realShiftId = shiftIdMap[shiftId] || shiftId
        const { mergedSummary } = await fetchAndMergeShiftSummary(
          realShiftId,
          updateData?.summary_data,
          true
        )
        const { error } = await (supabase.from('delivery_shifts') as any)
          .update({ ...updateData, summary_data: mergedSummary })
          .eq('id', realShiftId)
        if (error) throw error
        closedInSync.add(String(realShiftId))
        syncedCount++
      } else if (action.type === 'UPDATE_PINNED_PRODUCTS' || action.type === 'SAVE_RECONCILE') {
        const { shiftId, summaryData } = p
        const realShiftId = shiftIdMap[shiftId] || shiftId
        if (!String(realShiftId).startsWith('local_')) {
          const { mergedSummary } = await fetchAndMergeShiftSummary(realShiftId, summaryData, false)
          const { error } = await (supabase.from('delivery_shifts') as any)
            .update({ summary_data: mergedSummary })
            .eq('id', realShiftId)
          if (error) throw error
        }
        syncedCount++
      }
    } catch (e) {
      console.warn('Sync offline action failed, keeping in queue:', action.type, e)
      remaining.push(action)
    }
  }

  for (const sId of Array.from(touchedShiftIds)) {
    if (closedInSync.has(sId) || sId.startsWith('local_')) continue
    try {
      const { mergedSummary, serverStatus } = await fetchAndMergeShiftSummary(sId, null, true)
      if (serverStatus === 'closed') {
        await (supabase.from('delivery_shifts') as any)
          .update({ summary_data: mergedSummary })
          .eq('id', sId)
      }
    } catch (e) {
      console.warn('Refresh closed shift summary after offline sync failed:', sId, e)
    }
  }

  saveOfflineQueue(remaining)
  return { syncedCount, remainingCount: remaining.length }
}

// ── SHIFTS CRUD ───────────────────────────────────────────────
export async function getOpenShifts(systemCode?: string): Promise<DeliveryShift[]> {
  const sys = getShiftSystemCode(systemCode)
  try {
    const { data, error } = await (supabase.from('delivery_shifts') as any)
      .select('*')
      .eq('system_code', sys)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })

    if (error) throw error
    const hidden = await reconcileHiddenIds('shifts', 'delivery_shifts')
    const remoteList = ((data || []) as DeliveryShift[]).filter(s => !hidden.has(s.id))

    const cached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.OPEN_SHIFTS, [])
    const localOnly = cached.filter(
      s =>
        !hidden.has(s.id) &&
        (s.id.startsWith('local_') || s.summary_data?.is_offline) &&
        !remoteList.some(r => r.id === s.id)
    )
    const merged = [...localOnly, ...remoteList]
    setStorageJson(CACHE_KEYS.OPEN_SHIFTS, merged)
    return merged
  } catch {
    const hidden = await reconcileHiddenIds('shifts', 'delivery_shifts')
    return getStorageJson<DeliveryShift[]>(CACHE_KEYS.OPEN_SHIFTS, []).filter(s => !hidden.has(s.id))
  }
}

export async function getPastShifts(limit = 50, systemCode?: string): Promise<DeliveryShift[]> {
  const sys = getShiftSystemCode(systemCode)
  try {
    const { data, error } = await (supabase.from('delivery_shifts') as any)
      .select('*')
      .eq('system_code', sys)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    const hidden = await reconcileHiddenIds('shifts', 'delivery_shifts')
    const list = ((data || []) as DeliveryShift[]).filter(s => !hidden.has(s.id))
    setStorageJson(CACHE_KEYS.PAST_SHIFTS, list)
    return list
  } catch {
    const hidden = await reconcileHiddenIds('shifts', 'delivery_shifts')
    return getStorageJson<DeliveryShift[]>(CACHE_KEYS.PAST_SHIFTS, []).filter(s => !hidden.has(s.id))
  }
}

export async function getJobTemplates(systemCode?: string): Promise<DeliveryJobTemplate[]> {
  const cleanSys = getActiveSystemCode(systemCode)
  try {
    const { data, error } = await (supabase.from('delivery_job_templates') as any)
      .select('*')
      .eq('system_code', cleanSys)
      .order('name', { ascending: true })

    if (error) throw error
    const list = (data || []) as DeliveryJobTemplate[]
    setStorageJson(CACHE_KEYS.JOB_TEMPLATES, list)
    return list
  } catch {
    return getStorageJson<DeliveryJobTemplate[]>(CACHE_KEYS.JOB_TEMPLATES, [])
  }
}

export async function getOrderTypesForSystem(systemCode?: string): Promise<OrderTypeOption[]> {
  const cleanSys = getActiveSystemCode(systemCode)
  try {
    const { data, error } = await (supabase.from('order_types') as any)
      .select('id, code, name, scope, is_active')
      .eq('system_code', cleanSys)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    let list = (data || []) as OrderTypeOption[]
    if (list.length === 0) {
      const { data: fallbackData } = await (supabase.from('order_types') as any)
        .select('id, code, name, scope, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(50)
      list = (fallbackData || []) as OrderTypeOption[]
    }
    setStorageJson(CACHE_KEYS.ORDER_TYPES, list)
    return list
  } catch {
    return getStorageJson<OrderTypeOption[]>(CACHE_KEYS.ORDER_TYPES, [])
  }
}

export async function getWarehouseProducts(systemCode?: string): Promise<ShiftProductItem[]> {
  const cleanSys = getActiveSystemCode(systemCode)
  try {
    const [prodRes, unitsRes, puRes] = await Promise.all([
      (supabase.from('products') as any)
        .select('id, name, sku, unit, weight_kg, aliases, internal_code, internal_name, system_type, system_code')
        .or(`system_type.eq.${cleanSys},system_code.eq.${cleanSys}`)
        .order('name', { ascending: true }),
      (supabase.from('units') as any).select('id, name, weight_kg'),
      (supabase.from('product_units') as any).select('product_id, unit_id, conversion_rate, weight_kg'),
    ])

    let rawProducts = prodRes.data || []
    if (rawProducts.length === 0) {
      const fallbackProd = await (supabase.from('products') as any)
        .select('id, name, sku, unit, weight_kg, aliases, internal_code, internal_name')
        .order('name', { ascending: true })
        .limit(800)
      rawProducts = fallbackProd.data || []
    }

    const unitsMap = new Map<string, { name: string; weight_kg?: number | null }>()
    ;(unitsRes.data || []).forEach((u: any) => {
      unitsMap.set(u.id, { name: u.name, weight_kg: u.weight_kg })
    })

    const prodUnitsMap = new Map<string, string[]>()
    ;(puRes.data || []).forEach((pu: any) => {
      const uInfo = unitsMap.get(pu.unit_id)
      if (!uInfo) return
      const weight = pu.weight_kg || uInfo.weight_kg || pu.conversion_rate
      const formatted = formatUnitWeight(uInfo.name, weight)
      const arr = prodUnitsMap.get(pu.product_id) || []
      if (!arr.includes(formatted)) arr.push(formatted)
      prodUnitsMap.set(pu.product_id, arr)
    })

    const list: ShiftProductItem[] = rawProducts.map((p: any) => {
      const baseUnit = formatUnitWeight(p.unit || 'Thùng', p.weight_kg || 20)
      const extraUnits = prodUnitsMap.get(p.id) || []
      const combined = Array.from(
        new Set([
          baseUnit,
          ...extraUnits,
          'Thùng (20kg)',
          'Thùng (18kg)',
          'Thùng (10kg)',
          'Kg',
          'Sọt',
          'Túi',
          'Khay',
        ].filter(Boolean))
      )
      const defUnit = pickDefaultProductUnit(combined, baseUnit)
      // Đưa defaultUnit lên đầu danh sách units
      const sortedUnits = [defUnit, ...combined.filter(u => u !== defUnit)]

      return {
        id: p.id,
        name: p.name || 'Sản phẩm',
        sku: p.sku || '',
        unit: defUnit,
        units: sortedUnits,
        defaultUnit: defUnit,
        aliases: p.aliases || null,
        internal_code: p.internal_code || null,
        internal_name: p.internal_name || null,
      }
    })

    if (list.length > 0) {
      setStorageJson(CACHE_KEYS.PRODUCTS, list)
    }
    return list
  } catch {
    return getStorageJson<ShiftProductItem[]>(CACHE_KEYS.PRODUCTS, [])
  }
}

export async function openDeliveryShift(params: {
  user: any
  jobName: string
  notes?: string
  templateId?: string | null
  initialProducts?: ShiftProductItem[]
  orderTypeId?: string | null
  orderTypeName?: string | null
  orderTypeCode?: string | null
  systemCode?: string
}): Promise<DeliveryShift> {
  const sys = getShiftSystemCode(params.systemCode)
  const now = new Date().toISOString()
  const summaryData = {
    job_name: params.jobName.trim(),
    job_notes: params.notes?.trim() || '',
    template_id: params.templateId || null,
    pinned_products: params.initialProducts || [],
    order_type_id: params.orderTypeId || null,
    order_type_name: params.orderTypeName || null,
    order_type_code: params.orderTypeCode || null,
  }

  const insertData = {
    system_code: sys,
    company_id: params.user?.company_id || null,
    status: 'open' as const,
    opened_by: params.user?.id || null,
    opened_by_name: params.user?.full_name || params.user?.email || 'Nhân viên',
    opened_at: now,
    notes: params.jobName.trim(),
    summary_data: summaryData,
  }

  try {
    const { data, error } = await (supabase.from('delivery_shifts') as any)
      .insert([insertData])
      .select('*')
      .single()

    if (error) throw error
    const created = data as DeliveryShift
    const cached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.OPEN_SHIFTS, [])
    setStorageJson(CACHE_KEYS.OPEN_SHIFTS, [created, ...cached.filter(s => s.id !== created.id)])
    return created
  } catch {
    const tempId = `local_shift_${Date.now()}`
    const offlineShift: DeliveryShift = {
      id: tempId,
      ...insertData,
      summary_data: { ...summaryData, is_offline: true },
    }
    enqueueOfflineAction('OPEN_SHIFT', { tempId, insertData })
    const cached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.OPEN_SHIFTS, [])
    setStorageJson(CACHE_KEYS.OPEN_SHIFTS, [offlineShift, ...cached])
    return offlineShift
  }
}

export async function updateShiftPinnedProducts(
  shiftId: string,
  pinnedProducts: ShiftProductItem[],
  currentSummaryData?: any
): Promise<void> {
  const nextSummary = {
    ...(currentSummaryData || {}),
    pinned_products: pinnedProducts,
  }

  const cached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.OPEN_SHIFTS, [])
  const updatedCache = cached.map(s => (s.id === shiftId ? { ...s, summary_data: nextSummary } : s))
  setStorageJson(CACHE_KEYS.OPEN_SHIFTS, updatedCache)

  if (shiftId.startsWith('local_')) {
    enqueueOfflineAction('UPDATE_PINNED_PRODUCTS', { shiftId, summaryData: nextSummary })
    return
  }

  try {
    const { error } = await (supabase.from('delivery_shifts') as any)
      .update({ summary_data: nextSummary })
      .eq('id', shiftId)
    if (error) throw error
  } catch {
    enqueueOfflineAction('UPDATE_PINNED_PRODUCTS', { shiftId, summaryData: nextSummary })
  }
}

function computeSummariesFromJournals(journals: JournalRecord[]) {
  const productsSummary: Record<
    string,
    { product_name: string; unit: string; in_qty: number; out_qty: number; count: number }
  > = {}
  const unitsSummary: Record<string, { in_qty: number; out_qty: number; count: number }> = {}

  for (const j of journals) {
    const pName = (j.item_name || 'Sản phẩm').trim()
    const uName = (j.unit || 'Thùng').trim()
    const key = `${pName}___${uName}`
    const qty = Number(j.quantity_sent) || 0

    if (!productsSummary[key]) {
      productsSummary[key] = { product_name: pName, unit: uName, in_qty: 0, out_qty: 0, count: 0 }
    }
    if (j.direction === 'in') {
      productsSummary[key].in_qty = Number((productsSummary[key].in_qty + qty).toFixed(2))
    } else {
      productsSummary[key].out_qty = Number((productsSummary[key].out_qty + qty).toFixed(2))
    }
    productsSummary[key].count += 1

    if (!unitsSummary[uName]) {
      unitsSummary[uName] = { in_qty: 0, out_qty: 0, count: 0 }
    }
    if (j.direction === 'in') {
      unitsSummary[uName].in_qty = Number((unitsSummary[uName].in_qty + qty).toFixed(2))
    } else {
      unitsSummary[uName].out_qty = Number((unitsSummary[uName].out_qty + qty).toFixed(2))
    }
    unitsSummary[uName].count += 1
  }

  return { productsSummary, unitsSummary }
}

export async function closeDeliveryShift(params: {
  shift: DeliveryShift
  user: any
  notes?: string
  journals: JournalRecord[]
  orderTypeId?: string | null
  orderTypeName?: string | null
  orderTypeCode?: string | null
}): Promise<void> {
  const { shift, user, notes, journals } = params
  const { productsSummary, unitsSummary } = computeSummariesFromJournals(journals)
  const reconciliations = await getShiftReconciliations(shift.id, shift)
  const now = new Date().toISOString()

  const nextSummary = {
    ...(shift.summary_data || {}),
    close_notes: notes?.trim() || '',
    order_type_id: params.orderTypeId ?? shift.summary_data?.order_type_id ?? null,
    order_type_name: params.orderTypeName ?? shift.summary_data?.order_type_name ?? null,
    order_type_code: params.orderTypeCode ?? shift.summary_data?.order_type_code ?? null,
    products_summary: productsSummary,
    units_summary: unitsSummary,
    total_records: journals.length,
    reconciliations,
  }

  const updateData = {
    status: 'closed' as const,
    closed_by: user?.id || null,
    closed_by_name: user?.full_name || user?.email || 'Nhân viên',
    closed_at: now,
    summary_data: nextSummary,
  }

  // Update caches
  const openCached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.OPEN_SHIFTS, [])
  setStorageJson(
    CACHE_KEYS.OPEN_SHIFTS,
    openCached.filter(s => s.id !== shift.id)
  )
  const pastCached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.PAST_SHIFTS, [])
  const closedShift: DeliveryShift = { ...shift, ...updateData }
  setStorageJson(CACHE_KEYS.PAST_SHIFTS, [closedShift, ...pastCached.filter(s => s.id !== shift.id)])

  if (shift.id.startsWith('local_')) {
    enqueueOfflineAction('CLOSE_SHIFT', { shiftId: shift.id, updateData })
    return
  }

  try {
    const { error } = await (supabase.from('delivery_shifts') as any)
      .update(updateData)
      .eq('id', shift.id)
    if (error) throw error
  } catch {
    enqueueOfflineAction('CLOSE_SHIFT', { shiftId: shift.id, updateData })
  }
}

export async function reopenDeliveryShift(shift: DeliveryShift): Promise<void> {
  const updateData = {
    status: 'open' as const,
    closed_at: null,
    closed_by: null,
    closed_by_name: null,
  }

  const { error } = await (supabase.from('delivery_shifts') as any)
    .update(updateData)
    .eq('id', shift.id)
  if (error) throw error

  const pastCached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.PAST_SHIFTS, [])
  setStorageJson(
    CACHE_KEYS.PAST_SHIFTS,
    pastCached.filter(s => s.id !== shift.id)
  )
  const openCached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.OPEN_SHIFTS, [])
  setStorageJson(CACHE_KEYS.OPEN_SHIFTS, [{ ...shift, ...updateData }, ...openCached])
}

export async function deleteDeliveryShift(
  shiftId: string,
  meta?: {
    shiftName?: string
    systemCode?: string
    companyId?: string | null
    user?: any
  }
): Promise<void> {
  if (!String(shiftId).startsWith('local_')) {
    const { data: serverShift } = await (supabase.from('delivery_shifts') as any)
      .select('id, system_code, company_id, notes, summary_data, status, opened_at')
      .eq('id', shiftId)
      .maybeSingle()

    const sysCode = meta?.systemCode || serverShift?.system_code || getShiftSystemCode()
    const shiftName =
      meta?.shiftName || serverShift?.summary_data?.job_name || serverShift?.notes || 'Công việc'

    await submitScannerApprovalRequest({
      systemCode: sysCode,
      companyId: meta?.companyId ?? serverShift?.company_id ?? null,
      actionType: 'delete_shift',
      targetTable: 'delivery_shifts',
      targetId: shiftId,
      shiftId,
      shiftName,
      targetLabel: shiftName,
      beforeData: serverShift || { id: shiftId, job_name: shiftName },
      requestedBy: meta?.user?.id || null,
      requestedByName: meta?.user?.full_name || meta?.user?.email || 'Nhân viên Scanner',
      sourceDevice: 'scanner',
    })
    addHiddenId('shifts', shiftId)
  } else {
    const queue = getOfflineQueue()
    const cleaned = queue.filter(q => {
      const p = q.payload || {}
      return (
        p.tempId !== shiftId &&
        p.shiftId !== shiftId &&
        p.insertData?.shift_id !== shiftId
      )
    })
    saveOfflineQueue(cleaned)
  }

  const openCached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.OPEN_SHIFTS, [])
  setStorageJson(
    CACHE_KEYS.OPEN_SHIFTS,
    openCached.filter(s => s.id !== shiftId)
  )
  const pastCached = getStorageJson<DeliveryShift[]>(CACHE_KEYS.PAST_SHIFTS, [])
  setStorageJson(
    CACHE_KEYS.PAST_SHIFTS,
    pastCached.filter(s => s.id !== shiftId)
  )
}

// ── SUB-SHIFTS (CHỐT CA TẠM) ──────────────────────────────────
export async function getSubShifts(shiftId: string): Promise<SubShiftRecord[]> {
  const cacheKey = `${CACHE_KEYS.SUB_SHIFTS_PREFIX}${shiftId}`
  if (shiftId.startsWith('local_')) {
    return getStorageJson<SubShiftRecord[]>(cacheKey, [])
  }
  try {
    const { data, error } = await (supabase.from('delivery_sub_shifts') as any)
      .select('*')
      .eq('shift_id', shiftId)
      .order('sub_shift_number', { ascending: true })
    if (error) throw error
    const list = (data || []) as SubShiftRecord[]
    setStorageJson(cacheKey, list)
    return list
  } catch {
    return getStorageJson<SubShiftRecord[]>(cacheKey, [])
  }
}

export async function createSubShift(params: {
  shift: DeliveryShift
  user: any
  notes?: string
  currentJournals: JournalRecord[]
  existingSubShiftsCount: number
  fromTime: string
}): Promise<SubShiftRecord> {
  const { shift, user, notes, currentJournals, existingSubShiftsCount, fromTime } = params
  const now = new Date().toISOString()
  const { productsSummary, unitsSummary } = computeSummariesFromJournals(currentJournals)
  const reconciliations = await getShiftReconciliations(shift.id, shift)

  const insertData = {
    shift_id: shift.id,
    system_code: shift.system_code,
    company_id: shift.company_id || user?.company_id || null,
    sub_shift_number: existingSubShiftsCount + 1,
    from_time: fromTime,
    to_time: now,
    closed_by: user?.id || null,
    closed_by_name: user?.full_name || user?.email || 'Nhân viên',
    notes: notes?.trim() || null,
    summary_data: {
      total_records: currentJournals.length,
      products_summary: productsSummary,
      units_summary: unitsSummary,
      journal_ids: currentJournals.map(j => j.id),
      reconciliations,
    },
  }

  const cacheKey = `${CACHE_KEYS.SUB_SHIFTS_PREFIX}${shift.id}`
  const existing = getStorageJson<SubShiftRecord[]>(cacheKey, [])

  if (shift.id.startsWith('local_')) {
    const localRec: SubShiftRecord = {
      id: `local_sub_${Date.now()}`,
      ...insertData,
      created_at: now,
      is_offline: true,
    }
    setStorageJson(cacheKey, [...existing, localRec])
    enqueueOfflineAction('CREATE_SUB_SHIFT', { insertData })
    return localRec
  }

  try {
    const { data, error } = await (supabase.from('delivery_sub_shifts') as any)
      .insert([insertData])
      .select('*')
      .single()
    if (error) throw error
    const rec = data as SubShiftRecord
    setStorageJson(cacheKey, [...existing, rec])
    return rec
  } catch {
    const localRec: SubShiftRecord = {
      id: `local_sub_${Date.now()}`,
      ...insertData,
      created_at: now,
      is_offline: true,
    }
    setStorageJson(cacheKey, [...existing, localRec])
    enqueueOfflineAction('CREATE_SUB_SHIFT', { insertData })
    return localRec
  }
}

// ── JOURNALS CRUD ─────────────────────────────────────────────
export async function getShiftJournals(
  shift: DeliveryShift,
  systemCode?: string
): Promise<JournalRecord[]> {
  const cacheKey = `${CACHE_KEYS.JOURNALS_PREFIX}${shift.id}`
  const baseSys = getActiveSystemCode(systemCode || shift.system_code)
  const shiftSys = getShiftSystemCode(baseSys)

  if (shift.id.startsWith('local_')) {
    return getStorageJson<JournalRecord[]>(cacheKey, [])
  }

  try {
    let { data, error } = await (supabase.from('delivery_journal') as any)
      .select('*')
      .or(`system_code.eq.${shiftSys},system_code.eq.${baseSys}`)
      .ilike('notes', `%[CV_ID: ${shift.id}]%`)
      .order('sent_at', { ascending: false })

    if (error) throw error

    // Fallback cho ca tạo từ Web /so-lieu cũ chưa gắn tag [CV_ID: ...]
    if ((!data || data.length === 0) && shift.opened_at) {
      let fbQuery = (supabase.from('delivery_journal') as any)
        .select('*')
        .or(`system_code.eq.${shiftSys},system_code.eq.${baseSys}`)
        .gte('sent_at', shift.opened_at)
        .order('sent_at', { ascending: false })
      if (shift.closed_at) {
        fbQuery = fbQuery.lte('sent_at', shift.closed_at)
      }
      const fbRes = await fbQuery
      if (!fbRes.error && Array.isArray(fbRes.data)) {
        data = fbRes.data.filter((r: any) => {
          const m = String(r.notes || '').match(/\[CV_ID:\s*([^\]]+)\]/)
          return !m || m[1].trim() === shift.id
        })
      }
    }
    const hidden = await reconcileHiddenIds('journals', 'delivery_journal')
    const remoteRows: JournalRecord[] = (data || [])
      .filter((r: any) => !hidden.has(r.id))
      .map((r: any) => ({
        ...r,
        direction: parseDirectionFromRow(r),
      }))

    const cached = getStorageJson<JournalRecord[]>(cacheKey, [])
    const localOnly = cached.filter(
      j => !hidden.has(j.id) && (j.id.startsWith('local_') || j.is_offline) && !remoteRows.some(r => r.id === j.id)
    )
    const merged = [...localOnly, ...remoteRows]
    setStorageJson(cacheKey, merged)
    return merged
  } catch {
    const hidden = await reconcileHiddenIds('journals', 'delivery_journal')
    return getStorageJson<JournalRecord[]>(cacheKey, []).filter(j => !hidden.has(j.id))
  }
}

export async function getMultiShiftsJournals(
  shifts: DeliveryShift[],
  systemCode?: string
): Promise<JournalRecord[]> {
  if (!shifts || shifts.length === 0) return []
  const cleanSys = getActiveSystemCode(systemCode || shifts[0]?.system_code)

  // Tìm khoảng thời gian min opened_at -> max closed_at để truy vấn nhanh
  const shiftIds = new Set(shifts.map(s => s.id))
  try {
    const openedTimes = shifts
      .map(s => (s.opened_at ? new Date(s.opened_at).getTime() : 0))
      .filter(Boolean)
    const minOpened =
      openedTimes.length > 0
        ? new Date(Math.min(...openedTimes) - 3600 * 1000).toISOString()
        : undefined

    let query = (supabase.from('delivery_journal') as any)
      .select('*')
      .eq('system_code', cleanSys)
      .order('sent_at', { ascending: false })
      .limit(2000)

    if (minOpened) {
      query = query.gte('sent_at', minOpened)
    }

    const { data, error } = await query
    if (error) throw error

    const hidden = await reconcileHiddenIds('journals', 'delivery_journal')
    const matched: JournalRecord[] = []
    for (const r of data || []) {
      if (hidden.has(r.id)) continue
      const m = String(r.notes || '').match(/\[CV_ID:\s*([^\]]+)\]/i)
      const cvId = m ? m[1].trim() : null
      if (cvId && shiftIds.has(cvId)) {
        matched.push({
          ...r,
          direction: parseDirectionFromRow(r),
        })
      }
    }
    return matched
  } catch {
    const fallback: JournalRecord[] = []
    for (const s of shifts) {
      const list = getStorageJson<JournalRecord[]>(`${CACHE_KEYS.JOURNALS_PREFIX}${s.id}`, [])
      fallback.push(...list)
    }
    return fallback
  }
}

export async function createShiftJournalEntry(params: {
  shift: DeliveryShift
  user: any
  productId?: string
  productSku?: string
  itemName: string
  quantity: number
  unit: string
  direction: 'in' | 'out'
  notes?: string
  systemCode?: string
}): Promise<JournalRecord> {
  const { shift, user, productId, productSku, itemName, quantity, unit, direction, notes } = params
  const cleanSys = getActiveSystemCode(params.systemCode || shift.system_code)
  const now = new Date().toISOString()
  const jobName = shift.summary_data?.job_name || shift.notes || 'Công việc'
  const dirLabel = direction === 'in' ? 'Nhập kho' : 'Xuất kho'
  const userNotePart = notes?.trim() ? ` - ${notes.trim()}` : ''
  const fullNotes = `[CV_ID: ${shift.id}]${productId ? ` [PID: ${productId}]` : ''}${productSku ? ` [SKU: ${productSku}]` : ''} [CV: ${jobName}] ${dirLabel}${userNotePart}`

  const deliveryCode = `GN-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`
  const insertRow = {
    delivery_code: deliveryCode,
    company_id: shift.company_id || user?.company_id || null,
    system_code: cleanSys,
    item_name: itemName.trim(),
    quantity_sent: Number(quantity),
    unit: unit.trim(),
    from_department: direction === 'in' ? 'Sản xuất' : 'Kho',
    to_department: direction === 'in' ? 'Kho' : 'Sản xuất',
    status: direction === 'in' ? 'received_by_warehouse' : 'received_by_production',
    notes: fullNotes,
    sent_by: user?.id || null,
    sent_by_name: user?.full_name || user?.email || 'Nhân viên',
    sent_at: now,
    result_item_name: itemName.trim(),
    result_quantity: Number(quantity),
    result_unit: unit.trim(),
  }

  const cacheKey = `${CACHE_KEYS.JOURNALS_PREFIX}${shift.id}`
  const existing = getStorageJson<JournalRecord[]>(cacheKey, [])

  if (shift.id.startsWith('local_')) {
    const localRec: JournalRecord = {
      id: `local_j_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...insertRow,
      direction,
      is_offline: true,
    }
    setStorageJson(cacheKey, [localRec, ...existing])
    enqueueOfflineAction('CREATE_JOURNAL', { shiftId: shift.id, insertRow })
    return localRec
  }

  try {
    const { data, error } = await (supabase.from('delivery_journal') as any)
      .insert([insertRow])
      .select('*')
      .single()
    if (error) throw error
    const created: JournalRecord = { ...data, direction }
    setStorageJson(cacheKey, [created, ...existing.filter(x => x.id !== created.id)])
    return created
  } catch {
    const localRec: JournalRecord = {
      id: `local_j_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...insertRow,
      direction,
      is_offline: true,
    }
    setStorageJson(cacheKey, [localRec, ...existing])
    enqueueOfflineAction('CREATE_JOURNAL', { shiftId: shift.id, insertRow })
    return localRec
  }
}

export async function updateShiftJournalEntry(params: {
  journalId: string
  quantity: number
  unit: string
  direction: 'in' | 'out'
  userNote?: string
  existingNotes?: string | null
  shiftId?: string | null
  shiftName?: string | null
  systemCode?: string
  companyId?: string | null
  beforeData?: any
  user?: any
}): Promise<void> {
  const { journalId, quantity, unit, direction, userNote, existingNotes } = params
  // Preserve tags [CV_ID:...] [PID:...] [SKU:...] [CV:...]
  const tags: string[] = []
  const raw = existingNotes || ''
  const matches = raw.match(/\[(?:CV_ID|PID|SKU|CV):[^\]]+\]/g)
  if (matches) tags.push(...matches)

  const dirLabel = direction === 'in' ? 'Nhập kho' : 'Xuất kho'
  const cleanNote = userNote?.trim() ? ` - ${userNote.trim()}` : ''
  const updatedNotes = `${tags.join(' ')} ${dirLabel}${cleanNote}`.trim()

  const updateFields = {
    quantity_sent: Number(quantity),
    result_quantity: Number(quantity),
    unit: unit.trim(),
    result_unit: unit.trim(),
    from_department: direction === 'in' ? 'Sản xuất' : 'Kho',
    to_department: direction === 'in' ? 'Kho' : 'Sản xuất',
    status: direction === 'in' ? 'received_by_warehouse' : 'received_by_production',
    notes: updatedNotes,
  }

  if (journalId.startsWith('local_')) {
    enqueueOfflineAction('UPDATE_JOURNAL', { journalId, updateFields })
    return
  }

  const sysCode = params.systemCode || getActiveSystemCode()
  await submitScannerApprovalRequest({
    systemCode: sysCode,
    companyId: params.companyId ?? null,
    actionType: 'update_journal',
    targetTable: 'delivery_journal',
    targetId: journalId,
    shiftId: params.shiftId || null,
    shiftName: params.shiftName || null,
    targetLabel: params.beforeData?.item_name || 'Dòng số liệu',
    beforeData: params.beforeData || null,
    afterData: updateFields,
    requestedBy: params.user?.id || null,
    requestedByName: params.user?.full_name || params.user?.email || 'Nhân viên Scanner',
    sourceDevice: 'scanner',
  })
}

export async function deleteShiftJournalEntry(
  journalId: string,
  meta?: {
    shiftId?: string | null
    shiftName?: string | null
    systemCode?: string
    companyId?: string | null
    beforeData?: any
    user?: any
  }
): Promise<void> {
  if (journalId.startsWith('local_')) {
    enqueueOfflineAction('DELETE_JOURNAL', { journalId })
    return
  }

  const sysCode = meta?.systemCode || getActiveSystemCode()
  await submitScannerApprovalRequest({
    systemCode: sysCode,
    companyId: meta?.companyId ?? null,
    actionType: 'delete_journal',
    targetTable: 'delivery_journal',
    targetId: journalId,
    shiftId: meta?.shiftId || null,
    shiftName: meta?.shiftName || null,
    targetLabel: meta?.beforeData?.item_name || 'Dòng số liệu',
    beforeData: meta?.beforeData || null,
    requestedBy: meta?.user?.id || null,
    requestedByName: meta?.user?.full_name || meta?.user?.email || 'Nhân viên Scanner',
    sourceDevice: 'scanner',
  })
  addHiddenId('journals', journalId)
}

// ── RECONCILIATIONS (THAM CHIẾU SỐ ĐẦU - SỐ ĐUÔI / ĐẾM TỒN) ──
export async function getShiftReconciliations(
  shiftId: string,
  shiftObj?: DeliveryShift | null
): Promise<ReconcileSession[]> {
  const localKey = `${CACHE_KEYS.RECONCILE_PREFIX}${shiftId}`
  const localData = getStorageJson<ReconcileSession[] | null>(localKey, null)
  if (localData && Array.isArray(localData) && localData.length > 0) {
    return localData
  }
  const fromSummary = shiftObj?.summary_data?.reconciliations
  if (Array.isArray(fromSummary) && fromSummary.length > 0) {
    setStorageJson(localKey, fromSummary)
    return fromSummary
  }
  return []
}

export async function saveShiftReconciliations(
  shiftId: string,
  sessions: ReconcileSession[],
  currentSummaryData?: any
): Promise<void> {
  const localKey = `${CACHE_KEYS.RECONCILE_PREFIX}${shiftId}`
  setStorageJson(localKey, sessions)

  const nextSummary = {
    ...(currentSummaryData || {}),
    reconciliations: sessions,
  }

  if (shiftId.startsWith('local_')) {
    enqueueOfflineAction('SAVE_RECONCILE', { shiftId, summaryData: nextSummary })
    return
  }

  try {
    await (supabase.from('delivery_shifts') as any)
      .update({ summary_data: nextSummary })
      .eq('id', shiftId)
  } catch {
    enqueueOfflineAction('SAVE_RECONCILE', { shiftId, summaryData: nextSummary })
  }
}

export async function clearShiftReconciliations(
  shiftId: string,
  currentSummaryData?: any
): Promise<void> {
  await saveShiftReconciliations(shiftId, [], currentSummaryData)
}

// ── AGGREGATION HELPERS (CHO BÁO CÁO NGÀY / SP / TÙY CHỌN) ───
export function aggregateShiftsProducts(
  shifts: DeliveryShift[],
  journals: JournalRecord[],
  allProducts?: ShiftProductItem[]
): AggregatedProductItem[] {
  const shiftMap = new Map<string, DeliveryShift>()
  shifts.forEach(s => shiftMap.set(s.id, s))

  const prodMetaByName = new Map<string, ShiftProductItem>()
  const prodMetaBySku = new Map<string, ShiftProductItem>()
  ;(allProducts || []).forEach(p => {
    if (p.name) prodMetaByName.set(normalizeViText(p.name), p)
    if (p.sku) prodMetaBySku.set(normalizeViText(p.sku), p)
  })

  const map = new Map<
    string,
    {
      product_name: string
      sku?: string
      aliases?: string
      internal_code?: string
      internal_name?: string
      unit: string
      in_qty: number
      out_qty: number
      count: number
      jobsMap: Map<string, AggregatedProductJobBreakdown>
    }
  >()

  const shiftsWithJournals = new Set<string>()

  for (const j of journals) {
    const m = String(j.notes || '').match(/\[CV_ID:\s*([^\]]+)\]/i)
    const cvId = m ? m[1].trim() : 'unknown'
    if (cvId !== 'unknown' && !shiftMap.has(cvId)) continue
    shiftsWithJournals.add(cvId)

    const shiftObj = shiftMap.get(cvId)
    const jobName = shiftObj?.summary_data?.job_name || shiftObj?.notes || 'Công việc'
    const pName = (j.item_name || 'Sản phẩm').trim()
    const uName = (j.unit || 'Thùng').trim()
    const key = `${pName}___${uName}`
    const qty = Number(j.quantity_sent) || 0

    const skuFromNote = extractSkuFromNotes(j.notes)
    const meta =
      (skuFromNote ? prodMetaBySku.get(normalizeViText(skuFromNote)) : undefined) ||
      prodMetaByName.get(normalizeViText(pName))

    let entry = map.get(key)
    if (!entry) {
      entry = {
        product_name: pName,
        sku: skuFromNote || meta?.sku || undefined,
        aliases: meta?.aliases || undefined,
        internal_code: meta?.internal_code || undefined,
        internal_name: meta?.internal_name || undefined,
        unit: uName,
        in_qty: 0,
        out_qty: 0,
        count: 0,
        jobsMap: new Map(),
      }
      map.set(key, entry)
    }

    if (j.direction === 'in') {
      entry.in_qty = Number((entry.in_qty + qty).toFixed(2))
    } else {
      entry.out_qty = Number((entry.out_qty + qty).toFixed(2))
    }
    entry.count += 1

    let jobEntry = entry.jobsMap.get(cvId)
    if (!jobEntry) {
      jobEntry = { id: cvId, name: jobName, in_qty: 0, out_qty: 0, count: 0 }
      entry.jobsMap.set(cvId, jobEntry)
    }
    if (j.direction === 'in') {
      jobEntry.in_qty = Number((jobEntry.in_qty + qty).toFixed(2))
    } else {
      jobEntry.out_qty = Number((jobEntry.out_qty + qty).toFixed(2))
    }
    jobEntry.count += 1
  }

  // Fallback từ summary_data.products_summary nếu ca không có dòng journal chi tiết trả về
  for (const s of shifts) {
    if (shiftsWithJournals.has(s.id)) continue
    const ps = s.summary_data?.products_summary
    if (!ps) continue
    const jobName = s.summary_data?.job_name || s.notes || 'Công việc'

    for (const item of Object.values(ps)) {
      const pName = (item.product_name || 'Sản phẩm').trim()
      const uName = (item.unit || 'Thùng').trim()
      const key = `${pName}___${uName}`
      const meta = prodMetaByName.get(normalizeViText(pName))

      let entry = map.get(key)
      if (!entry) {
        entry = {
          product_name: pName,
          sku: meta?.sku || undefined,
          aliases: meta?.aliases || undefined,
          internal_code: meta?.internal_code || undefined,
          internal_name: meta?.internal_name || undefined,
          unit: uName,
          in_qty: 0,
          out_qty: 0,
          count: 0,
          jobsMap: new Map(),
        }
        map.set(key, entry)
      }

      const inQ = Number(item.in_qty) || 0
      const outQ = Number(item.out_qty) || 0
      const cnt = Number(item.count) || 1
      entry.in_qty = Number((entry.in_qty + inQ).toFixed(2))
      entry.out_qty = Number((entry.out_qty + outQ).toFixed(2))
      entry.count += cnt

      entry.jobsMap.set(s.id, {
        id: s.id,
        name: jobName,
        in_qty: inQ,
        out_qty: outQ,
        count: cnt,
      })
    }
  }

  return Array.from(map.values())
    .map(e => ({
      product_name: e.product_name,
      sku: e.sku,
      aliases: e.aliases,
      internal_code: e.internal_code,
      internal_name: e.internal_name,
      unit: e.unit,
      in_qty: e.in_qty,
      out_qty: e.out_qty,
      count: e.count,
      jobs: Array.from(e.jobsMap.values()),
    }))
    .sort((a, b) => a.product_name.localeCompare(b.product_name, 'vi'))
}

export function aggregateShiftsUnits(prodRows: AggregatedProductItem[]): AggregatedUnitItem[] {
  const uMap = new Map<string, AggregatedUnitItem>()
  for (const r of prodRows) {
    const u = r.unit || 'Thùng'
    let cur = uMap.get(u)
    if (!cur) {
      cur = { unit: u, in_qty: 0, out_qty: 0, count: 0 }
      uMap.set(u, cur)
    }
    cur.in_qty = Number((cur.in_qty + r.in_qty).toFixed(2))
    cur.out_qty = Number((cur.out_qty + r.out_qty).toFixed(2))
    cur.count += r.count
  }
  return Array.from(uMap.values())
}

export async function syncOperationsDataOffline(systemCode?: string): Promise<{
  success: boolean
  message: string
}> {
  try {
    const syncRes = await syncOperationsOfflineQueue()
    const [openList, pastList, prods, tpls, orderTypes] = await Promise.all([
      getOpenShifts(systemCode),
      getPastShifts(50, systemCode),
      getWarehouseProducts(systemCode),
      getJobTemplates(systemCode),
      getOrderTypesForSystem(systemCode),
    ])

    // Tải trước journals & subShifts của tất cả ca đang mở
    await Promise.all(
      openList.map(s => Promise.all([getShiftJournals(s, systemCode), getSubShifts(s.id)]))
    )

    return {
      success: true,
      message: `Đã tải ${prods.length} sản phẩm, ${openList.length} CV đang mở, ${pastList.length} CV đã chốt, ${tpls.length} mẫu CV, ${orderTypes.length} loại phiếu${syncRes.syncedCount > 0 ? ` (Đã đồng bộ ${syncRes.syncedCount} thao tác chờ)` : ''}!`,
    }
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || 'Không thể tải dữ liệu số liệu ngoại tuyến',
    }
  }
}

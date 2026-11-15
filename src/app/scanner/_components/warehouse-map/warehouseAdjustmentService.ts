import { supabase } from '@/lib/supabaseClient'
import type {
  DraftProposal,
  ProposalItem,
  SubmittedProposal,
  LookedUpLot,
  ProductSuggestion,
} from './types'

const DRAFT_PROPOSAL_KEY = 'WAREHOUSE_ADJUSTMENT_DRAFT_V1'
const OFFLINE_PROPOSALS_QUEUE_KEY = 'WAREHOUSE_ADJUSTMENT_OFFLINE_QUEUE_V1'
const SUBMITTED_PROPOSALS_CACHE_KEY = 'WAREHOUSE_ADJUSTMENT_SUBMITTED_CACHE_V1'
const HALL_LOT_UPDATES_OFFLINE_KEY = 'OFFLINE_HALL_LOT_UPDATES_QUEUE_V1'

function safeGetLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeSetLocalStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('Error saving to localStorage:', e)
  }
}

export async function getDraftProposal(): Promise<DraftProposal> {
  const defaultTitle = `Phiếu điều chỉnh ngày ${new Date().toLocaleDateString('vi-VN')}`
  const parsed = safeGetLocalStorage<DraftProposal | null>(DRAFT_PROPOSAL_KEY, null)
  if (parsed && Array.isArray(parsed.items)) {
    return parsed
  }
  return {
    id: `DRAFT-${Date.now()}`,
    title: defaultTitle,
    created_by: 'Kiểm kho Mobile',
    created_at: new Date().toISOString(),
    items: [],
  }
}

export async function saveDraftProposal(draft: DraftProposal): Promise<void> {
  safeSetLocalStorage(DRAFT_PROPOSAL_KEY, draft)
}

export async function addOrUpdateDraftItem(item: ProposalItem): Promise<DraftProposal> {
  const draft = await getDraftProposal()
  const idx = draft.items.findIndex(i => i.position_id === item.position_id)
  if (idx >= 0) {
    draft.items[idx] = { ...item, updated_at: new Date().toISOString() }
  } else {
    draft.items.unshift({ ...item, updated_at: new Date().toISOString() })
  }
  await saveDraftProposal(draft)
  return draft
}

export async function removeDraftItem(positionId: string): Promise<DraftProposal> {
  const draft = await getDraftProposal()
  draft.items = draft.items.filter(i => i.position_id !== positionId)
  await saveDraftProposal(draft)
  return draft
}

export async function clearDraftProposal(): Promise<DraftProposal> {
  const fresh: DraftProposal = {
    id: `DRAFT-${Date.now()}`,
    title: `Phiếu điều chỉnh ngày ${new Date().toLocaleDateString('vi-VN')}`,
    created_by: 'Kiểm kho Mobile',
    created_at: new Date().toISOString(),
    items: [],
  }
  await saveDraftProposal(fresh)
  return fresh
}

async function resolveCurrentCompanyId(): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return null

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle()

    if ((profile as any)?.company_id) return (profile as any).company_id
  } catch {
    // ignore
  }
  return null
}

async function resolveCurrentUserName(): Promise<string> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return 'Kiểm kho Mobile'

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    if ((profile as any)?.full_name) return (profile as any).full_name
    if (user.email) return user.email.split('@')[0]
  } catch {
    // ignore
  }
  return 'Kiểm kho Mobile'
}

export async function submitAdjustmentProposalToServer(
  draft: DraftProposal,
  customNote?: string
): Promise<{
  success: boolean
  message: string
  savedOffline?: boolean
}> {
  if (!draft.items || draft.items.length === 0) {
    return { success: false, message: 'Chưa có vị trí nào trong phiếu nháp!' }
  }

  const companyId = await resolveCurrentCompanyId()
  const userName = await resolveCurrentUserName()

  const payload = {
    title: draft.title || `Đề xuất điều chỉnh (${draft.items.length} vị trí)`,
    note: customNote !== undefined ? customNote : draft.note || null,
    status: 'PENDING',
    system_code: 'KHO_DONG_LANH',
    company_id: companyId,
    created_by_name: userName,
    items: draft.items,
    created_at: new Date().toISOString(),
  }

  try {
    const { error } = await (supabase as any).from('warehouse_position_proposals').insert(payload)

    if (!error) {
      await clearDraftProposal()
      return {
        success: true,
        message: `Đã gửi đề xuất điều chỉnh (${draft.items.length} vị trí) lên Web để duyệt!`,
      }
    }

    const fallbackPayload: any = {
      system_code: 'KHO_DONG_LANH',
      task_type: 'warehouse_adjustment',
      status: 'pending',
      notes: JSON.stringify(payload),
      created_by: userName,
    }
    if (companyId) fallbackPayload.company_id = companyId

    const { error: fallbackErr } = await (supabase as any).from('shift_tasks').insert(fallbackPayload)

    if (!fallbackErr) {
      await clearDraftProposal()
      return {
        success: true,
        message: `Đã gửi đề xuất điều chỉnh (${draft.items.length} vị trí) lên hệ thống!`,
      }
    }

    throw new Error(error.message || fallbackErr?.message || 'Lỗi kết nối Server')
  } catch {
    try {
      const existingQueue = safeGetLocalStorage<any[]>(OFFLINE_PROPOSALS_QUEUE_KEY, [])
      existingQueue.push(payload)
      safeSetLocalStorage(OFFLINE_PROPOSALS_QUEUE_KEY, existingQueue)
      await clearDraftProposal()
      return {
        success: true,
        savedOffline: true,
        message: `Chưa gửi được trực tiếp lên Server. Phiếu (${draft.items.length} vị trí) đã được lưu an toàn trên máy để đồng bộ khi có mạng!`,
      }
    } catch {
      return {
        success: false,
        message: 'Không thể lưu phiếu đề xuất. Vui lòng thử lại.',
      }
    }
  }
}

export async function syncOfflineAdjustmentProposals(): Promise<number> {
  try {
    const queue = safeGetLocalStorage<any[]>(OFFLINE_PROPOSALS_QUEUE_KEY, [])
    if (!Array.isArray(queue) || queue.length === 0) return 0

    const remaining: any[] = []
    let synced = 0

    for (const item of queue) {
      const { error } = await (supabase as any).from('warehouse_position_proposals').insert(item)
      if (!error) {
        synced++
      } else {
        remaining.push(item)
      }
    }

    safeSetLocalStorage(OFFLINE_PROPOSALS_QUEUE_KEY, remaining)
    return synced
  } catch {
    return 0
  }
}

export async function getCachedSubmittedProposals(): Promise<SubmittedProposal[]> {
  const parsed = safeGetLocalStorage<SubmittedProposal[]>(SUBMITTED_PROPOSALS_CACHE_KEY, [])
  return Array.isArray(parsed) ? parsed : []
}

export async function fetchSubmittedProposals(): Promise<SubmittedProposal[]> {
  await syncOfflineAdjustmentProposals()

  const results: SubmittedProposal[] = []
  let fetchedOnlineSuccessfully = false

  try {
    const { data, error } = await (supabase as any)
      .from('warehouse_position_proposals')
      .select('id, title, status, note, created_by_name, created_at, items')
      .eq('system_code', 'KHO_DONG_LANH')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && Array.isArray(data)) {
      fetchedOnlineSuccessfully = true
      for (const row of data) {
        results.push({
          id: String(row.id),
          title: row.title || 'Phiếu đề xuất điều chỉnh',
          status: row.status || 'PENDING',
          note: row.note || null,
          created_by: row.created_by_name || 'Kiểm kho Mobile',
          created_at: row.created_at || new Date().toISOString(),
          items: Array.isArray(row.items) ? row.items : [],
          source: 'table',
        })
      }
    }
  } catch {
    // ignore
  }

  try {
    const { data: fallbackData, error: fbError } = await (supabase as any)
      .from('shift_tasks')
      .select('id, status, notes, created_by, created_at')
      .eq('system_code', 'KHO_DONG_LANH')
      .eq('task_type', 'warehouse_adjustment')
      .order('created_at', { ascending: false })
      .limit(30)

    if (!fbError && Array.isArray(fallbackData)) {
      fetchedOnlineSuccessfully = true
      for (const row of fallbackData) {
        try {
          const parsed = row.notes ? JSON.parse(row.notes) : {}
          results.push({
            id: String(row.id),
            title: parsed.title || 'Phiếu đề xuất điều chỉnh',
            status: String(row.status || parsed.status || 'PENDING').toUpperCase(),
            note: parsed.note || null,
            created_by: row.created_by || parsed.created_by_name || 'Kiểm kho Mobile',
            created_at: row.created_at || parsed.created_at || new Date().toISOString(),
            items: Array.isArray(parsed.items) ? parsed.items : [],
            source: 'shift_tasks',
          })
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  if (fetchedOnlineSuccessfully) {
    safeSetLocalStorage(SUBMITTED_PROPOSALS_CACHE_KEY, results)
  } else if (results.length === 0) {
    const cached = await getCachedSubmittedProposals()
    results.push(...cached)
  }

  try {
    const queue = safeGetLocalStorage<any[]>(OFFLINE_PROPOSALS_QUEUE_KEY, [])
    if (Array.isArray(queue)) {
      queue.forEach((qItem: any, idx: number) => {
        results.unshift({
          id: `OFFLINE-${idx}-${qItem.created_at || Date.now()}`,
          title: qItem.title || 'Phiếu chờ đồng bộ mạng',
          status: 'PENDING',
          note: (qItem.note ? `${qItem.note} ` : '') + '(Chờ mạng gửi lên Server)',
          created_by: qItem.created_by_name || 'Kiểm kho Mobile',
          created_at: qItem.created_at || new Date().toISOString(),
          items: Array.isArray(qItem.items) ? qItem.items : [],
          source: 'local',
        })
      })
    }
  } catch {
    // ignore
  }

  return results
}

export async function lookupLotBySttOrCode(sttOrCode: string): Promise<LookedUpLot | null> {
  const clean = sttOrCode.replace(/^#/, '').trim()
  if (!clean) return null

  try {
    const isNumeric = /^\d+$/.test(clean)
    let query = supabase
      .from('lots')
      .select(`
        id,
        code,
        daily_seq,
        quantity,
        metadata,
        products ( name, sku, unit ),
        lot_items ( quantity, unit, products ( name, sku, unit ) ),
        positions!positions_lot_id_fkey ( code )
      `)
      .eq('system_code', 'KHO_DONG_LANH')
      .neq('status', 'hidden')
      .neq('status', 'deleted')
      .neq('status', 'exported')

    if (isNumeric) {
      query = query.eq('daily_seq', parseInt(clean, 10))
    } else {
      query = query.ilike('code', `%${clean}%`)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    const d = data as any
    const items = d.lot_items || []
    const prod = d.products || items[0]?.products || {}

    const productNames = Array.from(
      new Set(
        [d.products?.name, ...items.map((i: any) => i.products?.name)].filter(Boolean)
      )
    )
    const productSkus = Array.from(
      new Set(
        [d.products?.sku, ...items.map((i: any) => i.products?.sku)].filter(Boolean)
      )
    )

    const totalQty =
      items.length > 0
        ? items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0)
        : d.quantity ?? 0

    const posArr = Array.isArray(d.positions)
      ? d.positions
      : d.positions
      ? [d.positions]
      : []

    return {
      id: d.id,
      code: d.code || '',
      stt: d.daily_seq ? String(d.daily_seq) : d.metadata?.stt ? String(d.metadata.stt) : clean,
      product_name: productNames.length > 0 ? productNames.join(' + ') : 'Chưa rõ tên SP',
      sku: productSkus.length > 0 ? productSkus.join(', ') : null,
      quantity: totalQty,
      unit: items[0]?.unit || prod.unit || 'Thùng',
      current_position_code: posArr[0]?.code || null,
    }
  } catch (e) {
    console.warn('lookupLotBySttOrCode error:', e)
    return null
  }
}

let cachedProductSuggestions: ProductSuggestion[] | null = null

export async function fetchProductsForSuggestions(): Promise<ProductSuggestion[]> {
  if (cachedProductSuggestions && cachedProductSuggestions.length > 0) {
    return cachedProductSuggestions
  }
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name, unit, aliases')
      .order('name', { ascending: true })
      .limit(1000)

    if (error || !data) return []

    const list: ProductSuggestion[] = (data as any[]).map((p: any) => {
      let aliasArr: string[] = []
      if (Array.isArray(p.aliases)) {
        aliasArr = p.aliases.filter(Boolean).map(String)
      } else if (typeof p.aliases === 'string' && p.aliases.trim()) {
        aliasArr = p.aliases.split(/[,;|]/).map((s: string) => s.trim()).filter(Boolean)
      }
      return {
        id: p.id,
        sku: p.sku || '',
        name: p.name || '',
        unit: p.unit || 'Thùng',
        aliases: aliasArr,
      }
    })

    cachedProductSuggestions = list
    return list
  } catch {
    return []
  }
}

export async function submitHallLotUpdate(params: {
  hallZoneId?: string | null
  hallName: string
  inputMode: 'QUICK_SEQ' | 'EXCEL_TABLE'
  seqList?: string[]
  tableRows?: Array<{
    date?: string
    dates?: string[]
    product_info: string
    quantity?: string
    tag?: string
    tags?: string[]
  }>
  notes?: string
  systemCode?: string
}): Promise<{ success: boolean; savedOffline?: boolean; message: string }> {
  const {
    hallZoneId = null,
    hallName,
    inputMode,
    seqList = [],
    tableRows = [],
    notes = '',
    systemCode = 'KHO_DONG_LANH',
  } = params

  const companyId = await resolveCurrentCompanyId()
  const createdByName = await resolveCurrentUserName()
  let userId: string | null = null
  try {
    const { data: userData } = await supabase.auth.getUser()
    userId = userData?.user?.id || null
  } catch {
    // ignore
  }

  const recordPayload: any = {
    system_code: systemCode,
    hall_zone_id: hallZoneId || null,
    hall_name: hallName.trim(),
    input_mode: inputMode,
    seq_list: seqList,
    table_rows: tableRows,
    notes: notes.trim() || null,
    status: 'PENDING',
    created_by: userId,
    created_by_name: createdByName,
  }
  if (companyId) recordPayload.company_id = companyId

  try {
    const { error } = await (supabase as any).from('hall_lot_updates').insert(recordPayload)
    if (error) throw error

    return {
      success: true,
      savedOffline: false,
      message: 'Đã gửi danh sách LOT ở sảnh lên hệ thống thành công!',
    }
  } catch {
    try {
      const queue = safeGetLocalStorage<any[]>(HALL_LOT_UPDATES_OFFLINE_KEY, [])
      queue.push({ ...recordPayload, queued_at: new Date().toISOString() })
      safeSetLocalStorage(HALL_LOT_UPDATES_OFFLINE_KEY, queue)
      return {
        success: true,
        savedOffline: true,
        message: 'Đang mất mạng: Đã lưu tạm vào bộ nhớ máy và sẽ tự gửi khi có mạng!',
      }
    } catch {
      return {
        success: false,
        message: 'Không thể gửi hoặc lưu tạm dữ liệu. Vui lòng thử lại.',
      }
    }
  }
}

export async function syncOfflineHallLotUpdates(): Promise<number> {
  try {
    const queue = safeGetLocalStorage<any[]>(HALL_LOT_UPDATES_OFFLINE_KEY, [])
    if (!Array.isArray(queue) || queue.length === 0) return 0

    let synced = 0
    const remaining: any[] = []

    for (const item of queue) {
      const { queued_at, ...payload } = item
      const { error } = await (supabase as any).from('hall_lot_updates').insert(payload)
      if (!error) {
        synced++
      } else {
        remaining.push(item)
      }
    }

    safeSetLocalStorage(HALL_LOT_UPDATES_OFFLINE_KEY, remaining)
    return synced
  } catch {
    return 0
  }
}

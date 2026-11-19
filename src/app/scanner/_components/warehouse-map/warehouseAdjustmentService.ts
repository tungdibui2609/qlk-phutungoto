import { supabase } from '@/lib/supabaseClient'
import { encodeSTT, decodeSTT } from '@/lib/numberUtils'
import type {
  DraftProposal,
  ProposalActionType,
  ProposalItem,
  ProposalSubItem,
  SubmittedProposal,
  LookedUpLot,
  ProductSuggestion,
} from './types'

const DRAFT_PROPOSAL_KEY = 'WAREHOUSE_ADJUSTMENT_DRAFT_V1'
const OFFLINE_PROPOSALS_QUEUE_KEY = 'WAREHOUSE_ADJUSTMENT_OFFLINE_QUEUE_V1'
const SUBMITTED_PROPOSALS_CACHE_KEY = 'WAREHOUSE_ADJUSTMENT_SUBMITTED_CACHE_V1'
const PRODUCT_SUGGESTIONS_CACHE_KEY = 'WAREHOUSE_PRODUCT_SUGGESTIONS_CACHE_V1'
const HALL_LOT_UPDATES_OFFLINE_KEY = 'OFFLINE_HALL_LOT_UPDATES_QUEUE_V1'

const TABLE_PRIMARY = 'warehouse_position_proposals'
const TABLE_FALLBACK = 'shift_tasks'

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

/**
 * Chuẩn hóa 1 ProposalSubItem về đúng schema Android & Web mẹ
 * (tương thích ngược với các bản nháp cũ dùng old_qty / new_qty)
 */
export function normalizeProposalSubItem(raw: any): ProposalSubItem {
  const currentQty =
    raw?.current_quantity != null
      ? Number(raw.current_quantity)
      : raw?.old_qty != null
      ? Number(raw.old_qty)
      : 0
  const newQty =
    raw?.new_quantity != null
      ? Number(raw.new_quantity)
      : raw?.new_qty != null
      ? Number(raw.new_qty)
      : currentQty

  return {
    product_id: raw?.product_id || null,
    product_name: (raw?.product_name || raw?.sku || 'Sản phẩm').trim(),
    sku: raw?.sku || null,
    current_quantity: isNaN(currentQty) ? 0 : currentQty,
    new_quantity: isNaN(newQty) ? 0 : newQty,
    unit: (raw?.unit || 'Thùng').trim(),
    ...(raw?.is_new ? { is_new: true } : {}),
  }
}

/**
 * Chuẩn hóa 1 ProposalItem về đúng schema Android & Web mẹ
 * (tương thích ngược với các bản nháp cũ dùng action / old_* / new_* / reason)
 */
export function normalizeProposalItem(raw: any): ProposalItem {
  const actionType: ProposalActionType = (raw?.action_type || raw?.action || 'NOTE') as ProposalActionType
  const subItems: ProposalSubItem[] | undefined =
    Array.isArray(raw?.sub_items) && raw.sub_items.length > 0
      ? raw.sub_items.map(normalizeProposalSubItem)
      : undefined

  const currentQty =
    raw?.current_quantity !== undefined
      ? raw.current_quantity
      : raw?.old_qty !== undefined
      ? raw.old_qty
      : null

  const newQty =
    raw?.new_quantity !== undefined
      ? raw.new_quantity
      : raw?.new_qty !== undefined
      ? raw.new_qty
      : null

  const lotId = raw?.lot_id !== undefined ? raw.lot_id : raw?.old_lot_id ?? null
  const lotCode =
    raw?.lot_code !== undefined
      ? raw.lot_code
      : actionType === 'ASSIGN_LOT'
      ? raw?.new_lot_code ?? null
      : raw?.old_lot_code ?? null
  const lotStt =
    raw?.lot_stt !== undefined
      ? raw.lot_stt
      : actionType === 'ASSIGN_LOT'
      ? raw?.new_stt ?? null
      : raw?.old_stt ?? null

  const productName =
    raw?.product_name !== undefined
      ? raw.product_name
      : actionType === 'ASSIGN_LOT'
      ? raw?.new_product_name || raw?.old_product_name || null
      : raw?.old_product_name || raw?.new_product_name || (subItems ? subItems.map(s => s.product_name).join(', ') : null)

  const sku =
    raw?.sku !== undefined
      ? raw.sku
      : actionType === 'ASSIGN_LOT'
      ? raw?.new_sku || raw?.old_sku || null
      : raw?.old_sku || raw?.new_sku || null

  const unit =
    raw?.unit !== undefined
      ? raw.unit
      : raw?.new_unit || raw?.old_unit || subItems?.[0]?.unit || 'Thùng'

  const note = raw?.note !== undefined ? raw.note : raw?.reason ?? null

  return {
    id: raw?.id || `${raw?.position_id || 'pos'}-${Date.now()}`,
    position_id: raw?.position_id || '',
    position_code: raw?.position_code || '',
    warehouse_name: raw?.warehouse_name || raw?.zone_path || undefined,
    action_type: actionType,
    lot_id: lotId,
    lot_code: lotCode,
    lot_stt: lotStt,
    ...(raw?.lot_found !== undefined ? { lot_found: raw.lot_found } : {}),
    product_name: productName,
    sku,
    current_quantity: currentQty,
    unit,
    ...(subItems ? { sub_items: subItems } : {}),
    new_quantity: newQty,
    target_position_id: raw?.target_position_id ?? null,
    target_position_code: raw?.target_position_code ?? null,
    note,
    updated_at: raw?.updated_at || new Date().toISOString(),
  }
}

export async function getDraftProposal(): Promise<DraftProposal> {
  const parsed = safeGetLocalStorage<any>(DRAFT_PROPOSAL_KEY, null)
  if (parsed && Array.isArray(parsed.items)) {
    return {
      title: parsed.title || '',
      notes: parsed.notes ?? parsed.note ?? '',
      items: parsed.items.map(normalizeProposalItem),
      updated_at: parsed.updated_at || new Date().toISOString(),
    }
  }
  return {
    title: '',
    notes: '',
    items: [],
    updated_at: new Date().toISOString(),
  }
}

export async function saveDraftProposal(draft: DraftProposal): Promise<void> {
  const payload: DraftProposal = {
    title: draft.title || '',
    notes: draft.notes || '',
    items: Array.isArray(draft.items) ? draft.items.map(normalizeProposalItem) : [],
    updated_at: new Date().toISOString(),
  }
  safeSetLocalStorage(DRAFT_PROPOSAL_KEY, payload)
}

export async function addOrUpdateDraftItem(item: ProposalItem): Promise<DraftProposal> {
  const draft = await getDraftProposal()
  const normalized = normalizeProposalItem({ ...item, updated_at: new Date().toISOString() })
  const idx = draft.items.findIndex(
    i => i.position_id === normalized.position_id || i.id === normalized.id
  )
  const nextItems = [...draft.items]
  if (idx >= 0) {
    nextItems[idx] = normalized
  } else {
    nextItems.unshift(normalized)
  }
  const updated: DraftProposal = {
    ...draft,
    items: nextItems,
    updated_at: new Date().toISOString(),
  }
  await saveDraftProposal(updated)
  return updated
}

export async function removeDraftItem(positionId: string): Promise<DraftProposal> {
  const draft = await getDraftProposal()
  const updated: DraftProposal = {
    ...draft,
    items: draft.items.filter(i => i.position_id !== positionId && i.id !== positionId),
    updated_at: new Date().toISOString(),
  }
  await saveDraftProposal(updated)
  return updated
}

export async function clearDraftProposal(): Promise<DraftProposal> {
  const fresh: DraftProposal = {
    title: '',
    notes: '',
    items: [],
    updated_at: new Date().toISOString(),
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(DRAFT_PROPOSAL_KEY)
    } catch {
      // ignore
    }
  }
  return fresh
}

async function resolveCurrentUserInfo(): Promise<{
  id: string | null
  companyId: string | null
  userName: string
}> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return { id: null, companyId: null, userName: 'Nhân viên kho' }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id, full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const companyId = (profile as any)?.company_id || null
    const userName =
      (profile as any)?.full_name ||
      (user.email ? user.email.split('@')[0] : 'Nhân viên kho')

    return { id: user.id, companyId, userName }
  } catch {
    return { id: null, companyId: null, userName: 'Nhân viên kho' }
  }
}

function buildPrimaryProposalPayload(raw: any, fallbackUserId?: string | null) {
  const items: ProposalItem[] = Array.isArray(raw.items)
    ? raw.items.map(normalizeProposalItem)
    : []
  return {
    title: raw.title || `Đề xuất điều chỉnh vị trí (${items.length} vị trí)`,
    notes: raw.notes !== undefined ? raw.notes : (raw.note ?? null),
    status: raw.status || 'PENDING',
    system_code: raw.system_code || 'KHO_DONG_LANH',
    company_id: raw.company_id || null,
    created_by: raw.created_by || fallbackUserId || null,
    created_by_name: raw.created_by_name || 'Nhân viên kho',
    total_positions: items.length,
    items,
  }
}

function buildShiftTaskFallbackPayload(primary: ReturnType<typeof buildPrimaryProposalPayload>) {
  const now = new Date()
  const code = `DC-${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return {
    code,
    system_code: primary.system_code || 'KHO_DONG_LANH',
    company_id: primary.company_id || null,
    title: primary.title,
    content: JSON.stringify({
      notes: primary.notes || '',
      items: primary.items,
    }),
    priority: 'normal',
    status: 'pending',
    task_type: 'warehouse_adjustment',
    created_by: primary.created_by || null,
    created_by_name: primary.created_by_name || 'Nhân viên kho',
    images: [],
  }
}

export async function submitAdjustmentProposalToServer(
  draft: DraftProposal,
  customNote?: string,
  systemCode: string = 'KHO_DONG_LANH'
): Promise<{
  success: boolean
  message: string
  savedOffline?: boolean
}> {
  if (!draft.items || draft.items.length === 0) {
    return { success: false, message: 'Chưa có vị trí nào trong phiếu nháp!' }
  }

  const { id: userId, companyId, userName } = await resolveCurrentUserInfo()
  const normalizedItems = draft.items.map(normalizeProposalItem)
  const finalNotes = customNote !== undefined ? customNote.trim() || null : draft.notes.trim() || null

  const payload = buildPrimaryProposalPayload(
    {
      title: draft.title || `Đề xuất điều chỉnh vị trí (${normalizedItems.length} vị trí)`,
      notes: finalNotes,
      status: 'PENDING',
      system_code: systemCode,
      company_id: companyId,
      created_by: userId,
      created_by_name: userName,
      total_positions: normalizedItems.length,
      items: normalizedItems,
    },
    userId
  )

  try {
    // 1. Thử ghi vào bảng chuyên dụng warehouse_position_proposals
    const { error } = await (supabase as any)
      .from(TABLE_PRIMARY)
      .insert(payload)

    if (!error) {
      await clearDraftProposal()
      return {
        success: true,
        message: `Đã gửi đề xuất điều chỉnh (${normalizedItems.length} vị trí) lên Web để duyệt!`,
      }
    }

    // 2. Fallback sang shift_tasks
    const fallbackPayload = buildShiftTaskFallbackPayload(payload)
    const { error: fallbackErr } = await (supabase as any)
      .from(TABLE_FALLBACK)
      .insert(fallbackPayload)

    if (!fallbackErr) {
      await clearDraftProposal()
      return {
        success: true,
        message: `Đã gửi đề xuất điều chỉnh (${normalizedItems.length} vị trí) lên hệ thống!`,
      }
    }

    throw new Error(error.message || fallbackErr?.message || 'Lỗi kết nối Server')
  } catch {
    try {
      const existingQueue = safeGetLocalStorage<any[]>(OFFLINE_PROPOSALS_QUEUE_KEY, [])
      existingQueue.push({ ...payload, queued_at: new Date().toISOString() })
      safeSetLocalStorage(OFFLINE_PROPOSALS_QUEUE_KEY, existingQueue)
      await clearDraftProposal()
      return {
        success: true,
        savedOffline: true,
        message: `Chưa gửi được trực tiếp lên Server. Phiếu (${normalizedItems.length} vị trí) đã được lưu an toàn trên máy để đồng bộ khi có mạng!`,
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

    const { id: userId, companyId } = await resolveCurrentUserInfo()
    const remaining: any[] = []
    let synced = 0

    for (const rawItem of queue) {
      const normalized = buildPrimaryProposalPayload(
        {
          ...rawItem,
          company_id: rawItem.company_id || companyId,
        },
        userId
      )
      const { error } = await (supabase as any)
        .from(TABLE_PRIMARY)
        .insert(normalized)

      if (!error) {
        synced++
      } else {
        const fallbackPayload = buildShiftTaskFallbackPayload(normalized)
        const { error: fbErr } = await (supabase as any)
          .from(TABLE_FALLBACK)
          .insert(fallbackPayload)
        if (!fbErr) {
          synced++
        } else {
          remaining.push({ ...normalized, queued_at: rawItem.queued_at || new Date().toISOString() })
        }
      }
    }

    safeSetLocalStorage(OFFLINE_PROPOSALS_QUEUE_KEY, remaining)
    return synced
  } catch {
    return 0
  }
}

/**
 * Tự động tra cứu thông tin Lot (tên SP, mã Lot, số lượng) từ STT (VD: G888)
 * cho các item ASSIGN_LOT giống Android & Web mẹ
 */
async function enrichAssignLotItems(
  proposals: SubmittedProposal[],
  systemCode: string
): Promise<void> {
  const seqSet = new Set<number>()
  const lotIdSet = new Set<string>()
  let hasAssignLot = false

  for (const p of proposals) {
    for (const it of p.items) {
      if (it.action_type !== 'ASSIGN_LOT') continue
      hasAssignLot = true
      if (it.lot_id) lotIdSet.add(it.lot_id)
      const sttRaw = (it.lot_stt || '').replace(/^#/, '').trim().toUpperCase()
      if (sttRaw) {
        const seq = encodeSTT(sttRaw)
        if (seq !== null) seqSet.add(seq)
      }
    }
  }

  if (!hasAssignLot || (seqSet.size === 0 && lotIdSet.size === 0)) {
    return
  }

  const bySeq = new Map<number, any>()
  const byId = new Map<string, any>()

  try {
    if (seqSet.size > 0) {
      const { data } = await (supabase as any)
        .from('lots')
        .select(
          `id, code, production_code, daily_seq, quantity,
           lot_items(id, quantity, unit, products(name, sku, unit))`
        )
        .eq('system_code', systemCode)
        .in('daily_seq', Array.from(seqSet))

      if (Array.isArray(data)) {
        for (const lot of data) {
          if (lot.daily_seq != null) bySeq.set(lot.daily_seq, lot)
          if (lot.id) byId.set(lot.id, lot)
        }
      }
    }

    const missingIds = Array.from(lotIdSet).filter(id => !byId.has(id))
    if (missingIds.length > 0) {
      const { data } = await (supabase as any)
        .from('lots')
        .select(
          `id, code, production_code, daily_seq, quantity,
           lot_items(id, quantity, unit, products(name, sku, unit))`
        )
        .eq('system_code', systemCode)
        .in('id', missingIds)

      if (Array.isArray(data)) {
        for (const lot of data) {
          if (lot.daily_seq != null) bySeq.set(lot.daily_seq, lot)
          if (lot.id) byId.set(lot.id, lot)
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi enrich thông tin Lot trên Scanner:', err)
    return
  }

  for (const p of proposals) {
    for (const it of p.items) {
      if (it.action_type !== 'ASSIGN_LOT') continue
      const sttRaw = (it.lot_stt || '').replace(/^#/, '').trim().toUpperCase()
      const seq = sttRaw ? encodeSTT(sttRaw) : null
      const lot =
        (seq !== null ? bySeq.get(seq) : null) ||
        (it.lot_id ? byId.get(it.lot_id) : null)

      if (!lot) {
        if (sttRaw) it.lot_found = false
        continue
      }

      it.lot_found = true
      it.lot_id = lot.id
      it.lot_code = lot.code || lot.production_code || it.lot_code

      const itemsArr: any[] = Array.isArray(lot.lot_items) ? lot.lot_items : []
      if (itemsArr.length > 0) {
        const names = itemsArr.map(li => li.products?.name).filter(Boolean)
        const skus = itemsArr.map(li => li.products?.sku).filter(Boolean)
        const totalQty = itemsArr.reduce((s, li) => s + (Number(li.quantity) || 0), 0)
        const firstUnit = itemsArr[0]?.unit || itemsArr[0]?.products?.unit || it.unit || 'Thùng'

        if (names.length > 0) it.product_name = Array.from(new Set(names)).join(', ')
        if (skus.length > 0) it.sku = Array.from(new Set(skus)).join(', ')
        it.new_quantity = totalQty || lot.quantity || it.new_quantity
        it.unit = firstUnit
      } else if (lot.quantity != null) {
        it.new_quantity = lot.quantity
      }
    }
  }
}

export async function getCachedSubmittedProposals(
  systemCode: string = 'KHO_DONG_LANH'
): Promise<SubmittedProposal[]> {
  const results: SubmittedProposal[] = []

  try {
    const queue = safeGetLocalStorage<any[]>(OFFLINE_PROPOSALS_QUEUE_KEY, [])
    if (Array.isArray(queue)) {
      queue.forEach((qItem: any, idx: number) => {
        const items = Array.isArray(qItem.items) ? qItem.items.map(normalizeProposalItem) : []
        results.push({
          id: `OFFLINE-${idx}-${qItem.queued_at || qItem.created_at || Date.now()}`,
          code: 'CHỜ ĐỒNG BỘ',
          system_code: qItem.system_code || systemCode,
          title: qItem.title || `Đề xuất điều chỉnh (${items.length} vị trí)`,
          notes: qItem.notes ?? qItem.note ?? '',
          status: 'PENDING',
          total_positions: items.length,
          items,
          created_by: qItem.created_by || null,
          created_by_name: qItem.created_by_name || 'Bạn',
          created_at: qItem.queued_at || qItem.created_at || new Date().toISOString(),
          isOfflinePending: true,
          source: 'local',
        })
      })
    }
  } catch {
    // ignore
  }

  const parsed = safeGetLocalStorage<SubmittedProposal[]>(SUBMITTED_PROPOSALS_CACHE_KEY, [])
  if (Array.isArray(parsed)) {
    results.push(
      ...parsed.map(p => ({
        ...p,
        notes: (p as any).notes ?? (p as any).note ?? '',
        items: Array.isArray(p.items) ? p.items.map(normalizeProposalItem) : [],
      }))
    )
  }

  return results
}

export async function fetchSubmittedProposals(
  systemCode: string = 'KHO_DONG_LANH'
): Promise<SubmittedProposal[]> {
  await syncOfflineAdjustmentProposals()

  const serverResults: SubmittedProposal[] = []
  let fetchedOnlineSuccessfully = false

  // 1. Lấy từ bảng warehouse_position_proposals
  try {
    const { data, error } = await (supabase as any)
      .from(TABLE_PRIMARY)
      .select(
        'id, code, system_code, title, status, notes, total_positions, created_by, created_by_name, approved_by_name, approved_at, review_notes, created_at, items'
      )
      .eq('system_code', systemCode)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && Array.isArray(data)) {
      fetchedOnlineSuccessfully = true
      for (const row of data) {
        const items = Array.isArray(row.items) ? row.items.map(normalizeProposalItem) : []
        serverResults.push({
          id: String(row.id),
          code: row.code || undefined,
          system_code: row.system_code || systemCode,
          title: row.title || 'Đề xuất điều chỉnh vị trí kho',
          notes: row.notes || '',
          status: (row.status || 'PENDING').toUpperCase(),
          total_positions: row.total_positions ?? items.length,
          items,
          created_by: row.created_by || null,
          created_by_name: row.created_by_name || 'Nhân viên kho',
          approved_by_name: row.approved_by_name || null,
          approved_at: row.approved_at || null,
          review_notes: row.review_notes || null,
          created_at: row.created_at || new Date().toISOString(),
          isOfflinePending: false,
          source: 'table',
        })
      }
    }
  } catch {
    // ignore
  }

  // 2. Lấy thêm từ shift_tasks (nếu có phiếu gửi qua fallback hoặc từ Android cũ)
  try {
    const { data: fallbackData, error: fbError } = await (supabase as any)
      .from(TABLE_FALLBACK)
      .select(
        'id, code, system_code, title, status, content, created_by_name, created_by, completed_by_name, completed_at, completion_notes, created_at'
      )
      .eq('system_code', systemCode)
      .eq('task_type', 'warehouse_adjustment')
      .order('created_at', { ascending: false })
      .limit(30)

    if (!fbError && Array.isArray(fallbackData)) {
      fetchedOnlineSuccessfully = true
      for (const row of fallbackData) {
        try {
          const parsed =
            row.content && typeof row.content === 'string' && row.content.startsWith('{')
              ? JSON.parse(row.content)
              : {}
          const rawSt = String(row.status || parsed.status || 'pending').toUpperCase()
          const mappedStatus =
            rawSt === 'COMPLETED' || rawSt === 'APPROVED'
              ? 'APPROVED'
              : rawSt === 'CANCELLED' || rawSt === 'REJECTED'
              ? 'REJECTED'
              : 'PENDING'
          const items = Array.isArray(parsed.items)
            ? parsed.items.map(normalizeProposalItem)
            : []
          serverResults.push({
            id: String(row.id),
            code: row.code || 'DC',
            system_code: row.system_code || systemCode,
            title: row.title || parsed.title || 'Đề xuất điều chỉnh vị trí kho',
            notes: parsed.notes || parsed.note || '',
            status: mappedStatus,
            total_positions: items.length,
            items,
            created_by: row.created_by || null,
            created_by_name: row.created_by_name || parsed.created_by_name || 'Nhân viên kho',
            approved_by_name: row.completed_by_name || null,
            approved_at: row.completed_at || null,
            review_notes: row.completion_notes || null,
            created_at: row.created_at || parsed.created_at || new Date().toISOString(),
            isOfflinePending: false,
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

  // Sắp xếp mới nhất lên đầu
  serverResults.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (serverResults.length > 0) {
    await enrichAssignLotItems(serverResults, systemCode)
  }

  if (fetchedOnlineSuccessfully) {
    safeSetLocalStorage(SUBMITTED_PROPOSALS_CACHE_KEY, serverResults)
  }

  const results: SubmittedProposal[] = []

  // Phiếu đang chờ đồng bộ mạng lên đầu
  try {
    const queue = safeGetLocalStorage<any[]>(OFFLINE_PROPOSALS_QUEUE_KEY, [])
    if (Array.isArray(queue)) {
      queue.forEach((qItem: any, idx: number) => {
        const items = Array.isArray(qItem.items) ? qItem.items.map(normalizeProposalItem) : []
        results.push({
          id: `OFFLINE-${idx}-${qItem.queued_at || qItem.created_at || Date.now()}`,
          code: 'CHỜ ĐỒNG BỘ',
          system_code: qItem.system_code || systemCode,
          title: qItem.title || 'Phiếu chờ đồng bộ mạng',
          notes: ((qItem.notes ?? qItem.note) ? `${qItem.notes ?? qItem.note} ` : '') + '(Chờ mạng gửi lên Server)',
          status: 'PENDING',
          total_positions: items.length,
          items,
          created_by: qItem.created_by || null,
          created_by_name: qItem.created_by_name || 'Bạn',
          created_at: qItem.queued_at || qItem.created_at || new Date().toISOString(),
          isOfflinePending: true,
          source: 'local',
        })
      })
    }
  } catch {
    // ignore
  }

  if (fetchedOnlineSuccessfully) {
    results.push(...serverResults)
  } else {
    const cached = safeGetLocalStorage<SubmittedProposal[]>(SUBMITTED_PROPOSALS_CACHE_KEY, [])
    if (Array.isArray(cached)) {
      results.push(
        ...cached.map(p => ({
          ...p,
          notes: (p as any).notes ?? (p as any).note ?? '',
          items: Array.isArray(p.items) ? p.items.map(normalizeProposalItem) : [],
        }))
      )
    }
  }

  return results
}

/**
 * Tra cứu Lot theo STT (hỗ trợ cả dạng chữ+số như G57, G88, G949 bằng encodeSTT)
 * hoặc theo mã Lot / mã sản xuất (code, production_code)
 */
export async function lookupLotBySttOrCode(
  sttOrCode: string,
  systemCode: string = 'KHO_DONG_LANH'
): Promise<LookedUpLot | null> {
  const clean = (sttOrCode || '').replace(/^#/, '').trim().toUpperCase()
  if (!clean) return null

  try {
    const encodedSeq = encodeSTT(clean)
    let lotRow: any = null

    const selectFields = `
      id,
      code,
      production_code,
      daily_seq,
      quantity,
      status,
      system_code,
      lot_items (
        id,
        product_id,
        quantity,
        unit,
        products ( id, name, sku, unit )
      ),
      positions!positions_lot_id_fkey ( id, code )
    `

    if (encodedSeq !== null) {
      const { data } = await (supabase as any)
        .from('lots')
        .select(selectFields)
        .eq('daily_seq', encodedSeq)
        .eq('system_code', systemCode)
        .neq('status', 'hidden')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) lotRow = data
    }

    if (!lotRow) {
      const { data } = await (supabase as any)
        .from('lots')
        .select(selectFields)
        .eq('system_code', systemCode)
        .neq('status', 'hidden')
        .neq('status', 'deleted')
        .or(`code.ilike.%${clean}%,production_code.ilike.%${clean}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) lotRow = data
    }

    if (!lotRow) return null

    const items = Array.isArray(lotRow.lot_items)
      ? lotRow.lot_items.map((it: any) => ({
          product_id: it.product_id || it.products?.id || null,
          product_name: it.products?.name || 'Sản phẩm',
          sku: it.products?.sku || null,
          quantity: Number(it.quantity) || 0,
          unit: it.unit || it.products?.unit || 'Thùng',
        }))
      : []

    const totalQty =
      items.length > 0
        ? items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0)
        : Number(lotRow.quantity) || 0

    const posList = Array.isArray(lotRow.positions)
      ? lotRow.positions
      : lotRow.positions
      ? [lotRow.positions]
      : []

    const productNames = Array.from(
      new Set(items.map((it: any) => it.product_name).filter(Boolean))
    )
    const productSkus = Array.from(
      new Set(items.map((it: any) => it.sku).filter(Boolean))
    )

    return {
      id: lotRow.id,
      code: lotRow.code || lotRow.production_code || '',
      stt: lotRow.daily_seq != null ? decodeSTT(lotRow.daily_seq) : clean,
      product_name:
        productNames.length > 0
          ? productNames.join(', ')
          : `Lot ${lotRow.code || lotRow.production_code || ''}`,
      sku: productSkus.length > 0 ? productSkus.join(', ') : null,
      quantity: totalQty,
      unit: items[0]?.unit || 'Thùng',
      items,
      current_position_id: posList[0]?.id || null,
      current_position_code: posList[0]?.code || null,
    }
  } catch (e) {
    console.warn('lookupLotBySttOrCode error:', e)
    return null
  }
}

let cachedProductSuggestions: ProductSuggestion[] | null = null

/**
 * Tải danh mục sản phẩm kèm tên viết tắt (aliases), mã nội bộ (internal_code/name)
 * và danh sách đơn vị tính cài đặt trên Web mẹ (product_units + units) giống hệt Android
 */
export async function fetchProductsForSuggestions(
  systemCode: string = 'KHO_DONG_LANH'
): Promise<ProductSuggestion[]> {
  if (cachedProductSuggestions && cachedProductSuggestions.length > 0) {
    return cachedProductSuggestions
  }

  try {
    const [prodRes, pUnitRes, unitRes] = await Promise.all([
      (supabase as any)
        .from('products')
        .select('id, sku, name, internal_code, internal_name, unit, aliases')
        .eq('system_type', systemCode)
        .order('name', { ascending: true })
        .limit(1000),
      (supabase as any)
        .from('product_units')
        .select('product_id, unit_id, conversion_rate')
        .limit(2000),
      (supabase as any)
        .from('units')
        .select('id, name')
        .limit(500),
    ])

    let products: any[] = Array.isArray(prodRes.data) ? prodRes.data : []
    if (prodRes.error || products.length === 0) {
      const { data: allData } = await (supabase as any)
        .from('products')
        .select('id, sku, name, internal_code, internal_name, unit, aliases')
        .order('name', { ascending: true })
        .limit(1000)
      products = Array.isArray(allData) ? allData : []
    }

    if (products.length === 0) {
      const cached = safeGetLocalStorage<ProductSuggestion[]>(PRODUCT_SUGGESTIONS_CACHE_KEY, [])
      if (cached.length > 0) {
        cachedProductSuggestions = cached
        return cached
      }
      return []
    }

    const pUnits: any[] = Array.isArray(pUnitRes.data) ? pUnitRes.data : []
    const unitList: any[] = Array.isArray(unitRes.data) ? unitRes.data : []
    const unitMap = new Map<string, string>()
    unitList.forEach(u => {
      if (u.id && u.name) unitMap.set(u.id, String(u.name).trim())
    })

    const pUnitsByProd = new Map<string, Array<{ unit_name: string; rate: number }>>()
    pUnits.forEach(pu => {
      const uName = unitMap.get(pu.unit_id)
      if (pu.product_id && uName) {
        if (!pUnitsByProd.has(pu.product_id)) {
          pUnitsByProd.set(pu.product_id, [])
        }
        pUnitsByProd.get(pu.product_id)!.push({
          unit_name: uName,
          rate: Number(pu.conversion_rate) || 1,
        })
      }
    })

    const list: ProductSuggestion[] = products.map((p: any) => {
      let aliasArr: string[] = []
      if (Array.isArray(p.aliases)) {
        aliasArr = p.aliases.filter(Boolean).map(String)
      } else if (typeof p.aliases === 'string' && p.aliases.trim()) {
        aliasArr = p.aliases
          .split(/[,;|\n]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
      }

      const baseUnit = (p.unit || 'Thùng').trim()
      const unitsList: string[] = []

      // 1. Đơn vị quy đổi cài đặt trên Web mẹ (VD: Thùng (20kg))
      const pus = pUnitsByProd.get(p.id) || []
      pus.forEach(pu => {
        const uName = pu.unit_name.split('(')[0].trim()
        if (uName.toLowerCase() === baseUnit.toLowerCase()) return
        const label = pu.rate > 0 ? `${uName} (${pu.rate}kg)` : uName
        if (!unitsList.includes(label)) {
          unitsList.push(label)
        }
      })

      // 2. Đơn vị cơ sở cài đặt trên Web mẹ (VD: Kg)
      if (!unitsList.includes(baseUnit)) {
        unitsList.push(baseUnit)
      }

      return {
        id: p.id,
        sku: p.sku || '',
        name: p.name || '',
        internal_code: p.internal_code || null,
        internal_name: p.internal_name || null,
        unit: baseUnit,
        aliases: aliasArr,
        available_units: unitsList,
      }
    })

    cachedProductSuggestions = list
    safeSetLocalStorage(PRODUCT_SUGGESTIONS_CACHE_KEY, list)
    return list
  } catch {
    const cached = safeGetLocalStorage<ProductSuggestion[]>(PRODUCT_SUGGESTIONS_CACHE_KEY, [])
    if (cached.length > 0) {
      cachedProductSuggestions = cached
      return cached
    }
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

  const { id: userId, companyId, userName: createdByName } = await resolveCurrentUserInfo()

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

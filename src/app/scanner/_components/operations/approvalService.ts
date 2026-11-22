import { supabase } from '@/lib/supabaseClient'

export type HiddenKind = 'shifts' | 'images' | 'journals'

const HIDDEN_KEY_MAP: Record<HiddenKind, string> = {
  shifts: 'scanner_hidden_shifts_v1',
  images: 'scanner_hidden_images_v1',
  journals: 'scanner_hidden_journals_v1',
}

export function getHiddenIds(kind: HiddenKind): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(HIDDEN_KEY_MAP[kind])
    const arr = raw ? (JSON.parse(raw) as string[]) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function addHiddenId(kind: HiddenKind, id: string): void {
  if (typeof window === 'undefined' || !id) return
  try {
    const set = getHiddenIds(kind)
    set.add(id)
    localStorage.setItem(HIDDEN_KEY_MAP[kind], JSON.stringify(Array.from(set)))
  } catch {}
}

export function removeHiddenId(kind: HiddenKind, id: string): void {
  if (typeof window === 'undefined' || !id) return
  try {
    const set = getHiddenIds(kind)
    if (!set.has(id)) return
    set.delete(id)
    localStorage.setItem(HIDDEN_KEY_MAP[kind], JSON.stringify(Array.from(set)))
  } catch {}
}

export async function reconcileHiddenIds(
  kind: HiddenKind,
  targetTable: 'delivery_shifts' | 'operation_images' | 'delivery_journal'
): Promise<Set<string>> {
  const hidden = getHiddenIds(kind)
  if (hidden.size === 0) return hidden
  try {
    const ids = Array.from(hidden)
    const { data, error } = await (supabase.from('operation_approval_requests') as any)
      .select('target_id, status')
      .eq('target_table', targetTable)
      .in('target_id', ids)
      .order('requested_at', { ascending: false })

    if (error || !Array.isArray(data)) return hidden

    const latestByTarget = new Map<string, string>()
    for (const row of data) {
      if (!latestByTarget.has(row.target_id)) {
        latestByTarget.set(row.target_id, row.status)
      }
    }
    let changed = false
    for (const id of ids) {
      if (latestByTarget.get(id) === 'rejected') {
        hidden.delete(id)
        changed = true
      }
    }
    if (changed && typeof window !== 'undefined') {
      localStorage.setItem(HIDDEN_KEY_MAP[kind], JSON.stringify(Array.from(hidden)))
    }
  } catch {}
  return hidden
}

export type ApprovalActionType = 'delete_shift' | 'delete_image' | 'delete_journal' | 'update_journal'

const ACTION_COLUMN_MAP: Record<ApprovalActionType, string> = {
  update_journal: 'allow_update_journal',
  delete_journal: 'allow_delete_journal',
  delete_image: 'allow_delete_image',
  delete_shift: 'allow_delete_shift',
}

/**
 * Kiểm tra xem nhân viên hiện tại có được cài đặt miễn duyệt cho thao tác này
 * trong phân hệ kho tương ứng không (bảng operation_approval_settings).
 */
export async function canBypassOperationApproval(
  actionType: ApprovalActionType,
  systemCode: string,
  userId?: string | null
): Promise<boolean> {
  try {
    let uid = userId || null
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser()
      uid = authData?.user?.id || null
    }
    if (!uid || !systemCode) return false

    const cleanSys = systemCode.endsWith('__solieu') ? systemCode.slice(0, -8) : systemCode
    const col = ACTION_COLUMN_MAP[actionType]
    const { data, error } = await (supabase.from('operation_approval_settings') as any)
      .select('allow_update_journal, allow_delete_journal, allow_delete_image, allow_delete_shift')
      .eq('user_id', uid)
      .in('system_code', [cleanSys, `${cleanSys}__solieu`])

    if (error || !Array.isArray(data) || data.length === 0) return false
    return data.some((row: any) => Boolean(row?.[col]))
  } catch {
    return false
  }
}

export async function submitScannerApprovalRequest(params: {
  systemCode: string
  companyId?: string | null
  actionType: 'delete_shift' | 'delete_image' | 'delete_journal' | 'update_journal' | 'reopen_shift'
  targetTable: 'delivery_shifts' | 'operation_images' | 'delivery_journal'
  targetId: string
  shiftId?: string | null
  shiftName?: string | null
  targetLabel?: string | null
  beforeData?: any
  afterData?: any
  reason?: string | null
  requestedBy?: string | null
  requestedByName?: string | null
  sourceDevice?: 'scanner' | 'mobile_app' | 'web'
}): Promise<void> {
  const { error } = await (supabase.from('operation_approval_requests') as any).insert([
    {
      system_code: params.systemCode,
      ...(params.companyId ? { company_id: params.companyId } : {}),
      action_type: params.actionType,
      target_table: params.targetTable,
      target_id: params.targetId,
      shift_id: params.shiftId || null,
      shift_name: params.shiftName || null,
      target_label: params.targetLabel || null,
      before_data: params.beforeData || null,
      after_data: params.afterData || null,
      reason: params.reason || null,
      source_device: params.sourceDevice || 'scanner',
      status: 'pending',
      ...(params.requestedBy ? { requested_by: params.requestedBy } : {}),
      requested_by_name: params.requestedByName || 'Nhân viên Scanner',
    },
  ])
  if (error) throw error
}

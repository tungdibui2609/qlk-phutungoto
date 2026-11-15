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

export async function submitScannerApprovalRequest(params: {
  systemCode: string
  companyId?: string | null
  actionType: 'delete_shift' | 'delete_image' | 'delete_journal' | 'update_journal'
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

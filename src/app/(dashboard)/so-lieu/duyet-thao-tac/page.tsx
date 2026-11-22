'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Briefcase,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Smartphone,
  Monitor,
  Loader2,
  Settings,
  Search,
  UserCheck,
  RotateCcw,
} from 'lucide-react'

interface StaffMember {
  id: string
  full_name: string | null
  email: string | null
  employee_code: string | null
  department: string | null
  is_active: boolean | null
}

interface ApprovalBypassSetting {
  id?: string
  company_id?: string | null
  system_code: string
  user_id: string
  user_name?: string | null
  allow_update_journal: boolean
  allow_delete_journal: boolean
  allow_delete_image: boolean
  allow_delete_shift: boolean
}

interface ApprovalRequest {
  id: string
  company_id?: string | null
  system_code: string
  action_type: 'delete_shift' | 'delete_image' | 'delete_journal' | 'update_journal' | 'reopen_shift'
  target_table: 'delivery_shifts' | 'operation_images' | 'delivery_journal'
  target_id: string
  shift_id?: string | null
  shift_name?: string | null
  target_label?: string | null
  before_data?: any
  after_data?: any
  reason?: string | null
  source_device: 'scanner' | 'mobile_app' | 'web'
  status: 'pending' | 'approved' | 'rejected'
  requested_by?: string | null
  requested_by_name?: string | null
  requested_at: string
  reviewed_by?: string | null
  reviewed_by_name?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
}

const ACTION_META: Record<
  ApprovalRequest['action_type'],
  { label: string; badgeClass: string; icon: any }
> = {
  reopen_shift: {
    label: 'Mở lại công việc',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-700',
    icon: RotateCcw,
  },
  delete_shift: {
    label: 'Xóa công việc',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    icon: Briefcase,
  },
  delete_image: {
    label: 'Xóa hình ảnh',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    icon: ImageIcon,
  },
  delete_journal: {
    label: 'Xóa lượt số liệu',
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    icon: Trash2,
  },
  update_journal: {
    label: 'Sửa lượt số liệu',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    icon: Edit3,
  },
}

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '---'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '---'
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

async function recomputeClosedShiftSummary(shiftId: string) {
  const { data: shift } = await (supabase.from('delivery_shifts') as any)
    .select('id, status, system_code, summary_data')
    .eq('id', shiftId)
    .maybeSingle()

  if (!shift || shift.status !== 'closed') return

  const shiftSys = shift.system_code
  const baseSys = shiftSys?.endsWith('__solieu') ? shiftSys.slice(0, -8) : shiftSys
  let q = (supabase.from('delivery_journal') as any)
    .select('id, item_name, unit, quantity_sent, to_department')
    .ilike('notes', `%[CV_ID: ${shiftId}]%`)
  if (shiftSys) {
    q =
      baseSys && baseSys !== shiftSys
        ? q.in('system_code', [shiftSys, baseSys])
        : q.eq('system_code', shiftSys)
  }

  const { data: rows } = await q
  if (!Array.isArray(rows)) return

  const productsSummary: Record<
    string,
    { product_name: string; unit: string; in_qty: number; out_qty: number; count: number }
  > = {}
  const unitsSummary: Record<string, { in_qty: number; out_qty: number; count: number }> = {}

  for (const r of rows) {
    const pName = (r.item_name || 'Sản phẩm').trim()
    const uName = (r.unit || 'Thùng').trim()
    const key = `${pName}___${uName}`
    const qty = Number(r.quantity_sent) || 0
    const isIn = r.to_department === 'Kho'

    if (!productsSummary[key]) {
      productsSummary[key] = { product_name: pName, unit: uName, in_qty: 0, out_qty: 0, count: 0 }
    }
    if (isIn) {
      productsSummary[key].in_qty = Number((productsSummary[key].in_qty + qty).toFixed(2))
    } else {
      productsSummary[key].out_qty = Number((productsSummary[key].out_qty + qty).toFixed(2))
    }
    productsSummary[key].count += 1

    if (!unitsSummary[uName]) {
      unitsSummary[uName] = { in_qty: 0, out_qty: 0, count: 0 }
    }
    if (isIn) {
      unitsSummary[uName].in_qty = Number((unitsSummary[uName].in_qty + qty).toFixed(2))
    } else {
      unitsSummary[uName].out_qty = Number((unitsSummary[uName].out_qty + qty).toFixed(2))
    }
    unitsSummary[uName].count += 1
  }

  const nextSummary = {
    ...(shift.summary_data || {}),
    products_summary: productsSummary,
    units_summary: unitsSummary,
    total_records: rows.length,
  }

  await (supabase.from('delivery_shifts') as any)
    .update({ summary_data: nextSummary })
    .eq('id', shiftId)
}

export default function DuyetThaoTacPage() {
  const { currentSystem } = useSystem()
  const { profile } = useUser()

  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [shiftStatsMap, setShiftStatsMap] = useState<
    Record<
      string,
      {
        status?: string
        journalCount: number
        inQty: number
        outQty: number
        subShiftCount: number
        imageCount: number
      }
    >
  >({})
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [actionFilter, setActionFilter] = useState<'all' | ApprovalRequest['action_type']>('all')
  const [activeMainTab, setActiveMainTab] = useState<'requests' | 'settings'>('requests')

  // State cài đặt nhân viên miễn duyệt
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [bypassMap, setBypassMap] = useState<Record<string, ApprovalBypassSetting>>({})
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [staffSearch, setStaffSearch] = useState('')

  const cleanSystemCode = useMemo(() => {
    const raw = currentSystem?.code || ''
    return raw.endsWith('__solieu') ? raw.slice(0, -8) : raw
  }, [currentSystem?.code])

  const loadBypassSettings = useCallback(async () => {
    if (!cleanSystemCode) return
    setLoadingSettings(true)
    try {
      const companyId = currentSystem?.company_id || profile?.company_id || null
      let staffQuery = (supabase.from('user_profiles') as any)
        .select('id, full_name, email, employee_code, department, is_active')
        .order('full_name', { ascending: true })
      if (companyId) {
        staffQuery = staffQuery.eq('company_id', companyId)
      }
      const [staffRes, settingsRes] = await Promise.all([
        staffQuery,
        (supabase.from('operation_approval_settings') as any)
          .select('*')
          .in('system_code', [cleanSystemCode, `${cleanSystemCode}__solieu`]),
      ])

      const activeStaff = ((staffRes.data || []) as StaffMember[]).filter(u => u.is_active !== false)
      setStaffList(activeStaff)

      const map: Record<string, ApprovalBypassSetting> = {}
      for (const row of (settingsRes.data || []) as ApprovalBypassSetting[]) {
        map[row.user_id] = {
          id: row.id,
          company_id: row.company_id,
          system_code: row.system_code,
          user_id: row.user_id,
          user_name: row.user_name,
          allow_update_journal: Boolean(row.allow_update_journal),
          allow_delete_journal: Boolean(row.allow_delete_journal),
          allow_delete_image: Boolean(row.allow_delete_image),
          allow_delete_shift: Boolean(row.allow_delete_shift),
        }
      }
      setBypassMap(map)
    } catch (err) {
      console.error('Lỗi tải cài đặt miễn duyệt:', err)
    } finally {
      setLoadingSettings(false)
    }
  }, [cleanSystemCode, currentSystem?.company_id, profile?.company_id])

  useEffect(() => {
    void loadBypassSettings()
  }, [loadBypassSettings])

  const updateStaffBypass = async (
    staff: StaffMember,
    patch: Partial<Pick<ApprovalBypassSetting, 'allow_update_journal' | 'allow_delete_journal' | 'allow_delete_image' | 'allow_delete_shift'>>
  ) => {
    if (!cleanSystemCode) return
    const prev = bypassMap[staff.id] || {
      system_code: cleanSystemCode,
      user_id: staff.id,
      user_name: staff.full_name || staff.email || 'Nhân viên',
      allow_update_journal: false,
      allow_delete_journal: false,
      allow_delete_image: false,
      allow_delete_shift: false,
    }
    const next: ApprovalBypassSetting = {
      ...prev,
      ...patch,
      system_code: cleanSystemCode,
      user_id: staff.id,
      user_name: staff.full_name || staff.email || 'Nhân viên',
    }

    setBypassMap(curr => ({ ...curr, [staff.id]: next }))
    setSavingUserId(staff.id)
    try {
      const companyId = currentSystem?.company_id || profile?.company_id || null
      const allOff =
        !next.allow_update_journal &&
        !next.allow_delete_journal &&
        !next.allow_delete_image &&
        !next.allow_delete_shift

      if (allOff) {
        await (supabase.from('operation_approval_settings') as any)
          .delete()
          .eq('user_id', staff.id)
          .in('system_code', [cleanSystemCode, `${cleanSystemCode}__solieu`])
        setBypassMap(curr => {
          const copy = { ...curr }
          delete copy[staff.id]
          return copy
        })
      } else {
        const payload = {
          ...(companyId ? { company_id: companyId } : {}),
          system_code: cleanSystemCode,
          user_id: staff.id,
          user_name: next.user_name,
          allow_update_journal: next.allow_update_journal,
          allow_delete_journal: next.allow_delete_journal,
          allow_delete_image: next.allow_delete_image,
          allow_delete_shift: next.allow_delete_shift,
          updated_by: profile?.id || null,
          updated_at: new Date().toISOString(),
        }
        const { data, error } = await (supabase.from('operation_approval_settings') as any)
          .upsert(payload, { onConflict: 'company_id,system_code,user_id' })
          .select()
          .maybeSingle()
        if (error) throw error
        if (data) {
          setBypassMap(curr => ({ ...curr, [staff.id]: data }))
        }
      }
    } catch (err: any) {
      alert('Lỗi lưu cài đặt miễn duyệt: ' + (err?.message || err))
      void loadBypassSettings()
    } finally {
      setSavingUserId(null)
    }
  }

  const bypassEnabledCount = useMemo(
    () =>
      Object.values(bypassMap).filter(
        s => s.allow_update_journal || s.allow_delete_journal || s.allow_delete_image || s.allow_delete_shift
      ).length,
    [bypassMap]
  )

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase()
    const list = q
      ? staffList.filter(
          u =>
            (u.full_name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.employee_code || '').toLowerCase().includes(q) ||
            (u.department || '').toLowerCase().includes(q)
        )
      : staffList
    // Đưa nhân viên đang được cấp quyền lên đầu cho dễ kiểm soát
    return [...list].sort((a, b) => {
      const aHas = bypassMap[a.id] && (bypassMap[a.id].allow_update_journal || bypassMap[a.id].allow_delete_journal || bypassMap[a.id].allow_delete_image || bypassMap[a.id].allow_delete_shift) ? 1 : 0
      const bHas = bypassMap[b.id] && (bypassMap[b.id].allow_update_journal || bypassMap[b.id].allow_delete_journal || bypassMap[b.id].allow_delete_image || bypassMap[b.id].allow_delete_shift) ? 1 : 0
      if (bHas !== aHas) return bHas - aHas
      return (a.full_name || '').localeCompare(b.full_name || '', 'vi')
    })
  }, [staffList, staffSearch, bypassMap])

  const systemCodes = useMemo(() => {
    const raw = currentSystem?.code
    if (!raw) return []
    const clean = raw.endsWith('__solieu') ? raw.slice(0, -8) : raw
    return [clean, `${clean}__solieu`]
  }, [currentSystem?.code])

  const loadRequests = useCallback(async () => {
    if (systemCodes.length === 0) return
    setLoading(true)
    try {
      const { data, error } = await (supabase.from('operation_approval_requests') as any)
        .select('*')
        .in('system_code', systemCodes)
        .order('requested_at', { ascending: false })
        .limit(300)

      if (error) throw error
      const list = (data || []) as ApprovalRequest[]
      setRequests(list)

      // Tải thống kê dữ liệu thực tế cho các yêu cầu Xóa công việc
      const shiftReqIds = Array.from(
        new Set(
          list
            .filter(r => r.action_type === 'delete_shift' && r.status !== 'approved' && r.target_id)
            .map(r => r.target_id)
        )
      )
      if (shiftReqIds.length > 0) {
        const statsEntries = await Promise.all(
          shiftReqIds.map(async sId => {
            try {
              const [shiftRes, journalRes, subRes, imgRes] = await Promise.all([
                (supabase.from('delivery_shifts') as any)
                  .select('id, status')
                  .eq('id', sId)
                  .maybeSingle(),
                (supabase.from('delivery_journal') as any)
                  .select('id, quantity_sent, to_department')
                  .in('system_code', systemCodes)
                  .ilike('notes', `%[CV_ID: ${sId}]%`),
                (supabase.from('delivery_sub_shifts') as any)
                  .select('id', { count: 'exact', head: true })
                  .eq('shift_id', sId),
                (supabase.from('operation_images') as any)
                  .select('id', { count: 'exact', head: true })
                  .eq('shift_id', sId),
              ])

              const jRows = Array.isArray(journalRes.data) ? journalRes.data : []
              let inQty = 0
              let outQty = 0
              for (const j of jRows) {
                const q = Number(j.quantity_sent) || 0
                if (j.to_department === 'Kho') inQty += q
                else outQty += q
              }

              return [
                sId,
                {
                  status: shiftRes.data?.status,
                  journalCount: jRows.length,
                  inQty: Number(inQty.toFixed(2)),
                  outQty: Number(outQty.toFixed(2)),
                  subShiftCount: subRes.count || 0,
                  imageCount: imgRes.count || 0,
                },
              ] as const
            } catch {
              return null
            }
          })
        )
        const nextMap: Record<string, any> = {}
        for (const entry of statsEntries) {
          if (entry) nextMap[entry[0]] = entry[1]
        }
        setShiftStatsMap(nextMap)
      } else {
        setShiftStatsMap({})
      }
    } catch (e: any) {
      console.error('Lỗi tải danh sách duyệt thao tác:', e)
    } finally {
      setLoading(false)
    }
  }, [systemCodes])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const pendingCount = useMemo(
    () => requests.filter(r => r.status === 'pending').length,
    [requests]
  )

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (actionFilter !== 'all' && r.action_type !== actionFilter) return false
      return true
    })
  }, [requests, statusFilter, actionFilter])

  const executeApproval = async (req: ApprovalRequest) => {
    const nowIso = new Date().toISOString()
    if (req.action_type === 'reopen_shift') {
      const { data: curShift } = await (supabase.from('delivery_shifts') as any)
        .select('id, system_code, summary_data')
        .eq('id', req.target_id)
        .maybeSingle()

      const nextSummary = {
        ...(curShift?.summary_data || {}),
        reopened_at: nowIso,
        reopened_by: profile?.id || null,
        reopened_by_name: profile?.full_name || 'Quản lý',
        reopen_reason: req.reason || null,
      }

      const { error } = await (supabase.from('delivery_shifts') as any)
        .update({
          status: 'open',
          closed_at: null,
          closed_by: null,
          closed_by_name: null,
          summary_data: nextSummary,
        })
        .eq('id', req.target_id)
      if (error) throw error

      // Gỡ đợt chốt cuối tự động lúc Hoàn thành CV (nếu có) để nhân viên nhập tiếp vào đợt hiện tại
      await (supabase.from('delivery_sub_shifts') as any)
        .delete()
        .eq('shift_id', req.target_id)
        .ilike('notes', '%Chốt đợt cuối%(Hoàn thành CV)%')
    } else if (req.action_type === 'delete_shift') {
      await (supabase.from('delivery_journal') as any)
        .delete()
        .ilike('notes', `%[CV_ID: ${req.target_id}]%`)
      await (supabase.from('delivery_sub_shifts') as any)
        .delete()
        .eq('shift_id', req.target_id)
      const { error } = await (supabase.from('delivery_shifts') as any)
        .delete()
        .eq('id', req.target_id)
      if (error) throw error
    } else if (req.action_type === 'delete_image') {
      const storagePath = req.before_data?.storage_path
      if (storagePath) {
        try {
          await supabase.storage.from('operation-images').remove([storagePath])
        } catch {
          // ignore storage cleanup error if already removed
        }
      }
      const { error } = await (supabase.from('operation_images') as any)
        .delete()
        .eq('id', req.target_id)
      if (error) throw error
    } else if (req.action_type === 'delete_journal') {
      const { error } = await (supabase.from('delivery_journal') as any)
        .delete()
        .eq('id', req.target_id)
      if (error) throw error
      if (req.shift_id) {
        await recomputeClosedShiftSummary(req.shift_id)
      }
    } else if (req.action_type === 'update_journal') {
      const patch = req.after_data || {}
      const { error } = await (supabase.from('delivery_journal') as any)
        .update(patch)
        .eq('id', req.target_id)
      if (error) throw error
      if (req.shift_id) {
        await recomputeClosedShiftSummary(req.shift_id)
      }
    }

    const { error: upErr } = await (supabase.from('operation_approval_requests') as any)
      .update({
        status: 'approved',
        reviewed_by: profile?.id || null,
        reviewed_by_name: profile?.full_name || 'Quản lý',
        reviewed_at: nowIso,
      })
      .eq('id', req.id)

    if (upErr) throw upErr
  }

  const handleApprove = async (req: ApprovalRequest) => {
    setProcessingId(req.id)
    try {
      await executeApproval(req)
      setRequests(prev =>
        prev.map(item =>
          item.id === req.id
            ? {
                ...item,
                status: 'approved',
                reviewed_by: profile?.id || null,
                reviewed_by_name: profile?.full_name || 'Quản lý',
                reviewed_at: new Date().toISOString(),
              }
            : item
        )
      )
    } catch (e: any) {
      alert('Lỗi khi duyệt thao tác: ' + (e?.message || e))
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (req: ApprovalRequest) => {
    setProcessingId(req.id)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await (supabase.from('operation_approval_requests') as any)
        .update({
          status: 'rejected',
          reviewed_by: profile?.id || null,
          reviewed_by_name: profile?.full_name || 'Quản lý',
          reviewed_at: nowIso,
        })
        .eq('id', req.id)
      if (error) throw error

      setRequests(prev =>
        prev.map(item =>
          item.id === req.id
            ? {
                ...item,
                status: 'rejected',
                reviewed_by: profile?.id || null,
                reviewed_by_name: profile?.full_name || 'Quản lý',
                reviewed_at: nowIso,
              }
            : item
        )
      )
    } catch (e: any) {
      alert('Lỗi khi từ chối: ' + (e?.message || e))
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveAllVisible = async () => {
    const pendingList = filteredRequests.filter(r => r.status === 'pending')
    if (pendingList.length === 0) return
    if (
      !window.confirm(
        `Xác nhận DUYỆT & THỰC THI toàn bộ ${pendingList.length} yêu cầu đang hiển thị?`
      )
    ) {
      return
    }
    setBulkProcessing(true)
    try {
      for (const req of pendingList) {
        await executeApproval(req)
      }
      await loadRequests()
    } catch (e: any) {
      alert('Có lỗi trong quá trình duyệt hàng loạt: ' + (e?.message || e))
      await loadRequests()
    } finally {
      setBulkProcessing(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            <span>Duyệt thao tác</span>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-extrabold">
                {pendingCount} chờ duyệt
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Công việc đang mở có thể cấp quyền miễn duyệt cho từng nhân viên. Công việc <b>đã hoàn thành</b> bắt buộc phải được duyệt <b>Mở lại công việc</b> tại đây trước khi thêm/sửa/xóa ({currentSystem?.name || currentSystem?.code}).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeMainTab === 'requests' && statusFilter === 'pending' && filteredRequests.length > 0 && (
            <button
              type="button"
              disabled={bulkProcessing}
              onClick={() => void handleApproveAllVisible()}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition"
            >
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Duyệt tất cả ({filteredRequests.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void (activeMainTab === 'requests' ? loadRequests() : loadBypassSettings())}
            className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-xs font-bold text-stone-700 dark:text-stone-200 hover:border-indigo-400 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(activeMainTab === 'requests' ? loading : loadingSettings) ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Thanh chuyển 2 khu vực chính: Danh sách duyệt vs Cài đặt nhân viên miễn duyệt */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveMainTab('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition ${
            activeMainTab === 'requests'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-stone-300 hover:border-indigo-300'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Yêu cầu chờ duyệt</span>
          {pendingCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeMainTab === 'requests' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'}`}>
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition ${
            activeMainTab === 'settings'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-stone-300 hover:border-emerald-400'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cài đặt nhân viên miễn duyệt</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeMainTab === 'settings' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
            {bypassEnabledCount} NV
          </span>
        </button>
      </div>

      {activeMainTab === 'settings' ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-stone-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Danh sách nhân viên được sửa / xóa không cần duyệt</span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Áp dụng cho phân hệ <b>{currentSystem?.name || cleanSystemCode}</b> trên cả App Mobile &amp; Web Scanner. Bật quyền nào thì nhân viên thao tác trực tiếp ngay không cần chờ duyệt.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                placeholder="Tìm tên, email, mã NV..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-700 text-xs text-stone-800 dark:text-stone-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {loadingSettings ? (
            <div className="py-12 text-center text-stone-500 text-xs flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Đang tải danh sách nhân viên...</span>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-12 text-center text-stone-500 text-xs">
              Không tìm thấy nhân viên phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 dark:bg-zinc-950/60 border-b border-stone-200 dark:border-zinc-800 text-[11px] font-extrabold text-stone-500 dark:text-stone-400 uppercase">
                    <th className="py-2.5 px-4">Nhân viên</th>
                    <th className="py-2.5 px-3 text-center">Sửa số liệu</th>
                    <th className="py-2.5 px-3 text-center">Xóa số liệu</th>
                    <th className="py-2.5 px-3 text-center">Xóa ảnh</th>
                    <th className="py-2.5 px-3 text-center">Xóa công việc</th>
                    <th className="py-2.5 px-4 text-right">Bật / Tắt hết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/80 text-xs">
                  {filteredStaff.map(staff => {
                    const cfg = bypassMap[staff.id]
                    const uEdit = Boolean(cfg?.allow_update_journal)
                    const uDelJournal = Boolean(cfg?.allow_delete_journal)
                    const uDelImg = Boolean(cfg?.allow_delete_image)
                    const uDelShift = Boolean(cfg?.allow_delete_shift)
                    const allOn = uEdit && uDelJournal && uDelImg && uDelShift
                    const anyOn = uEdit || uDelJournal || uDelImg || uDelShift
                    const isSaving = savingUserId === staff.id

                    return (
                      <tr
                        key={staff.id}
                        className={`transition ${anyOn ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : 'hover:bg-stone-50 dark:hover:bg-zinc-800/40'}`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                            <span>{staff.full_name || 'Chưa đặt tên'}</span>
                            {anyOn && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                                Miễn duyệt
                              </span>
                            )}
                            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            {[staff.employee_code, staff.email, staff.department].filter(Boolean).join(' • ') || '---'}
                          </div>
                        </td>
                        {([
                          { key: 'allow_update_journal', val: uEdit },
                          { key: 'allow_delete_journal', val: uDelJournal },
                          { key: 'allow_delete_image', val: uDelImg },
                          { key: 'allow_delete_shift', val: uDelShift },
                        ] as const).map(col => (
                          <td key={col.key} className="py-3 px-3 text-center">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void updateStaffBypass(staff, { [col.key]: !col.val })}
                              className={`w-10 h-6 rounded-full p-0.5 transition inline-flex items-center cursor-pointer disabled:opacity-50 ${
                                col.val
                                  ? 'bg-emerald-600 justify-end'
                                  : 'bg-stone-200 dark:bg-zinc-700 justify-start'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
                            </button>
                          </td>
                        ))}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              void updateStaffBypass(staff, {
                                allow_update_journal: !allOn,
                                allow_delete_journal: !allOn,
                                allow_delete_image: !allOn,
                                allow_delete_shift: !allOn,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition disabled:opacity-50 ${
                              allOn
                                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {allOn ? 'Tắt hết' : 'Cho tất cả'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Bộ lọc trạng thái & loại thao tác */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-stone-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'pending', label: `Chờ duyệt (${pendingCount})` },
            { id: 'approved', label: 'Đã duyệt' },
            { id: 'rejected', label: 'Đã từ chối' },
            { id: 'all', label: 'Tất cả' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'Mọi loại' },
            { id: 'reopen_shift', label: 'Mở lại CV' },
            { id: 'delete_shift', label: 'Xóa công việc' },
            { id: 'delete_image', label: 'Xóa ảnh' },
            { id: 'update_journal', label: 'Sửa số liệu' },
            { id: 'delete_journal', label: 'Xóa số liệu' },
          ].map(act => (
            <button
              key={act.id}
              type="button"
              onClick={() => setActionFilter(act.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                actionFilter === act.id
                  ? 'bg-amber-500 border-amber-500 text-slate-950'
                  : 'bg-white dark:bg-zinc-950 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300'
              }`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách yêu cầu */}
      {loading ? (
        <div className="py-16 text-center text-stone-500 text-sm flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Đang tải danh sách yêu cầu duyệt...</span>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-stone-200 dark:border-zinc-800">
          <ShieldCheck className="w-10 h-10 text-stone-300 dark:text-zinc-700 mx-auto mb-2" />
          <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
            Không có yêu cầu nào trong mục này
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(req => {
            const meta = ACTION_META[req.action_type]
            const Icon = meta.icon
            const isBusy = processingId === req.id

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {req.action_type === 'delete_image' && req.before_data?.image_url ? (
                    <img
                      src={req.before_data.image_url}
                      alt={req.target_label || 'Ảnh chờ xóa'}
                      className="w-16 h-16 rounded-xl object-cover border border-stone-200 dark:border-zinc-700 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-stone-600 dark:text-stone-300">
                      <Icon className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                        {req.source_device === 'mobile_app' ? (
                          <Smartphone className="w-3 h-3" />
                        ) : (
                          <Monitor className="w-3 h-3" />
                        )}
                        {req.source_device === 'mobile_app'
                          ? 'App Mobile'
                          : req.source_device === 'scanner'
                          ? 'Web Scanner'
                          : 'Web'}
                      </span>
                      {req.status === 'approved' && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                          Đã duyệt
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-700 text-[11px] font-bold">
                          Đã từ chối
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-stone-900 dark:text-white break-words">
                      {req.target_label || req.shift_name || req.target_id}
                    </div>

                    {req.shift_name && (
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        Công việc: <b className="text-stone-700 dark:text-stone-200">{req.shift_name}</b>
                      </div>
                    )}

                    {/* Hiển thị tình trạng dữ liệu của công việc khi yêu cầu Xóa công việc */}
                    {req.action_type === 'delete_shift' && (() => {
                      const stats = shiftStatsMap[req.target_id]
                      if (!stats) {
                        if (req.status === 'approved') {
                          return (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-zinc-800 text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                              <span>Công việc đã được xóa khỏi hệ thống</span>
                            </div>
                          )
                        }
                        return null
                      }
                      const hasData =
                        stats.journalCount > 0 || stats.subShiftCount > 0 || stats.imageCount > 0
                      return (
                        <div
                          className={`text-xs rounded-xl px-3 py-2 border flex flex-wrap items-center gap-x-2.5 gap-y-1 ${
                            hasData
                              ? 'bg-rose-50 dark:bg-rose-950/35 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200'
                              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200'
                          }`}
                        >
                          <span className="font-extrabold">
                            {hasData ? '⚠️ Đã có dữ liệu:' : '✓ Chưa có dữ liệu'}
                          </span>
                          <span>
                            <b>{stats.journalCount}</b> đợt N/X
                            {stats.journalCount > 0 && (
                              <>
                                {' '}
                                (<span className="text-emerald-700 dark:text-emerald-300 font-bold">+{stats.inQty}</span>
                                {' / '}
                                <span className="text-rose-700 dark:text-rose-300 font-bold">-{stats.outQty}</span>)
                              </>
                            )}
                          </span>
                          {stats.subShiftCount > 0 && (
                            <span>• <b>{stats.subShiftCount}</b> lần chốt tạm</span>
                          )}
                          {stats.imageCount > 0 && (
                            <span>• <b>{stats.imageCount}</b> ảnh</span>
                          )}
                          {stats.status && (
                            <span className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-zinc-900/70 text-[10px] font-bold">
                              {stats.status === 'closed' ? 'Đã hoàn thành' : 'Đang mở'}
                            </span>
                          )}
                        </div>
                      )
                    })()}

                    {/* Hiển thị chi tiết trước -> sau cho sửa/xóa số liệu */}
                    {(req.action_type === 'update_journal' || req.action_type === 'delete_journal') &&
                      req.before_data && (
                        <div className="text-xs bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800 rounded-xl p-2.5 flex flex-wrap items-center gap-2">
                          <span>
                            {req.before_data.to_department === 'Kho' ? 'Nhập (+)' : 'Xuất (-)'}:{' '}
                            <b>
                              {req.before_data.quantity_sent} {req.before_data.unit}
                            </b>
                          </span>
                          {req.action_type === 'update_journal' && req.after_data && (
                            <>
                              <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-amber-700 dark:text-amber-300 font-bold">
                                {req.after_data.to_department === 'Kho' ? 'Nhập (+)' : 'Xuất (-)'}:{' '}
                                {req.after_data.quantity_sent} {req.after_data.unit}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                    <div className="text-[11px] text-stone-500 dark:text-stone-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Gửi lúc {formatDateTime(req.requested_at)} bởi{' '}
                        <b className="text-stone-700 dark:text-stone-200">
                          {req.requested_by_name || 'Nhân viên'}
                        </b>
                      </span>
                      {req.reviewed_at && (
                        <span>
                          • Duyệt lúc {formatDateTime(req.reviewed_at)} bởi{' '}
                          <b>{req.reviewed_by_name || 'Quản lý'}</b>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy || bulkProcessing}
                      onClick={() => void handleReject(req)}
                      className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition"
                    >
                      <XCircle className="w-4 h-4 text-rose-500" />
                      <span>Từ chối</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || bulkProcessing}
                      onClick={() => void handleApprove(req)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50 transition"
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Duyệt &amp; Thực thi</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
        </>
      )}
    </div>
  )
}

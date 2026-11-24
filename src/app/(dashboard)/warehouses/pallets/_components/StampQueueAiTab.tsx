'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Trash2,
  PackagePlus,
  PackageCheck,
  Zap,
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
  Check,
  X,
  ExternalLink,
  Cloud,
  FileCode2,
  Copy,
  FolderSync,
  Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { DEFAULT_STAMP_DICT, decodeStampBox, parseGeminiApiKeys } from '@/lib/stampDecoder'
import { STAMP_GOOGLE_APPS_SCRIPT_TEMPLATE } from '@/lib/stampDriveUpload'

interface StampQueueItem {
  id: string
  system_code: string
  pallet_stt: string
  pallet_tag?: string | null
  pallet_notes?: string | null
  box_count: number
  box_weight: number
  image_url: string
  cropped_image_url?: string | null
  drive_file_id?: string | null
  drive_view_url?: string | null
  approved_lot_code?: string | null
  stamp_line1?: string | null
  stamp_line2?: string | null
  decoded_json?: any
  status: 'pending' | 'decoded' | 'approved' | 'error'
  error_message?: string | null
  created_by_name?: string | null
  created_at: string
}

interface StampQueueAiTabProps {
  visible: boolean
  stampDictMap?: Record<string, Record<string, string>>
  onPendingCountChange?: (count: number) => void
  onApproved?: () => void
}

export function StampQueueAiTab({
  visible,
  stampDictMap = DEFAULT_STAMP_DICT,
  onPendingCountChange,
  onApproved,
}: StampQueueAiTabProps) {
  const { currentSystem } = useSystem()
  const systemCode = currentSystem?.code || 'KHO_DONG_LANH'

  // Cấu hình Gemini API Key
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('gemini-3.5-flash')
  const [isEnabled, setIsEnabled] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [hasSavedKey, setHasSavedKey] = useState(false)

  // Cấu hình Google Apps Script Webhook (Tài khoản Google riêng)
  const [driveWebhookUrl, setDriveWebhookUrl] = useState('')
  const [testingDrive, setTestingDrive] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Danh sách hàng đợi ảnh
  const [items, setItems] = useState<StampQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'decoded' | 'approved'>('all')
  const [dateFilter, setDateFilter] = useState<string>('') // '' = tất cả, hoặc 'YYYY-MM-DD'
  const [decodingAll, setDecodingAll] = useState(false)
  const [decodingId, setDecodingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approvingAll, setApprovingAll] = useState(false)
  const [autoApproveOnDecode, setAutoApproveOnDecode] = useState(false)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Khôi phục cờ Tự Động Duyệt từ localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stamp_auto_approve_after_decode')
      if (saved === 'true') {
        setAutoApproveOnDecode(true)
      }
    }
  }, [])

  const handleToggleAutoApprove = (val: boolean) => {
    setAutoApproveOnDecode(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('stamp_auto_approve_after_decode', val ? 'true' : 'false')
    }
    if (val) {
      notify('⚡ Đã BẬT Tự Động Duyệt: AI đọc số xong sẽ tự động tạo thùng vào kho!')
    } else {
      notify('Đã TẮT Tự Động Duyệt: Chuyển về chế độ xem lại trước khi duyệt.')
    }
  }

  const notify = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const loadAiConfig = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from('company_ai_settings')
        .select('gemini_api_key, gemini_model, is_enabled, drive_webhook_url')
        .limit(1)
        .maybeSingle()

      if (data) {
        setApiKey(data.gemini_api_key || '')
        setModelName(data.gemini_model || 'gemini-2.5-flash')
        setIsEnabled(data.is_enabled !== false)
        setDriveWebhookUrl(data.drive_webhook_url || '')
        setHasSavedKey(!!data.gemini_api_key)
      }
    } catch (e) {
      console.warn('Không tải được company_ai_settings:', e)
    }
  }, [])

  const getTodayStr = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const getYesterdayStr = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const loadQueue = useCallback(async (targetDate?: string) => {
    setLoading(true)
    try {
      const activeDate = targetDate !== undefined ? targetDate : dateFilter
      let query = (supabase as any)
        .from('stamp_scan_queue')
        .select('*')
        .eq('system_code', systemCode)
        .order('created_at', { ascending: false })

      if (activeDate) {
        const start = new Date(`${activeDate}T00:00:00`)
        const end = new Date(`${activeDate}T23:59:59.999`)
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
      } else {
        query = query.limit(150)
      }

      const { data, error } = await query

      if (error) throw error
      const list: StampQueueItem[] = data || []
      setItems(list)
      if (onPendingCountChange) {
        onPendingCountChange(list.filter(i => i.status !== 'approved').length)
      }
    } catch (e: any) {
      console.warn('Lỗi tải stamp_scan_queue:', e?.message)
    } finally {
      setLoading(false)
    }
  }, [systemCode, onPendingCountChange, dateFilter])

  useEffect(() => {
    loadAiConfig()
    loadQueue()
  }, [loadAiConfig, loadQueue])

  // Lắng nghe Realtime thay đổi từ stamp_scan_queue để tự động cập nhật
  useEffect(() => {
    const channel = supabase
      .channel('stamp_queue_realtime_tab')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stamp_scan_queue', filter: `system_code=eq.${systemCode}` },
        () => {
          loadQueue()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [systemCode, loadQueue])

  const handleSaveAiKey = async () => {
    setSavingKey(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || null

      const { data: profile } = userId
        ? await supabase
            .from('user_profiles')
            .select('company_id')
            .eq('id', userId)
            .maybeSingle()
        : { data: null }

      const companyId = (profile as any)?.company_id || null
      if (!companyId) {
        throw new Error('Không xác định được company_id tài khoản hiện tại')
      }

      const { error } = await (supabase as any).from('company_ai_settings').upsert(
        {
          company_id: companyId,
          gemini_api_key: apiKey.trim() || null,
          gemini_model: modelName.trim() || 'gemini-2.5-flash',
          is_enabled: isEnabled,
          drive_webhook_url: driveWebhookUrl.trim() || null,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      )

      if (error) throw error
      setHasSavedKey(!!apiKey.trim())
      notify('✅ Đã lưu cấu hình Gemini AI & Google Drive Webhook!')
    } catch (e: any) {
      alert(`Lỗi lưu cấu hình: ${e.message}`)
    } finally {
      setSavingKey(false)
    }
  }

  const handleTestDriveConnection = async () => {
    if (!driveWebhookUrl.trim()) {
      alert('Vui lòng dán Google Apps Script Webhook URL trước khi kiểm tra!')
      return
    }

    setTestingDrive(true)
    try {
      const res = await fetch('/api/stamp-queue/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          webhookUrl: driveWebhookUrl.trim(),
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        notify('🎉 Kết nối Google Drive thành công! Thư mục gốc: CON_DAU')
      } else {
        alert(`Kiểm tra thất bại: ${data.error || 'Không kết nối được'}`)
      }
    } catch (err: any) {
      alert(`Lỗi kiểm tra Google Drive: ${err.message}`)
    } finally {
      setTestingDrive(false)
    }
  }

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(STAMP_GOOGLE_APPS_SCRIPT_TEMPLATE)
    setCopiedCode(true)
    notify('📋 Đã sao chép mã nguồn Google Apps Script vào bộ nhớ tạm!')
    setTimeout(() => setCopiedCode(false), 3000)
  }

  const handleDecodeGemini = async (ids?: string[]) => {
    if (ids && ids.length === 1) {
      setDecodingId(ids[0])
    } else {
      setDecodingAll(true)
    }

    try {
      const res = await fetch('/api/stamp-queue/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, systemCode }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Giải mã thất bại')
      }

      const decodedCount = Number(json.decodedCount ?? json.count ?? 0)
      const errorCount = Number(json.errorCount ?? 0)

      if (decodedCount > 0) {
        notify(`✅ Đã giải mã thành công ${decodedCount} ảnh bằng Gemini AI!`)

        // Nếu bật chế độ TỰ ĐỘNG DUYỆT: Tự động tạo thùng ngay lập tức
        if (autoApproveOnDecode) {
          try {
            const { data: freshlyDecoded } = await (supabase as any)
              .from('stamp_scan_queue')
              .select('*')
              .eq('system_code', systemCode)
              .eq('status', 'decoded')
              .not('stamp_line1', 'is', null)
              .not('stamp_line2', 'is', null)

            if (Array.isArray(freshlyDecoded) && freshlyDecoded.length > 0) {
              notify(`⚡ Đang tự động duyệt & tạo thùng cho ${freshlyDecoded.length} Pallet...`)
              let autoOk = 0
              for (const it of freshlyDecoded) {
                try {
                  await approveSingleQueueItem(it)
                  autoOk++
                } catch (autoErr) {
                  console.warn('Lỗi tự động duyệt Pallet:', it.pallet_stt, autoErr)
                }
              }
              if (autoOk > 0) {
                notify(`🎉 Đã tự động duyệt thành công ${autoOk} Pallet vào kho!`)
                if (onApproved) onApproved()
              }
            }
          } catch (autoErr) {
            console.warn('Lỗi tiến trình tự động duyệt:', autoErr)
          }
        }
      } else if (errorCount > 0) {
        alert(`Không giải mã được ảnh (${errorCount} lỗi). Vui lòng kiểm tra lại ảnh hoặc Key.`)
      } else {
        notify('Không có ảnh nào cần giải mã.')
      }
      await loadQueue()
    } catch (e: any) {
      alert(`Lỗi giải mã: ${e.message}`)
    } finally {
      setDecodingId(null)
      setDecodingAll(false)
    }
  }

  const handleUpdateItemLines = async (id: string, line1: string, line2: string) => {
    const decoded = decodeStampBox(
      { metadata: { scan_type: 'stamp', stamp_line1: line1, stamp_line2: line2 } },
      stampDictMap
    )

    setItems(prev =>
      prev.map(it =>
        it.id === id
          ? {
              ...it,
              stamp_line1: line1,
              stamp_line2: line2,
              decoded_json: decoded,
              status: line1 && line2 ? 'decoded' : it.status,
            }
          : it
      )
    )

    await (supabase as any)
      .from('stamp_scan_queue')
      .update({ stamp_line1: line1, stamp_line2: line2, decoded_json: decoded })
      .eq('id', id)
  }

  const approveSingleQueueItem = async (item: StampQueueItem) => {
    const l1 = (item.stamp_line1 || '').trim()
    const l2 = (item.stamp_line2 || '').trim()
    if (!l1 && !l2) {
      throw new Error(`Pallet ${item.pallet_stt} chưa có Dòng 1 / Dòng 2`)
    }

    const cleanStt = item.pallet_stt.trim().toUpperCase()
    const dec = decodeStampBox(
      { metadata: { scan_type: 'stamp', stamp_line1: l1, stamp_line2: l2 } },
      stampDictMap
    )

    const { data: existingBoxes } = await supabase
      .from('box_labels')
      .select('metadata')
      .filter('metadata->>pallet_stt', 'eq', cleanStt)

    let startIdx = 1
    if (Array.isArray(existingBoxes) && existingBoxes.length > 0) {
      const maxIdx = Math.max(
        ...existingBoxes.map((b: any) => parseInt(b?.metadata?.box_index, 10) || 0)
      )
      if (maxIdx > 0) startIdx = maxIdx + 1
    }

    const count = Number(item.box_count) || 30
    const weight = Number(item.box_weight) || 20
    const rowsToInsert = []

    for (let i = 0; i < count; i++) {
      const idx = startIdx + i
      rowsToInsert.push({
        code: `STAMP-${l1}-${l2}-${cleanStt}-${String(idx).padStart(3, '0')}`,
        quantity: weight,
        unit: 'Kg',
        semi_finished_lot_code: l2,
        finished_lot_code: l2,
        system_code: systemCode,
        status: 'printed',
        metadata: {
          pallet_stt: cleanStt,
          pallet_tag: item.pallet_tag || undefined,
          pallet_notes: item.pallet_notes || undefined,
          scan_type: 'stamp',
          stamp_line1: l1,
          stamp_line2: l2,
          box_index: idx,
          sku: dec.isSpecial12 ? dec.special12Code : dec.code || 'SKU',
          product_name:
            dec.productTitle || (dec.isSpecial12 ? dec.special12Name : 'Sản phẩm đóng dấu'),
          spec: dec.spec || 'Ngoại lệ trọn gói',
          shift_group: dec.factoryName,
          region: dec.provinceName,
          production_date: dec.rawMaterialDateStr,
          raw_material_date: dec.rawMaterialDateStr,
          packaging_date: dec.packagingDateStr,
          supplier: dec.supplierCode,
          is_special_12: dec.isSpecial12,
          special_12_code: dec.special12Code,
          special_12_name: dec.special12Name,
          source_queue_id: item.id,
          // Đính kèm thông tin Google Drive ảnh gốc vào từng thùng hàng
          stamp_image_url: item.image_url,
          drive_file_id: item.drive_file_id || undefined,
          drive_view_url: item.drive_view_url || undefined,
        },
      })
    }

    const { error: insertErr } = await supabase.from('box_labels').insert(rowsToInsert as any)
    if (insertErr) throw insertErr

    const { data: userData } = await supabase.auth.getUser()
    await (supabase as any)
      .from('stamp_scan_queue')
      .update({
        status: 'approved',
        approved_by: userData?.user?.id || null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', item.id)
  }

  const handleApproveAndCreateBoxes = async (item: StampQueueItem) => {
    setApprovingId(item.id)
    try {
      await approveSingleQueueItem(item)
      notify(`✅ Đã duyệt & tạo ${item.box_count} thùng vào Pallet ${item.pallet_stt}! (Đã gắn ảnh Google Drive)`)
      await loadQueue()
      if (onApproved) {
        onApproved()
      }
    } catch (e: any) {
      alert(`Lỗi duyệt tạo thùng: ${e.message}`)
    } finally {
      setApprovingId(null)
    }
  }

  const handleApproveAllDecoded = async () => {
    const decodedItems = items.filter(
      it => (it.status === 'decoded' || (it.stamp_line1 && it.stamp_line2)) && it.status !== 'approved'
    )
    if (decodedItems.length === 0) {
      alert('Không có Pallet nào đã giải mã xong để duyệt!')
      return
    }

    const ok = confirm(`Duyệt & Tạo thùng tự động cho TẤT CẢ ${decodedItems.length} Pallet đã đọc số?`)
    if (!ok) return

    setApprovingAll(true)
    let okCount = 0
    let errCount = 0

    for (const item of decodedItems) {
      try {
        await approveSingleQueueItem(item)
        okCount++
      } catch (e) {
        console.error('Approve error item:', item.pallet_stt, e)
        errCount++
      }
    }

    setApprovingAll(false)
    await loadQueue()
    if (onApproved) onApproved()

    if (errCount === 0) {
      notify(`🎉 Đã duyệt và tạo thùng thành công cho tất cả ${okCount} Pallet!`)
    } else {
      alert(`Đã duyệt: ${okCount} thành công, ${errCount} thất bại.`)
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Xóa ảnh này khỏi hàng đợi?')) return
    await (supabase as any).from('stamp_scan_queue').delete().eq('id', id)
    await loadQueue()
  }

  const handleApproveGroup = async (group: {
    key: string
    pallet_stt: string
    total_boxes: number
    items: StampQueueItem[]
  }) => {
    setApprovingId(group.key)
    try {
      let createdBoxes = 0
      for (const item of group.items) {
        if (item.status !== 'approved') {
          await approveSingleQueueItem(item)
          createdBoxes += Number(item.box_count) || 30
        }
      }
      notify(`🎉 Đã duyệt & tạo ${createdBoxes} thùng (${group.items.length} đợt con dấu) cho Pallet STT ${group.pallet_stt}!`)
      await loadQueue()
      if (onApproved) {
        onApproved()
      }
    } catch (e: any) {
      alert(`Lỗi duyệt tạo thùng: ${e.message}`)
    } finally {
      setApprovingId(null)
    }
  }

  const handleDeleteGroup = async (group: {
    key: string
    pallet_stt: string
    items: StampQueueItem[]
  }) => {
    if (!confirm(`Xóa toàn bộ ${group.items.length} đợt con dấu của Pallet STT ${group.pallet_stt}?`)) return
    const ids = group.items.map(i => i.id)
    await (supabase as any).from('stamp_scan_queue').delete().in('id', ids)
    await loadQueue()
  }

  if (!visible) return null

  const filteredItems = items.filter(it => {
    if (dateFilter) {
      const itemDate = new Date(it.created_at)
      const y = itemDate.getFullYear()
      const m = String(itemDate.getMonth() + 1).padStart(2, '0')
      const d = String(itemDate.getDate()).padStart(2, '0')
      const itemDateStr = `${y}-${m}-${d}`
      if (itemDateStr !== dateFilter) return false
    }
    if (statusFilter === 'all') return true
    if (statusFilter === 'pending') return it.status === 'pending' || it.status === 'error'
    return it.status === statusFilter
  })

  // Gom nhóm các con dấu theo pallet_stt để 1 Pallet nhiều sản phẩm cùng nằm trong 1 Thẻ duyệt
  const groupedFilteredItems = items.length === 0 ? [] : (() => {
    const map = new Map<string, {
      key: string
      pallet_stt: string
      pallet_tag?: string | null
      pallet_notes?: string | null
      total_boxes: number
      total_weight: number
      created_by_name?: string | null
      created_at: string
      items: StampQueueItem[]
      all_approved: boolean
      all_decoded: boolean
      has_error: boolean
    }>()

    for (const item of filteredItems) {
      const key = (item.pallet_stt || '').trim().toUpperCase() || item.id
      if (!map.has(key)) {
        map.set(key, {
          key,
          pallet_stt: item.pallet_stt,
          pallet_tag: item.pallet_tag,
          pallet_notes: item.pallet_notes,
          total_boxes: 0,
          total_weight: 0,
          created_by_name: item.created_by_name,
          created_at: item.created_at,
          items: [],
          all_approved: true,
          all_decoded: true,
          has_error: false,
        })
      }
      const g = map.get(key)!
      const count = Number(item.box_count) || 30
      const weight = Number(item.box_weight) || 20
      g.total_boxes += count
      g.total_weight += count * weight
      g.items.push(item)

      if (!g.pallet_tag && item.pallet_tag) g.pallet_tag = item.pallet_tag
      if (!g.pallet_notes && item.pallet_notes) g.pallet_notes = item.pallet_notes
      if (item.status !== 'approved') g.all_approved = false
      if (item.status !== 'decoded' && (!item.stamp_line1 || !item.stamp_line2)) g.all_decoded = false
      if (item.status === 'error') g.has_error = true
    }
    return Array.from(map.values())
  })()

  const isSameDate = (isoStr?: string | null, targetYmd?: string) => {
    if (!isoStr || !targetYmd) return false
    const d = new Date(isoStr)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}` === targetYmd
  }

  const filteredByDateItems = items.filter(i => !dateFilter || isSameDate(i.created_at, dateFilter))
  const pendingOrErrorCount = filteredByDateItems.filter(i => i.status === 'pending' || i.status === 'error').length
  const decodedCount = filteredByDateItems.filter(i => (i.status === 'decoded' || (i.stamp_line1 && i.stamp_line2)) && i.status !== 'approved').length

  return (
    <div className="space-y-5">
      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold flex items-center gap-2 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. THANH TRẠNG THÁI GỌN (Quản lý chi tiết tại /integrations) */}
      <div className="px-4 py-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-800/70 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles size={16} className="text-amber-300" />
          </div>
          <span className="text-xs font-extrabold text-slate-800 dark:text-white">
            AI Đọc Dấu &amp; Drive:
          </span>
          {hasSavedKey && isEnabled ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-[11px] font-bold">
              AI Đang bật ({parseGeminiApiKeys(apiKey).length} Key · {modelName})
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
              Chưa bật Gemini AI
            </span>
          )}
          {driveWebhookUrl.trim() && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1">
              <Cloud size={11} /> Google Drive
            </span>
          )}
        </div>
        <a
          href="/integrations"
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all"
        >
          Quản lý tại Kết nối AI &amp; Drive →
        </a>
      </div>

      {/* 2. Thanh công cụ & Bộ lọc hàng đợi */}
      <div className="flex flex-col gap-3 p-3.5 bg-slate-50/90 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Nhóm Bộ lọc Trạng thái */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Tất cả ({filteredByDateItems.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
              }`}
            >
              Chờ giải mã ({pendingOrErrorCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('decoded')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'decoded'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
              }`}
            >
              Đã đọc số ({filteredByDateItems.filter(i => i.status === 'decoded').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
              }`}
            >
              Đã duyệt thùng ({filteredByDateItems.filter(i => i.status === 'approved').length})
            </button>
          </div>

          {/* Nhóm Bộ lọc Ngày */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
              <Calendar size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>Lọc ngày:</span>
            </div>
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setDateFilter('')
                  loadQueue('')
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  !dateFilter
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = getTodayStr()
                  setDateFilter(today)
                  loadQueue(today)
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dateFilter === getTodayStr()
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => {
                  const yest = getYesterdayStr()
                  setDateFilter(yest)
                  loadQueue(yest)
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dateFilter === getYesterdayStr()
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Hôm qua
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <input
                type="date"
                value={dateFilter}
                onChange={e => {
                  const val = e.target.value
                  setDateFilter(val)
                  loadQueue(val)
                }}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('')
                    loadQueue('')
                  }}
                  className="p-0.5 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                  title="Xóa lọc ngày"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hàng nút tác vụ (Tự động duyệt, Duyệt tất cả, Tải lại, Giải mã Gemini) */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/70">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Nút bật/tắt TỰ ĐỘNG DUYỆT */}
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                autoApproveOnDecode
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
              title="Khi bật: Gemini AI giải mã xong sẽ TỰ ĐỘNG Duyệt & Tạo Thùng vào kho luôn mà không cần bấm tay!"
            >
              <input
                type="checkbox"
                checked={autoApproveOnDecode}
                onChange={e => handleToggleAutoApprove(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 accent-amber-600 cursor-pointer"
              />
              <Zap size={14} className={autoApproveOnDecode ? 'text-amber-500 fill-amber-500 animate-pulse' : 'text-slate-400'} />
              <span>Tự động duyệt khi AI đọc</span>
            </label>

            {/* Nút DUYỆT TẤT CẢ ĐÃ ĐỌC */}
            {decodedCount > 0 && (
              <button
                type="button"
                onClick={handleApproveAllDecoded}
                disabled={approvingAll}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                title="Duyệt và tạo thùng cho toàn bộ các Pallet đã được giải mã"
              >
                {approvingAll ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <PackageCheck size={14} />
                )}
                <span>Duyệt tất cả đã đọc ({decodedCount})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadQueue()}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition"
              title="Tải lại danh sách"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => handleDecodeGemini()}
              disabled={decodingAll || pendingOrErrorCount === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {decodingAll ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} className="text-amber-300" />
            )}
            <span>Giải mã tất cả bằng Gemini ({pendingOrErrorCount})</span>
          </button>
        </div>
      </div>
    </div>

      {/* 3. Danh sách thẻ ảnh gửi lên từ kho (Gom nhóm theo STT Pallet) */}
      {groupedFilteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
          <ImageIcon size={40} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold">Hiện chưa có ảnh con dấu nào trong hàng đợi.</p>
          <p className="text-xs text-slate-500 mt-1">
            Khi công nhân bấm "Gửi Server" trên Web Scanner hoặc App Android, ảnh sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedFilteredItems.map(group => {
            if (group.items.length === 1) {
              const item = group.items[0]
              const dec =
                item.decoded_json ||
                decodeStampBox(
                  {
                    metadata: {
                      scan_type: 'stamp',
                      stamp_line1: item.stamp_line1,
                      stamp_line2: item.stamp_line2,
                    },
                  },
                  stampDictMap
                )

              const isGoogleDriveImage = !!item.drive_file_id || item.image_url?.includes('drive.google.com')

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail ảnh */}
                    <div
                      onClick={() => setZoomImageUrl(item.image_url)}
                      className="w-28 h-28 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden relative cursor-zoom-in shrink-0 border border-slate-200 dark:border-slate-700 group"
                    >
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            item.cropped_image_url && !item.cropped_image_url.includes('drive.google.com/file/d/')
                              ? item.cropped_image_url
                              : item.drive_file_id
                              ? `https://lh3.googleusercontent.com/d/${item.drive_file_id}`
                              : item.image_url
                          }
                          alt="Con dấu"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (item.drive_file_id) {
                              const target = e.target as HTMLImageElement
                              if (!target.dataset.tried) {
                                target.dataset.tried = '1'
                                target.src = `https://drive.google.com/thumbnail?id=${item.drive_file_id}&sz=w600`
                              }
                            }
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <ImageIcon size={24} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                        Phóng to
                      </div>
                      {isGoogleDriveImage && (
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-blue-600/90 text-white text-[9px] font-bold flex items-center gap-0.5">
                          <Cloud size={10} />
                          <span>Drive</span>
                        </div>
                      )}
                      {item.cropped_image_url && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setZoomImageUrl(item.cropped_image_url!)
                          }}
                          className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-emerald-600/90 hover:bg-emerald-700 text-white text-[9px] font-bold flex items-center gap-0.5 cursor-pointer shadow-xs z-10"
                          title="Bấm để xem ảnh cắt khung ngắm (vùng AI đọc)"
                        >
                          <span>✂️ Crop AI</span>
                        </div>
                      )}
                    </div>

                    {/* Thông tin pallet & con dấu */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-xs font-black">
                            STT: {item.pallet_stt}
                          </span>
                          {item.pallet_tag && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
                              {item.pallet_tag}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            {item.box_count} thùng • {item.box_weight} Kg
                          </span>
                        </div>

                        {/* Trạng thái */}
                        {item.status === 'approved' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                            Đã tạo thùng
                          </span>
                        ) : item.status === 'decoded' ? (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold">
                            Đã đọc số
                          </span>
                        ) : item.status === 'error' ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-[10px] font-bold">
                            Lỗi đọc
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold animate-pulse">
                            Chờ AI
                          </span>
                        )}
                      </div>

                      {/* Ô nhập Dòng 1 & Dòng 2 */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="w-14 text-slate-500 text-[11px] font-bold shrink-0">Dòng 1:</span>
                          <input
                            type="text"
                            value={item.stamp_line1 || ''}
                            onChange={e =>
                              handleUpdateItemLines(item.id, e.target.value, item.stamp_line2 || '')
                            }
                            placeholder="Chưa đọc được Dòng 1"
                            className="flex-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="w-14 text-slate-500 text-[11px] font-bold shrink-0">Dòng 2:</span>
                          <input
                            type="text"
                            value={item.stamp_line2 || ''}
                            onChange={e =>
                              handleUpdateItemLines(item.id, item.stamp_line1 || '', e.target.value)
                            }
                            placeholder="Chưa đọc được Dòng 2"
                            className="flex-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Kết quả giải mã tiếng Việt */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>
                          {dec.isSpecial12
                            ? dec.special12Name
                            : dec.productTitle || 'Chưa nhận diện sản phẩm'}
                        </span>
                      </div>
                      {item.drive_view_url && (
                        <a
                          href={item.drive_view_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                          title="Mở ảnh gốc trên Google Drive"
                        >
                          <ExternalLink size={10} />
                          <span>Xem Drive</span>
                        </a>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Quy cách: <b>{dec.spec || '---'}</b></span>
                      <span>Đóng gói: <b>{dec.packagingDateStr || '---'}</b></span>
                      <span>Nhập NL: <b>{dec.rawMaterialDateStr || '---'}</b></span>
                      <span>Vùng: <b>{dec.provinceName || '---'}</b></span>
                    </div>
                  </div>

                  {/* Footer nút hành động */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {item.created_by_name || 'Kho'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDecodeGemini([item.id])}
                        disabled={decodingId === item.id}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                        title="Chỉ đọc lại ảnh này bằng Gemini"
                      >
                        {decodingId === item.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        <span>Đọc AI</span>
                      </button>

                      {item.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleApproveAndCreateBoxes(item)}
                          disabled={approvingId === item.id || (!item.stamp_line1 && !item.stamp_line2)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                          {approvingId === item.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <PackagePlus size={13} />
                          )}
                          <span>Duyệt & Tạo {item.box_count} Thùng</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Xóa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            // ── CARD GỘP: PALLET CHỨA NHIỀU ĐỢT CON DẤU / NHIỀU DÒNG SẢN PHẨM ──
            return (
              <div
                key={group.key}
                className="p-4 rounded-2xl border-2 border-amber-400/90 dark:border-amber-500/80 bg-white dark:bg-slate-900 shadow-md flex flex-col justify-between gap-3.5 col-span-1 md:col-span-2"
              >
                {/* Header Card gộp */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black tracking-wider">
                      STT: {group.pallet_stt}
                    </span>
                    {group.pallet_tag && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs font-bold">
                        🏷️ {group.pallet_tag}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1">
                      <span>📦 Ghép {group.items.length} dòng sản phẩm</span>
                    </span>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      Tổng: {group.total_boxes} thùng
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {group.all_approved ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        ✓ Đã tạo đủ thùng
                      </span>
                    ) : group.all_decoded ? (
                      <span className="px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                        ✓ Đã đọc đủ {group.items.length} con dấu
                      </span>
                    ) : group.has_error ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-xs font-bold">
                        ⚠️ Có lỗi đọc
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs font-bold animate-pulse">
                        Chờ AI giải mã
                      </span>
                    )}
                  </div>
                </div>

                {/* Danh sách các đợt con dấu con */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {group.items.map((item, idx) => {
                    const dec =
                      item.decoded_json ||
                      decodeStampBox(
                        {
                          metadata: {
                            scan_type: 'stamp',
                            stamp_line1: item.stamp_line1,
                            stamp_line2: item.stamp_line2,
                          },
                        },
                        stampDictMap
                      )

                    const isGoogleDriveImage = !!item.drive_file_id || item.image_url?.includes('drive.google.com')
                    const isItemApproved = item.status === 'approved'

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border ${
                          isItemApproved
                            ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
                        } flex flex-col justify-between gap-2.5`}
                      >
                        {/* Header đợt */}
                        <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200 dark:border-slate-700/60">
                          <span className="font-extrabold text-amber-600 dark:text-amber-400">
                            Dòng {idx + 1}: {item.box_count} thùng • {item.box_weight} Kg
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isItemApproved ? (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Đã tạo thùng</span>
                            ) : item.stamp_line1 && item.stamp_line2 ? (
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Đã đọc số</span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Chờ đọc</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 text-rose-400 hover:text-rose-600"
                              title="Xóa đợt này"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          {/* Thumbnail */}
                          <div
                            onClick={() => setZoomImageUrl(item.image_url)}
                            className="w-20 h-20 rounded-lg bg-slate-200 dark:bg-slate-900 overflow-hidden relative cursor-zoom-in shrink-0 border border-slate-300 dark:border-slate-700"
                          >
                            {item.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={
                                  item.cropped_image_url && !item.cropped_image_url.includes('drive.google.com/file/d/')
                                    ? item.cropped_image_url
                                    : item.drive_file_id
                                    ? `https://lh3.googleusercontent.com/d/${item.drive_file_id}`
                                    : item.image_url
                                }
                                alt="Con dấu"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  if (item.drive_file_id) {
                                    const target = e.target as HTMLImageElement
                                    if (!target.dataset.tried) {
                                      target.dataset.tried = '1'
                                      target.src = `https://drive.google.com/thumbnail?id=${item.drive_file_id}&sz=w400`
                                    }
                                  }
                                }}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <ImageIcon size={20} />
                              </div>
                            )}
                            {isGoogleDriveImage && (
                              <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded bg-blue-600 text-white text-[8px] font-bold flex items-center gap-0.5">
                                <Cloud size={8} />
                                <span>Drive</span>
                              </div>
                            )}
                            {item.cropped_image_url && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setZoomImageUrl(item.cropped_image_url!)
                                }}
                                className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-bold cursor-pointer"
                                title="Xem Crop"
                              >
                                <span>✂️ Crop</span>
                              </div>
                            )}
                          </div>

                          {/* Nhập Dòng 1 & Dòng 2 */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="w-12 text-slate-500 font-bold shrink-0">Dòng 1:</span>
                              <input
                                type="text"
                                value={item.stamp_line1 || ''}
                                onChange={e => handleUpdateItemLines(item.id, e.target.value, item.stamp_line2 || '')}
                                placeholder="Chưa đọc"
                                className="flex-1 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                              />
                            </div>
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="w-12 text-slate-500 font-bold shrink-0">Dòng 2:</span>
                              <input
                                type="text"
                                value={item.stamp_line2 || ''}
                                onChange={e => handleUpdateItemLines(item.id, item.stamp_line1 || '', e.target.value)}
                                placeholder="Chưa đọc"
                                className="flex-1 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Thông tin giải mã tiếng Việt */}
                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-0.5">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="line-clamp-1">{dec.isSpecial12 ? dec.special12Name : dec.productTitle || 'Chưa nhận diện'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2.5">
                            <span>Quy cách: <b>{dec.spec || '---'}</b></span>
                            <span>Đóng gói: <b>{dec.packagingDateStr || '---'}</b></span>
                            <span>Nhập NL: <b>{dec.rawMaterialDateStr || '---'}</b></span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Footer của Card Gộp */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 flex-wrap gap-2">
                  <span className="text-[11px] text-slate-500">
                    Khởi tạo: {new Date(group.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {group.created_by_name || 'Kho'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecodeGemini(group.items.map(i => i.id))}
                      disabled={group.items.some(i => decodingId === i.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                      title="Đọc lại toàn bộ con dấu của Pallet này"
                    >
                      <Sparkles size={13} />
                      <span>Đọc AI Tất Cả</span>
                    </button>

                    {!group.all_approved && (
                      <button
                        type="button"
                        onClick={() => handleApproveGroup(group)}
                        disabled={approvingId === group.key || group.items.some(i => !i.stamp_line1 && !i.stamp_line2)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        title="Duyệt tất cả các dòng sản phẩm của Pallet này cùng lúc"
                      >
                        {approvingId === group.key ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <PackagePlus size={14} />
                        )}
                        <span>Duyệt & Tạo {group.total_boxes} Thùng ({group.items.length} Sản phẩm)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Xóa toàn bộ Pallet này khỏi hàng đợi"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Hướng dẫn & Code Google Apps Script */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Cloud size={20} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Mã Nguồn Google Apps Script (Lưu trữ ảnh CON_DAU)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 space-y-1">
                <p className="font-bold">📌 Các bước triển khai trên tài khoản Google mới (3 phút):</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  <li>Đăng nhập tài khoản Google bạn muốn lưu ảnh $\rightarrow$ Mở <b>https://script.google.com</b> $\rightarrow$ Bấm <b>Dự án mới (New project)</b>.</li>
                  <li>Xóa hết code mặc định, dán toàn bộ đoạn mã bên dưới $\rightarrow$ Nhấn <b>Lưu (Ctrl+S)</b>.</li>
                  <li>Bấm <b>Triển khai (Deploy)</b> $\rightarrow$ <b>Tạo bản triển khai mới (New deployment)</b>:
                    <ul className="list-disc pl-5 mt-0.5">
                      <li>Loại: <b>Ứng dụng web (Web app)</b>.</li>
                      <li>Thực thi dưới tư cách: <b>Tôi (Me)</b>.</li>
                      <li>Ai có quyền truy cập: <b>Bất kỳ ai (Anyone)</b>.</li>
                    </ul>
                  </li>
                  <li>Bấm <b>Triển khai</b> $\rightarrow$ Cấp quyền Google Drive $\rightarrow$ Sao chép URL Web App dán vào ô Webhook URL ở trên.</li>
                </ol>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-mono text-[11px] text-slate-400">Code.gs</span>
                  <button
                    type="button"
                    onClick={handleCopyScriptCode}
                    className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1"
                  >
                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                  {STAMP_GOOGLE_APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Phóng to ảnh đối chiếu */}
      {zoomImageUrl && (
        <div
          onClick={() => setZoomImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-800 text-white">
              <span className="text-xs font-bold">Ảnh con dấu gốc đối chiếu</span>
              <button
                type="button"
                onClick={() => setZoomImageUrl(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  zoomImageUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
                    ? `https://lh3.googleusercontent.com/d/${zoomImageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)![1]}`
                    : zoomImageUrl
                }
                alt="Phóng to"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget
                  if (!target.dataset.tried && zoomImageUrl) {
                    target.dataset.tried = '1'
                    target.src = zoomImageUrl
                  }
                }}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

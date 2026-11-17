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
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { decodeStampBox } from '@/lib/stampDecoder'

interface StampQueueItem {
  id: string
  system_code: string
  pallet_stt: string
  pallet_tag?: string | null
  pallet_notes?: string | null
  box_count: number
  box_weight: number
  image_url: string
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
  stampDictMap: Record<string, Record<string, string>>
  onPendingCountChange?: (count: number) => void
}

export function StampQueueAiTab({
  visible,
  stampDictMap,
  onPendingCountChange,
}: StampQueueAiTabProps) {
  const { currentSystem } = useSystem()
  const systemCode = currentSystem?.code || 'KHO_DONG_LANH'

  // Cấu hình Gemini API Key
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('gemini-2.5-flash')
  const [isEnabled, setIsEnabled] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [hasSavedKey, setHasSavedKey] = useState(false)

  // Danh sách hàng đợi ảnh
  const [items, setItems] = useState<StampQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'decoded' | 'approved'>('all')
  const [decodingAll, setDecodingAll] = useState(false)
  const [decodingId, setDecodingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const notify = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const loadAiConfig = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from('company_ai_settings')
        .select('gemini_api_key, gemini_model, is_enabled')
        .limit(1)
        .maybeSingle()

      if (data) {
        setApiKey(data.gemini_api_key || '')
        setModelName(data.gemini_model || 'gemini-2.5-flash')
        setIsEnabled(data.is_enabled !== false)
        setHasSavedKey(!!data.gemini_api_key)
      }
    } catch (e) {
      console.warn('Không tải được company_ai_settings:', e)
    }
  }, [])

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('stamp_scan_queue')
        .select('*')
        .eq('system_code', systemCode)
        .order('created_at', { ascending: false })
        .limit(100)

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
  }, [systemCode, onPendingCountChange])

  useEffect(() => {
    loadAiConfig()
    loadQueue()
  }, [loadAiConfig, loadQueue])

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
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id' }
      )

      if (error) throw error
      setHasSavedKey(!!apiKey.trim())
      notify('✅ Đã lưu và kích hoạt cấu hình Gemini AI Key!')
    } catch (e: any) {
      alert(`Lỗi lưu Gemini Key: ${e.message}`)
    } finally {
      setSavingKey(false)
    }
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
        throw new Error(json.error || 'Lỗi giải mã Gemini AI')
      }
      notify(`✨ Gemini đã giải mã ${json.decodedCount}/${json.total} ảnh (Lỗi: ${json.errorCount})`)
      await loadQueue()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setDecodingAll(false)
      setDecodingId(null)
    }
  }

  const handleUpdateLines = async (id: string, line1: string, line2: string) => {
    const decoded = decodeStampBox(
      { metadata: { scan_type: 'stamp', stamp_line1: line1, stamp_line2: line2 } },
      stampDictMap
    )
    setItems(prev =>
      prev.map(it =>
        it.id === id
          ? { ...it, stamp_line1: line1, stamp_line2: line2, decoded_json: decoded }
          : it
      )
    )
    await (supabase as any)
      .from('stamp_scan_queue')
      .update({ stamp_line1: line1, stamp_line2: line2, decoded_json: decoded })
      .eq('id', id)
  }

  const handleApproveAndCreateBoxes = async (item: StampQueueItem) => {
    const l1 = (item.stamp_line1 || '').trim()
    const l2 = (item.stamp_line2 || '').trim()
    if (!l1 && !l2) {
      alert('Chưa có Dòng 1 / Dòng 2. Vui lòng bấm Giải mã AI hoặc nhập tay trước khi duyệt!')
      return
    }

    setApprovingId(item.id)
    try {
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
        startIdx = maxIdx + 1
      }

      const count = Math.max(1, Number(item.box_count) || 1)
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

      notify(`✅ Đã duyệt & tạo ${count} thùng vào Pallet ${cleanStt}!`)
      await loadQueue()
    } catch (e: any) {
      alert(`Lỗi duyệt tạo thùng: ${e.message}`)
    } finally {
      setApprovingId(null)
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Xóa ảnh này khỏi hàng đợi?')) return
    await (supabase as any).from('stamp_scan_queue').delete().eq('id', id)
    await loadQueue()
  }

  if (!visible) return null

  const filteredItems = items.filter(it => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'pending') return it.status === 'pending' || it.status === 'error'
    return it.status === statusFilter
  })

  const pendingOrErrorCount = items.filter(i => i.status === 'pending' || i.status === 'error').length

  return (
    <div className="space-y-5">
      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold flex items-center gap-2 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Cấu hình Gemini API Key trên Web Mẹ */}
      <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-800/70 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Kích hoạt Gemini AI Vision (Server-side)</span>
                {hasSavedKey && isEnabled && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-[11px] font-bold">
                    Đang bật
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Key được lưu bảo mật trên Server để giải mã ảnh dấu mực từ kho & tăng độ chính xác cho `/api/ocr`.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          <div className="md:col-span-6 relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Dán GEMINI_API_KEY (AIza...) vào đây"
              className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="md:col-span-3">
            <select
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (Khuyên dùng)</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={e => setIsEnabled(e.target.checked)}
                className="rounded"
              />
              <span>Kích hoạt</span>
            </label>
            <button
              type="button"
              onClick={handleSaveAiKey}
              disabled={savingKey}
              className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {savingKey ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>Lưu Key</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Thanh điều khiển Hàng đợi ảnh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { k: 'all', label: `Tất cả (${items.length})` },
            {
              k: 'pending',
              label: `Chờ giải mã (${pendingOrErrorCount})`,
            },
            {
              k: 'decoded',
              label: `Đã giải mã (${items.filter(i => i.status === 'decoded').length})`,
            },
            {
              k: 'approved',
              label: `Đã duyệt (${items.filter(i => i.status === 'approved').length})`,
            },
          ].map(tab => (
            <button
              key={tab.k}
              type="button"
              onClick={() => setStatusFilter(tab.k as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                statusFilter === tab.k
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadQueue}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>

          {pendingOrErrorCount > 0 && (
            <button
              type="button"
              onClick={() => handleDecodeGemini()}
              disabled={decodingAll}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md disabled:opacity-60"
            >
              {decodingAll ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              <span>Giải mã tất cả bằng Gemini ({pendingOrErrorCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Danh sách ảnh con dấu */}
      {filteredItems.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 space-y-2">
          <ImageIcon size={36} className="mx-auto text-slate-400" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Chưa có ảnh dấu mực nào trong hàng đợi
          </p>
          <p className="text-xs">
            Nhân viên tại kho bấm &ldquo;Chụp Gửi Web Mẹ&rdquo; trên Scanner, ảnh sẽ hiển thị ngay tại đây để Gemini AI giải mã và tạo thùng.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredItems.map(item => {
            const dec = decodeStampBox(
              {
                metadata: {
                  scan_type: 'stamp',
                  stamp_line1: item.stamp_line1 || '',
                  stamp_line2: item.stamp_line2 || '',
                },
              },
              stampDictMap
            )

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 space-y-3 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail ảnh gốc */}
                  <button
                    type="button"
                    onClick={() => setZoomImageUrl(item.image_url)}
                    className="w-28 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black shrink-0 relative group"
                    title="Bấm để phóng to ảnh gốc"
                  >
                    <img
                      src={item.image_url}
                      alt={`Dấu ${item.pallet_stt}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  </button>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono font-black text-xs">
                          STT: {item.pallet_stt}
                        </span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {item.box_count} thùng · {item.box_weight} Kg
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          item.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : item.status === 'decoded'
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                              : item.status === 'error'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                        }`}
                      >
                        {item.status === 'approved'
                          ? 'Đã tạo thùng'
                          : item.status === 'decoded'
                            ? 'Đã giải mã AI'
                            : item.status === 'error'
                              ? 'Lỗi AI'
                              : 'Chờ giải mã'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      {item.created_by_name || 'Nhân viên kho'} •{' '}
                      {new Date(item.created_at).toLocaleString('vi-VN')}
                    </div>

                    {item.error_message && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        <span>{item.error_message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dòng 1 & Dòng 2 chỉnh sửa được */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Dòng 1 (Mã SP)
                    </label>
                    <input
                      type="text"
                      value={item.stamp_line1 || ''}
                      onChange={e =>
                        handleUpdateLines(item.id, e.target.value, item.stamp_line2 || '')
                      }
                      placeholder="VD: 102020301001-0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Dòng 2 (16 số nguồn gốc)
                    </label>
                    <input
                      type="text"
                      value={item.stamp_line2 || ''}
                      onChange={e =>
                        handleUpdateLines(item.id, item.stamp_line1 || '', e.target.value)
                      }
                      placeholder="VD: 2031103112600066"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Kết quả giải mã */}
                {(item.stamp_line1 || item.stamp_line2) && (
                  <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-slate-900 dark:text-white">
                        {dec.productTitle || 'Chưa nhận diện được sản phẩm'}
                      </strong>
                      {dec.isSpecial12 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                          ⭐ Ngoại lệ 12 số
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      {[
                        dec.factoryName,
                        dec.packagingDateStr ? `ĐG: ${dec.packagingDateStr}` : '',
                        dec.rawMaterialDateStr ? `Nhập NL: ${dec.rawMaterialDateStr}` : '',
                        dec.supplierName ? `NCC: ${dec.supplierName}` : '',
                        dec.provinceName ? `Vùng: ${dec.provinceName}` : '',
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'Chưa đủ 16 số dòng 2'}
                    </div>
                  </div>
                )}

                {/* Nút thao tác */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDecodeGemini([item.id])}
                    disabled={decodingId === item.id || item.status === 'approved'}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    {decodingId === item.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    <span>Giải mã AI</span>
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
            )
          })}
        </div>
      )}

      {/* Modal phóng to ảnh gốc */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300"
            >
              <X size={24} />
            </button>
            <img
              src={zoomImageUrl}
              alt="Ảnh dấu mực phóng to"
              className="w-full max-h-[82vh] object-contain rounded-2xl border border-slate-700 bg-black"
            />
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Plus,
  Trash2,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Hash,
  Table,
  Layers,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { ShiftProductItem, normalizeViText } from '../operations/operationsService'

export interface HallOption {
  id: string
  name: string
  warehouseId?: string | null
  warehouseName?: string | null
}

interface ExcelLotRow {
  id: string
  seq: string
  dates: string[]
  info: string
  tag: string
}

const OFFLINE_HALL_UPDATES_KEY = 'offline_hall_lot_updates_v1'
const QUICK_TAGS = ['XK', 'NK', 'CONT', 'CHỜ', 'LẺ', 'HÀNG HỒI']

export async function submitHallLotUpdateWeb(params: {
  system_code: string
  company_id?: string | null
  user_id?: string | null
  user_name?: string | null
  hall_id?: string | null
  hall_name: string
  lot_seqs: any[]
  notes?: string
}): Promise<{ success: boolean; message: string; isOffline?: boolean }> {
  const payload = {
    system_code: params.system_code || 'KHO_DONG_LANH',
    company_id: params.company_id || null,
    hall_id: params.hall_id || null,
    hall_name: params.hall_name,
    lot_seqs: params.lot_seqs,
    total_lots: params.lot_seqs.length,
    created_by: params.user_id || null,
    created_by_name: params.user_name || 'Nhân viên',
    notes: params.notes || null,
    status: 'PENDING',
  }

  try {
    const { error } = await (supabase.from('hall_lot_updates') as any).insert(payload)
    if (error) throw error
    return { success: true, message: 'Đã gửi danh sách LOT sảnh lên Web thành công!' }
  } catch (err: any) {
    try {
      const raw = localStorage.getItem(OFFLINE_HALL_UPDATES_KEY)
      const queue = raw ? JSON.parse(raw) : []
      queue.push({ ...payload, queued_at: new Date().toISOString() })
      localStorage.setItem(OFFLINE_HALL_UPDATES_KEY, JSON.stringify(queue))
      return {
        success: true,
        isOffline: true,
        message: 'Đã lưu vào máy! Sẽ tự động gửi lên Web ngay khi có mạng.',
      }
    } catch {
      return { success: false, message: 'Lỗi gửi dữ liệu: ' + (err?.message || 'Không có mạng') }
    }
  }
}

export async function syncOfflineHallLotUpdatesWeb(): Promise<{ synced: number; remaining: number }> {
  try {
    const raw = localStorage.getItem(OFFLINE_HALL_UPDATES_KEY)
    if (!raw) return { synced: 0, remaining: 0 }
    const queue: any[] = JSON.parse(raw)
    if (!queue.length) return { synced: 0, remaining: 0 }

    const remaining: any[] = []
    let synced = 0
    for (const item of queue) {
      try {
        const { queued_at: _q, ...payload } = item
        const { error } = await (supabase.from('hall_lot_updates') as any).insert(payload)
        if (error) remaining.push(item)
        else synced++
      } catch {
        remaining.push(item)
      }
    }

    if (remaining.length > 0) {
      localStorage.setItem(OFFLINE_HALL_UPDATES_KEY, JSON.stringify(remaining))
    } else {
      localStorage.removeItem(OFFLINE_HALL_UPDATES_KEY)
    }
    return { synced, remaining: remaining.length }
  } catch {
    return { synced: 0, remaining: 0 }
  }
}

export default function HallLotInputModal({
  visible,
  onClose,
  halls = [],
  defaultHallId,
  systemCode = 'KHO_DONG_LANH',
  userProfile,
  products = [],
  onSubmitted,
}: {
  visible: boolean
  onClose: () => void
  halls?: HallOption[]
  defaultHallId?: string | null
  systemCode?: string
  userProfile?: {
    id?: string
    fullName?: string
    email?: string
    companyId?: string | null
  } | null
  products?: ShiftProductItem[]
  onSubmitted?: (msg: string) => void
}) {
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL')
  const [selectedHallId, setSelectedHallId] = useState<string | null>(null)
  const [useCustomHall, setUseCustomHall] = useState(false)
  const [customHallName, setCustomHallName] = useState('')

  const [inputMode, setInputMode] = useState<'QUICK_SEQ' | 'EXCEL_TABLE'>('QUICK_SEQ')
  const [seqInput, setSeqInput] = useState('')
  const [lotSeqs, setLotSeqs] = useState<string[]>([])
  const [excelRows, setExcelRows] = useState<ExcelLotRow[]>([
    { id: '1', seq: '1', dates: [], info: '', tag: '' },
  ])
  const [activeInfoSuggestRowId, setActiveInfoSuggestRowId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Calendar state for Excel Row
  const [calendarTargetRowId, setCalendarTargetRowId] = useState<string | null>(null)
  const [calendarSelectedDates, setCalendarSelectedDates] = useState<string[]>([])
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())

  useEffect(() => {
    if (!visible) return
    if (defaultHallId && halls.some(h => h.id === defaultHallId)) {
      setSelectedHallId(defaultHallId)
      setUseCustomHall(false)
    } else if (halls.length > 0 && !selectedHallId) {
      setSelectedHallId(halls[0].id)
    }
  }, [visible, defaultHallId, halls, selectedHallId])

  const warehouseGroups = useMemo(() => {
    const map = new Map<string, string>()
    halls.forEach(h => {
      if (h.warehouseId && h.warehouseName) {
        map.set(h.warehouseId, h.warehouseName)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [halls])

  const filteredHalls = useMemo(() => {
    if (selectedWarehouseFilter === 'ALL') return halls
    return halls.filter(h => h.warehouseId === selectedWarehouseFilter)
  }, [halls, selectedWarehouseFilter])

  const selectedHallObj = useMemo(
    () => halls.find(h => h.id === selectedHallId) || null,
    [halls, selectedHallId]
  )

  const getProductSuggestionsForInfo = (infoText: string): ShiftProductItem[] => {
    const qNorm = normalizeViText(infoText)
    if (!qNorm) return []
    const tokens = qNorm.split(' ').filter(Boolean)
    if (tokens.length === 0) return []

    const scored: { item: ShiftProductItem; score: number }[] = []
    for (const p of products) {
      const aliasNorm = normalizeViText(p.aliases || '')
      const skuNorm = normalizeViText(p.sku || '')
      const intNorm = normalizeViText(`${p.internal_code || ''} ${p.internal_name || ''}`)
      const nameNorm = normalizeViText(p.name || '')
      const full = `${aliasNorm} ${skuNorm} ${intNorm} ${nameNorm}`
      if (!tokens.every(t => full.includes(t))) continue
      let score = 10
      if (aliasNorm && tokens.every(t => aliasNorm.includes(t))) score += 50
      if (skuNorm && tokens.every(t => skuNorm.includes(t))) score += 25
      scored.push({ item: p, score })
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(s => s.item)
  }

  const calendarDaysData = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
    const firstDayIdx = new Date(calendarYear, calendarMonth, 1).getDay()
    const startOffset = (firstDayIdx + 6) % 7
    const cells: (number | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [calendarYear, calendarMonth])

  if (!visible) return null

  const handleAddQuickSeq = () => {
    const raw = seqInput.trim().toUpperCase()
    if (!raw) return
    const parts = raw
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    setLotSeqs(prev => Array.from(new Set([...prev, ...parts])))
    setSeqInput('')
  }

  const handleAddExcelRow = () => {
    setExcelRows(prev => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        seq: String(prev.length + 1),
        dates: [],
        info: '',
        tag: '',
      },
    ])
  }

  const handleOpenCalendarForRow = (row: ExcelLotRow) => {
    setCalendarTargetRowId(row.id)
    setCalendarSelectedDates([...row.dates])
  }

  const handleToggleDate = (day: number) => {
    const dStr = String(day).padStart(2, '0')
    const mStr = String(calendarMonth + 1).padStart(2, '0')
    const formatted = `${dStr}/${mStr}/${calendarYear}`
    setCalendarSelectedDates(prev =>
      prev.includes(formatted) ? prev.filter(x => x !== formatted) : [...prev, formatted]
    )
  }

  const handleConfirmCalendar = () => {
    if (!calendarTargetRowId) return
    setExcelRows(prev =>
      prev.map(r => (r.id === calendarTargetRowId ? { ...r, dates: calendarSelectedDates } : r))
    )
    setCalendarTargetRowId(null)
  }

  const handleSubmit = async () => {
    const finalHallName = useCustomHall
      ? customHallName.trim()
      : selectedHallObj
        ? selectedHallObj.warehouseName
          ? `${selectedHallObj.warehouseName} - ${selectedHallObj.name}`
          : selectedHallObj.name
        : 'Sảnh chung'

    if (!finalHallName) {
      alert('Vui lòng chọn hoặc nhập tên Sảnh!')
      return
    }

    const payloadLots =
      inputMode === 'QUICK_SEQ'
        ? lotSeqs
        : excelRows
            .filter(r => r.info.trim() || r.seq.trim() || r.tag.trim())
            .map((r, i) => ({
              stt: r.seq.trim() || String(i + 1),
              dates: r.dates,
              date: r.dates.join(', '),
              info: r.info.trim(),
              tag: r.tag.trim(),
            }))

    if (payloadLots.length === 0) return

    setSubmitting(true)
    try {
      const res = await submitHallLotUpdateWeb({
        system_code: systemCode,
        company_id: userProfile?.companyId || null,
        user_id: userProfile?.id || null,
        user_name: userProfile?.fullName || userProfile?.email || 'Nhân viên',
        hall_id: useCustomHall ? null : selectedHallId,
        hall_name: finalHallName,
        lot_seqs: payloadLots,
        notes: notes.trim(),
      })

      if (res.success) {
        onSubmitted?.(res.message)
        onClose()
      } else {
        alert(res.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3">
      <div className="w-full max-w-lg bg-[#111827] border border-slate-800 rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#0b1324] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-white">KÊ KHAI LOT TẠI SẢNH</div>
              <div className="text-[11px] text-slate-400">
                Đồng bộ trực tiếp lên Sơ đồ kho &amp; Kiểm kê Web
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 overflow-y-auto overscroll-contain space-y-3.5 flex-1">
          {/* 1. Chọn Sảnh */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                1. Chọn Sảnh / Khu vực tập kết:
              </span>
              <button
                type="button"
                onClick={() => setUseCustomHall(v => !v)}
                className="text-[11px] font-bold text-sky-400"
              >
                {useCustomHall ? 'Chọn từ danh sách' : '+ Nhập tên sảnh khác'}
              </button>
            </div>

            {useCustomHall ? (
              <input
                type="text"
                value={customHallName}
                onChange={e => setCustomHallName(e.target.value)}
                placeholder="Nhập tên sảnh (VD: Sảnh Kho 1, Cửa xuất 2...)"
                className="w-full px-3 py-2.5 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white"
              />
            ) : (
              <>
                {warehouseGroups.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedWarehouseFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border whitespace-nowrap ${
                        selectedWarehouseFilter === 'ALL'
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-[#1e293b] border-slate-700 text-slate-400'
                      }`}
                    >
                      Tất cả kho
                    </button>
                    {warehouseGroups.map(wh => (
                      <button
                        key={wh.id}
                        type="button"
                        onClick={() => setSelectedWarehouseFilter(wh.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border whitespace-nowrap ${
                          selectedWarehouseFilter === wh.id
                            ? 'bg-blue-600 border-blue-400 text-white'
                            : 'bg-[#1e293b] border-slate-700 text-slate-400'
                        }`}
                      >
                        {wh.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {filteredHalls.map(h => {
                    const active = selectedHallId === h.id
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedHallId(h.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                          active
                            ? 'bg-sky-600 border-sky-400 text-white font-black'
                            : 'bg-[#1e293b] border-slate-700 text-slate-300'
                        }`}
                      >
                        {h.warehouseName ? `${h.warehouseName} · ${h.name}` : h.name}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* 2. Chuyển chế độ Nhập nhanh STT vs Bảng Excel */}
          <div className="grid grid-cols-2 gap-1 bg-[#0b1324] p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setInputMode('QUICK_SEQ')}
              className={`py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                inputMode === 'QUICK_SEQ' ? 'bg-sky-600 text-white' : 'text-slate-400'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Nhập nhanh STT</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('EXCEL_TABLE')}
              className={`py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                inputMode === 'EXCEL_TABLE' ? 'bg-sky-600 text-white' : 'text-slate-400'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Bảng chi tiết (Excel)</span>
            </button>
          </div>

          {/* Nội dung theo chế độ */}
          {inputMode === 'QUICK_SEQ' ? (
            <div className="space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={seqInput}
                  onChange={e => setSeqInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddQuickSeq()
                    }
                  }}
                  placeholder="Nhập STT LOT (VD: G949, H012...) cách nhau dấu phẩy"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleAddQuickSeq}
                  className="px-4 rounded-xl bg-sky-600 text-white text-xs font-black"
                >
                  THÊM
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">
                  DANH SÁCH LOT ({lotSeqs.length}):
                </span>
                {lotSeqs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLotSeqs([])}
                    className="text-[11px] font-bold text-rose-400"
                  >
                    Xóa hết
                  </button>
                )}
              </div>

              {lotSeqs.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#0b1324] border border-slate-800 text-center text-xs text-slate-500">
                  Chưa có STT LOT nào. Nhập STT ở trên rồi bấm THÊM.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-2xl bg-[#0b1324] border border-slate-800 max-h-44 overflow-y-auto">
                  {lotSeqs.map(s => (
                    <span
                      key={s}
                      className="px-2.5 py-1 rounded-xl bg-[#0f172a] border border-sky-500 text-sky-300 text-xs font-black flex items-center gap-1.5"
                    >
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => setLotSeqs(prev => prev.filter(x => x !== s))}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">
                  DANH SÁCH DÒNG KÊ KHAI ({excelRows.length}):
                </span>
                <button
                  type="button"
                  onClick={handleAddExcelRow}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/50 text-sky-300 text-[11px] font-extrabold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm dòng</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {excelRows.map((row, idx) => {
                  const rowSuggestions =
                    activeInfoSuggestRowId === row.id ? getProductSuggestionsForInfo(row.info) : []

                  return (
                    <div
                      key={row.id}
                      className="p-2.5 rounded-2xl bg-[#0c162d] border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-black">
                            STT #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={row.seq}
                            onChange={e =>
                              setExcelRows(prev =>
                                prev.map(r => (r.id === row.id ? { ...r, seq: e.target.value } : r))
                              )
                            }
                            placeholder="Mã STT"
                            className="w-20 px-2 py-1 rounded bg-[#0f172a] border border-slate-700 text-xs font-bold text-white"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenCalendarForRow(row)}
                            className="px-2 py-1 rounded bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px] font-extrabold flex items-center gap-1"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>
                              {row.dates.length > 0 ? `${row.dates.length} ngày` : 'Chọn ngày'}
                            </span>
                          </button>

                          {excelRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExcelRows(prev => prev.filter(r => r.id !== row.id))
                              }
                              className="p-1 rounded bg-rose-500/15 text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {row.dates.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {row.dates.map(d => (
                            <span
                              key={d}
                              className="px-2 py-0.5 rounded bg-sky-900/40 border border-sky-500/40 text-sky-200 text-[10px] font-bold"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Ô nhập thông tin hàng hóa + Gợi ý Autocomplete sản phẩm theo tên viết tắt */}
                      <div className="relative">
                        <input
                          type="text"
                          value={row.info}
                          onChange={e => {
                            const val = e.target.value
                            setExcelRows(prev =>
                              prev.map(r => (r.id === row.id ? { ...r, info: val } : r))
                            )
                            setActiveInfoSuggestRowId(row.id)
                          }}
                          onFocus={() => setActiveInfoSuggestRowId(row.id)}
                          onBlur={() => setTimeout(() => setActiveInfoSuggestRowId(null), 180)}
                          placeholder="Tên hàng (gõ tắt alias / SKU) + Số lượng (VD: SR Ri6 30 th)..."
                          className="w-full px-3 py-2 rounded-xl bg-[#162238] border border-sky-500/30 text-xs font-bold text-white placeholder-slate-500"
                        />

                        {rowSuggestions.length > 0 && (
                          <div className="mt-1 rounded-xl bg-[#1e293b] border border-sky-500/60 shadow-xl overflow-hidden z-30 max-h-40 overflow-y-auto">
                            {rowSuggestions.map(sug => (
                              <button
                                key={sug.id}
                                type="button"
                                onMouseDown={() => {
                                  setExcelRows(prev =>
                                    prev.map(r =>
                                      r.id === row.id ? { ...r, info: `${sug.name} - ` } : r
                                    )
                                  )
                                  setActiveInfoSuggestRowId(null)
                                }}
                                onClick={() => {
                                  setExcelRows(prev =>
                                    prev.map(r =>
                                      r.id === row.id ? { ...r, info: `${sug.name} - ` } : r
                                    )
                                  )
                                  setActiveInfoSuggestRowId(null)
                                }}
                                className="w-full px-2.5 py-1.5 text-left border-b border-slate-700/60 last:border-0 hover:bg-slate-800 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    {sug.aliases && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold">
                                        {sug.aliases}
                                      </span>
                                    )}
                                    <span className="text-xs font-bold text-white truncate">
                                      {sug.name}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">SKU: {sug.sku}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tag / Mã phụ */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input
                          type="text"
                          value={row.tag}
                          onChange={e =>
                            setExcelRows(prev =>
                              prev.map(r => (r.id === row.id ? { ...r, tag: e.target.value } : r))
                            )
                          }
                          placeholder="Mã phụ / Tag..."
                          className="w-28 px-2 py-1 rounded-lg bg-[#0f172a] border border-slate-700 text-[11px] text-white"
                        />
                        {QUICK_TAGS.map(qt => {
                          const active = row.tag === qt
                          return (
                            <button
                              key={qt}
                              type="button"
                              onClick={() =>
                                setExcelRows(prev =>
                                  prev.map(r =>
                                    r.id === row.id ? { ...r, tag: active ? '' : qt } : r
                                  )
                                )
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                active
                                  ? 'bg-sky-600 border-sky-400 text-white'
                                  : 'bg-[#1e293b] border-slate-700 text-slate-400'
                              }`}
                            >
                              {qt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleAddExcelRow}
                className="w-full py-2.5 rounded-xl bg-sky-950/50 border border-dashed border-sky-500 text-sky-400 text-xs font-extrabold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm dòng kê khai mới</span>
              </button>
            </div>
          )}

          {/* Ghi chú chung */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Ghi chú chung (Tùy chọn):
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Nhập ghi chú ca, vị trí tập kết..."
              className="w-full px-3 py-2 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-[#1e293b] text-slate-300 text-xs font-extrabold"
          >
            ĐÓNG
          </button>
          <button
            type="button"
            disabled={
              submitting ||
              (inputMode === 'QUICK_SEQ'
                ? lotSeqs.length === 0
                : excelRows.filter(r => r.info.trim() || r.seq.trim() || r.tag.trim()).length === 0)
            }
            onClick={handleSubmit}
            className="flex-2 py-3 px-4 rounded-xl bg-sky-600 disabled:bg-slate-700 text-white text-xs font-black flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {inputMode === 'QUICK_SEQ'
                ? `GỬI LÊN WEB (${lotSeqs.length} LOT)`
                : `GỬI LÊN WEB (${excelRows.filter(r => r.info.trim() || r.seq.trim() || r.tag.trim()).length} DÒNG)`}
            </span>
          </button>
        </div>
      </div>

      {/* Modal Lịch chọn nhiều ngày cho dòng Excel */}
      {calendarTargetRowId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0f172a] border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-white">
                CHỌN NGÀY HÀNG HÓA ({calendarSelectedDates.length} ngày)
              </div>
              <button
                type="button"
                onClick={() => setCalendarTargetRowId(null)}
                className="text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#1e293b] rounded-xl p-1">
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11)
                    setCalendarYear(y => y - 1)
                  } else setCalendarMonth(m => m - 1)
                }}
                className="w-7 h-7 rounded bg-[#0f172a] flex items-center justify-center text-sky-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-extrabold text-white">
                Tháng {calendarMonth + 1} / {calendarYear}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0)
                    setCalendarYear(y => y + 1)
                  } else setCalendarMonth(m => m + 1)
                }}
                className="w-7 h-7 rounded bg-[#0f172a] flex items-center justify-center text-sky-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDaysData.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} className="h-8" />
                const dStr = String(day).padStart(2, '0')
                const mStr = String(calendarMonth + 1).padStart(2, '0')
                const formatted = `${dStr}/${mStr}/${calendarYear}`
                const isSelected = calendarSelectedDates.includes(formatted)
                return (
                  <button
                    key={formatted}
                    type="button"
                    onClick={() => handleToggleDate(day)}
                    className={`h-8 rounded-lg text-xs font-bold ${
                      isSelected ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCalendarTargetRowId(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                HỦY
              </button>
              <button
                type="button"
                onClick={handleConfirmCalendar}
                className="flex-2 py-2 px-4 rounded-xl bg-sky-600 text-xs font-extrabold text-white flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" />
                <span>XÁC NHẬN ({calendarSelectedDates.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

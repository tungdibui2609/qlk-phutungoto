'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  Send,
  ListOrdered,
  Table2,
  MapPin,
  Tag,
  Calendar,
  Package,
  Hash,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
} from 'lucide-react'
import type { HallOption } from './types'
import { submitHallLotUpdate } from './warehouseAdjustmentService'

interface TableRowItem {
  id: string
  dates: string[]
  product_info: string
  quantity: string
  tags: string[]
}

const SUGGESTED_TAGS = ['+hàng mẫu', '+chờ dán tem', '+hàng trả', '+hàng xá']
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

const formatDisplayDateShort = (ddmmyyyy: string) => {
  const parts = ddmmyyyy.split('/')
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`
  }
  return ddmmyyyy
}

interface HallLotInputModalProps {
  visible: boolean
  onClose: () => void
  halls: HallOption[]
  initialHall?: HallOption | null
}

export default function HallLotInputModal({
  visible,
  onClose,
  halls,
  initialHall = null,
}: HallLotInputModalProps) {
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL')
  const [selectedHallId, setSelectedHallId] = useState<string | null>(
    initialHall?.id || (halls[0]?.id ?? null)
  )
  const [customHallName, setCustomHallName] = useState<string>(initialHall?.name || '')
  const [useCustomHall, setUseCustomHall] = useState<boolean>(halls.length === 0)

  const [inputMode, setInputMode] = useState<'QUICK_SEQ' | 'EXCEL_TABLE'>('QUICK_SEQ')

  // Mode 1: Quick Sequence
  const [seqInputText, setSeqInputText] = useState('')
  const [seqList, setSeqList] = useState<string[]>([])

  // Mode 2: Excel Table
  const [tableRows, setTableRows] = useState<TableRowItem[]>(() => [
    {
      id: 'row-1',
      dates: [],
      product_info: '',
      quantity: '',
      tags: [],
    },
    {
      id: 'row-2',
      dates: [],
      product_info: '',
      quantity: '',
      tags: [],
    },
  ])

  const [customTagInputs, setCustomTagInputs] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Calendar Picker state
  const [datePickerRowId, setDatePickerRowId] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth())
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear())

  useEffect(() => {
    if (visible) {
      setFeedbackMsg(null)
      if (initialHall) {
        setSelectedHallId(initialHall.id)
        setCustomHallName(initialHall.name)
        setUseCustomHall(false)
        setSelectedWarehouseFilter(initialHall.warehouse_id || 'ALL')
      } else if (halls.length > 0 && !selectedHallId) {
        setSelectedHallId(halls[0].id)
        setUseCustomHall(false)
      } else if (halls.length === 0) {
        setUseCustomHall(true)
      }
    }
  }, [visible, initialHall, halls, selectedHallId])

  const warehouseGroups = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of halls) {
      if (h.warehouse_id && h.warehouse_name) {
        map.set(h.warehouse_id, h.warehouse_name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [halls])

  const filteredHalls = useMemo(() => {
    if (selectedWarehouseFilter === 'ALL') return halls
    return halls.filter(h => h.warehouse_id === selectedWarehouseFilter)
  }, [halls, selectedWarehouseFilter])

  const selectedHallObj = useMemo(
    () => halls.find(h => h.id === selectedHallId) || null,
    [halls, selectedHallId]
  )

  const resolvedHallName = useMemo(() => {
    if (useCustomHall) return customHallName.trim()
    if (!selectedHallObj) return ''
    if (selectedHallObj.full_path) return selectedHallObj.full_path
    if (selectedHallObj.warehouse_name) {
      return `${selectedHallObj.warehouse_name} › ${selectedHallObj.name}`
    }
    return selectedHallObj.name
  }, [useCustomHall, customHallName, selectedHallObj])

  // --- Mode 1 Handlers ---
  const handleAddSeqTokens = (rawText?: string) => {
    const source = rawText !== undefined ? rawText : seqInputText
    if (!source.trim()) return

    const tokens = source
      .split(/[\s,;.\n]+/)
      .map(t => t.replace(/^#/, '').trim().toUpperCase())
      .filter(Boolean)

    if (tokens.length === 0) return

    setSeqList(prev => {
      const next = [...prev]
      for (const tok of tokens) {
        if (!next.includes(tok)) {
          next.push(tok)
        }
      }
      return next
    })
    setSeqInputText('')
  }

  const handleRemoveSeq = (seq: string) => {
    setSeqList(prev => prev.filter(item => item !== seq))
  }

  // --- Mode 2 Handlers ---
  const handleAddRow = () => {
    setTableRows(prev => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dates: [],
        product_info: '',
        quantity: '',
        tags: [],
      },
    ])
  }

  const handleRemoveRow = (id: string) => {
    setTableRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev))
  }

  const handleUpdateRowText = (id: string, field: 'product_info' | 'quantity', value: string) => {
    setTableRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const handleToggleDateForRow = (rowId: string, ddmmyyyy: string) => {
    setTableRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r
        const exists = r.dates.includes(ddmmyyyy)
        const nextDates = exists
          ? r.dates.filter(d => d !== ddmmyyyy)
          : [...r.dates, ddmmyyyy]
        return { ...r, dates: nextDates }
      })
    )
  }

  const handleToggleTagForRow = (rowId: string, tagValue: string) => {
    const clean = tagValue.trim()
    if (!clean) return
    const normalized = clean.startsWith('+') ? clean : `+${clean}`

    setTableRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r
        const exists = r.tags.includes(normalized)
        const nextTags = exists
          ? r.tags.filter(t => t !== normalized)
          : [...r.tags, normalized]
        return { ...r, tags: nextTags }
      })
    )
  }

  const handleAddCustomTagForRow = (rowId: string) => {
    const raw = (customTagInputs[rowId] || '').trim()
    if (!raw) return
    const normalized = raw.startsWith('+') ? raw : `+${raw}`

    setTableRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r
        if (r.tags.includes(normalized)) return r
        return { ...r, tags: [...r.tags, normalized] }
      })
    )
    setCustomTagInputs(prev => ({ ...prev, [rowId]: '' }))
  }

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const cells: Array<{ day: number | null; ddmmyyyy: string }> = []

    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, ddmmyyyy: '' })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0')
      const mm = String(calMonth + 1).padStart(2, '0')
      cells.push({ day: d, ddmmyyyy: `${dd}/${mm}/${calYear}` })
    }
    return cells
  }, [calMonth, calYear])

  const activeDatePickerRow = useMemo(
    () => tableRows.find(r => r.id === datePickerRowId) || null,
    [tableRows, datePickerRowId]
  )

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11)
      setCalYear(y => y - 1)
    } else {
      setCalMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0)
      setCalYear(y => y + 1)
    } else {
      setCalMonth(m => m + 1)
    }
  }

  const handleSubmit = async () => {
    setFeedbackMsg(null)
    if (!resolvedHallName) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng chọn hoặc nhập tên Sảnh!' })
      return
    }

    let finalSeqList = [...seqList]
    if (inputMode === 'QUICK_SEQ' && seqInputText.trim()) {
      const extraTokens = seqInputText
        .split(/[\s,;.\n]+/)
        .map(t => t.replace(/^#/, '').trim().toUpperCase())
        .filter(Boolean)
      for (const tok of extraTokens) {
        if (!finalSeqList.includes(tok)) finalSeqList.push(tok)
      }
      setSeqList(finalSeqList)
      setSeqInputText('')
    }

    if (inputMode === 'QUICK_SEQ' && finalSeqList.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng nhập ít nhất 1 STT LOT ở sảnh!' })
      return
    }

    const validRows = tableRows
      .map(r => {
        const dateJoined = r.dates.join(', ')
        const tagJoined = r.tags.join(' ')
        return {
          date: dateJoined,
          dates: r.dates,
          product_info: r.product_info.trim(),
          quantity: r.quantity.trim(),
          tag: tagJoined,
          tags: r.tags,
        }
      })
      .filter(r => r.product_info || r.quantity || r.tag || r.date)

    if (inputMode === 'EXCEL_TABLE' && validRows.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng nhập ít nhất 1 dòng thông tin hàng hóa ở sảnh!' })
      return
    }

    setSubmitting(true)
    try {
      const res = await submitHallLotUpdate({
        hallZoneId: useCustomHall ? null : selectedHallId,
        hallName: resolvedHallName,
        inputMode,
        seqList: inputMode === 'QUICK_SEQ' ? finalSeqList : [],
        tableRows: inputMode === 'EXCEL_TABLE' ? validRows : [],
        notes,
      })

      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message })
        setSeqList([])
        setSeqInputText('')
        setNotes('')
        setTimeout(() => {
          onClose()
        }, 900)
      } else {
        setFeedbackMsg({ type: 'error', text: res.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
          <div className="min-w-0 pr-2">
            <h3 className="text-[16px] font-black text-slate-900 dark:text-white tracking-tight">
              🚚 Cập nhật LOT đang ở Sảnh
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Gửi danh sách hàng tại sảnh lên trang Web Quản lý
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-4">
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-bold border ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
              }`}
            >
              {feedbackMsg.text}
            </div>
          )}

          {/* 1. Chọn Sảnh */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-orange-600" />
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  1. Chọn Sảnh (theo Kho):
                </span>
              </div>
              {halls.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUseCustomHall(!useCustomHall)}
                  className="text-[11px] font-bold text-orange-600 dark:text-orange-400 underline"
                >
                  {useCustomHall ? 'Chọn từ danh sách' : 'ự nhập tên khác'}
                </button>
              )}
            </div>

            {!useCustomHall && halls.length > 0 ? (
              <div className="space-y-2">
                {warehouseGroups.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedWarehouseFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-colors ${
                        selectedWarehouseFilter === 'ALL'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Tất cả kho ({halls.length})
                    </button>
                    {warehouseGroups.map(wh => (
                      <button
                        key={wh.id}
                        type="button"
                        onClick={() => {
                          setSelectedWarehouseFilter(wh.id)
                          const firstInWh = halls.find(h => h.warehouse_id === wh.id)
                          if (firstInWh) setSelectedHallId(firstInWh.id)
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-colors ${
                          selectedWarehouseFilter === wh.id
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        🏭 {wh.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {filteredHalls.map(h => {
                    const active = selectedHallId === h.id
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedHallId(h.id)}
                        className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-all ${
                          active
                            ? 'bg-orange-500 border-orange-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {h.warehouse_name && (
                          <div
                            className={`text-[9px] font-bold uppercase ${
                              active ? 'text-orange-100' : 'text-slate-400'
                            }`}
                          >
                            [{h.warehouse_name}]
                          </div>
                        )}
                        <div className="text-xs font-black">{h.name}</div>
                      </button>
                    )
                  })}
                </div>

                {resolvedHallName && (
                  <div className="px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/50 text-[11px] font-semibold text-orange-800 dark:text-orange-300">
                    Đang chọn: <span className="font-black">{resolvedHallName}</span>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={customHallName}
                onChange={e => setCustomHallName(e.target.value)}
                placeholder="Nhập tên sảnh (VD: Kho 1 - Sảnh 1, Sảnh chờ xuất...)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-orange-500"
              />
            )}
          </div>

          {/* 2. Chọn kiểu nhập */}
          <div>
            <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-2">
              2. Chọn kiểu nhập dữ liệu:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInputMode('QUICK_SEQ')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all ${
                  inputMode === 'QUICK_SEQ'
                    ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <ListOrdered size={15} />
                <span>Nhập nhanh STT</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('EXCEL_TABLE')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all ${
                  inputMode === 'EXCEL_TABLE'
                    ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Table2 size={15} />
                <span>Bảng chi tiết (Excel)</span>
              </button>
            </div>
          </div>

          {/* 3. Nội dung theo mode */}
          {inputMode === 'QUICK_SEQ' ? (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Nhập danh sách STT LOT tại sảnh:
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Nhập từng số hoặc nhiều số cách nhau bởi dấu cách / phẩy (VD: 12 45 89) rồi bấm Thêm.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={seqInputText}
                  onChange={e => setSeqInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSeqTokens()
                    }
                  }}
                  placeholder="VD: 102 105 108..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddSeqTokens()}
                  className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold flex items-center gap-1 shrink-0 active:scale-95"
                >
                  <Plus size={15} />
                  <span>Thêm</span>
                </button>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Đã thêm ({seqList.length} LOT):
                  </span>
                  {seqList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSeqList([])}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400"
                    >
                      Xóa hết
                    </button>
                  )}
                </div>

                {seqList.length === 0 ? (
                  <div className="py-5 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    Chưa có STT nào trong danh sách
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {seqList.map(seq => (
                      <span
                        key={seq}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs font-black"
                      >
                        #{seq}
                        <button
                          type="button"
                          onClick={() => handleRemoveSeq(seq)}
                          className="text-amber-700 dark:text-amber-400 hover:text-rose-600"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Bảng chi tiết hàng tại sảnh ({tableRows.length} dòng):
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Mỗi mục là 1 lô/nhóm hàng. Có thể chọn nhiều ngày và gắn nhiều tag phân loại.
                </p>
              </div>

              {tableRows.map((row, index) => (
                <div
                  key={row.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-black">
                      Mục #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      disabled={tableRows.length <= 1}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                      <span>Xóa dòng</span>
                    </button>
                  </div>

                  {/* Row 1: Ngày tháng + Số lượng */}
                  <div className="grid grid-cols-12 gap-2.5">
                    <div className="col-span-7">
                      <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        <Calendar size={12} className="text-blue-600" />
                        <span>Ngày hàng (chọn nhiều)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setDatePickerRowId(row.id)}
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-1 text-left"
                      >
                        {row.dates.length === 0 ? (
                          <span className="text-xs text-slate-400">📅 Bấm chọn ngày...</span>
                        ) : (
                          <>
                            {row.dates.map(d => (
                              <span
                                key={d}
                                className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-extrabold"
                              >
                                {formatDisplayDateShort(d)}
                              </span>
                            ))}
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 text-[10px] font-bold">
                              +Sửa
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="col-span-5">
                      <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        <Hash size={12} className="text-emerald-600" />
                        <span>Số lượng</span>
                      </label>
                      <input
                        type="text"
                        value={row.quantity}
                        onChange={e => handleUpdateRowText(row.id, 'quantity', e.target.value)}
                        placeholder="VD: 20 thùng"
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Row 2: Thông tin hàng */}
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      <Package size={12} className="text-amber-600" />
                      <span>Thông tin hàng hóa / Sản phẩm / Mã LOT</span>
                    </label>
                    <textarea
                      rows={2}
                      value={row.product_info}
                      onChange={e => handleUpdateRowText(row.id, 'product_info', e.target.value)}
                      placeholder="Nhập tên sản phẩm, mã LOT, quy cách..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-orange-500 resize-none"
                    />
                  </div>

                  {/* Row 3: Tag phân loại */}
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      <Tag size={12} className="text-purple-600" />
                      <span>Tag phân loại (chọn nhiều hoặc tự nhập):</span>
                    </label>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {SUGGESTED_TAGS.map(sug => {
                        const isSelected = row.tags.includes(sug)
                        return (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleToggleTagForRow(row.id, sug)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isSelected ? `✓ ${sug}` : sug}
                          </button>
                        )
                      })}
                    </div>

                    {row.tags.filter(t => !SUGGESTED_TAGS.includes(t)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {row.tags
                          .filter(t => !SUGGESTED_TAGS.includes(t))
                          .map(customTag => (
                            <span
                              key={customTag}
                              onClick={() => handleToggleTagForRow(row.id, customTag)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 text-[11px] font-bold cursor-pointer"
                            >
                              {customTag}
                              <X size={11} />
                            </span>
                          ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customTagInputs[row.id] || ''}
                        onChange={e =>
                          setCustomTagInputs(prev => ({ ...prev, [row.id]: e.target.value }))
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCustomTagForRow(row.id)
                          }
                        }}
                        placeholder="Thêm tag khác (VD: +hàng gấp)..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomTagForRow(row.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                      >
                        <Plus size={13} />
                        <span>Gắn tag</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddRow}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 text-xs font-extrabold flex items-center justify-center gap-1.5 bg-orange-50/50 dark:bg-orange-950/20"
              >
                <Plus size={15} />
                <span>Thêm mục hàng mới</span>
              </button>
            </div>
          )}

          {/* 4. Ghi chú */}
          <div>
            <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
              Ghi chú thêm (tùy chọn):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="VD: Ca sáng kiểm, chờ xe nâng đưa vào Dãy 2..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-orange-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Send size={15} />
                <span>Gửi lên Web Quản lý</span>
              </>
            )}
          </button>
        </div>

        {/* Calendar Popup Modal */}
        {datePickerRowId !== null && (
          <div
            className="fixed inset-0 z-[120] bg-slate-950/60 flex items-center justify-center p-4"
            onClick={() => setDatePickerRowId(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-2xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    📅 Chọn ngày hàng hóa
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Chạm vào các ngày để chọn hoặc bỏ chọn nhiều ngày
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDatePickerRowId(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-xl px-2 py-1.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Tháng {calMonth + 1} / {calYear}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400">
                {WEEKDAYS.map(w => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (!cell.day) {
                    return <div key={`empty-${idx}`} className="h-8" />
                  }
                  const isSelected = activeDatePickerRow?.dates.includes(cell.ddmmyyyy) ?? false
                  return (
                    <button
                      key={cell.ddmmyyyy}
                      type="button"
                      onClick={() => {
                        if (datePickerRowId) {
                          handleToggleDateForRow(datePickerRowId, cell.ddmmyyyy)
                        }
                      }}
                      className={`h-8 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white font-black shadow-sm'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!datePickerRowId) return
                      const now = new Date()
                      const ddmmyyyy = `${String(now.getDate()).padStart(2, '0')}/${String(
                        now.getMonth() + 1
                      ).padStart(2, '0')}/${now.getFullYear()}`
                      handleToggleDateForRow(datePickerRowId, ddmmyyyy)
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300"
                  >
                    Hôm nay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!datePickerRowId) return
                      const yest = new Date(Date.now() - 86400000)
                      const ddmmyyyy = `${String(yest.getDate()).padStart(2, '0')}/${String(
                        yest.getMonth() + 1
                      ).padStart(2, '0')}/${yest.getFullYear()}`
                      handleToggleDateForRow(datePickerRowId, ddmmyyyy)
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300"
                  >
                    Hôm qua
                  </button>
                  {activeDatePickerRow && activeDatePickerRow.dates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!datePickerRowId) return
                        setTableRows(prev =>
                          prev.map(r => (r.id === datePickerRowId ? { ...r, dates: [] } : r))
                        )
                      }}
                      className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-[11px] font-bold text-rose-600"
                    >
                      Xóa hết
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDatePickerRowId(null)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center gap-1"
                >
                  <Check size={14} />
                  <span>Xong ({activeDatePickerRow?.dates.length || 0})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

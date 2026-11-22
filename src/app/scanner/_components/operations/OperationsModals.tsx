'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  X,
  Check,
  Plus,
  Trash2,
  Camera,
  Image as ImageIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Package,
  Layers,
  Eye,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Scale,
  Moon,
  Clock,
  Edit2,
  MessageSquare,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  WifiOff,
  Users,
  RefreshCw,
} from 'lucide-react'
import {
  DeliveryShift,
  DeliveryJobTemplate,
  OrderTypeOption,
  ShiftProductItem,
  JournalRecord,
  SubShiftRecord,
  ReconcileSession,
  ReconcileBatchRow,
  InterimCloseStatus,
  ConfirmInterimCloseResult,
  extractCleanUserNote,
  aggregateShiftsProducts,
  aggregateShiftsUnits,
  getShiftJournals,
  syncOperationsOfflineQueue,
  getInterimCloseStatus,
  confirmInterimClose,
  cancelMyInterimClose,
  getSubShifts,
  reopenDeliveryShift,
  deleteDeliveryShift,
  normalizeViText,
} from './operationsService'
import type { QuickSnapItem } from './quickSnapStore'
import {
  PickedOperationPhoto,
  OperationImageRecord,
  capturePhotoWithCamera,
  pickPhotosFromLibrary,
  uploadOperationImages,
  getShiftOperationImages,
  deleteOperationImage,
  getOperationImageDisplayUrl,
} from './operationImagesService'

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    return `${time} ${date}`
  } catch {
    return isoString
  }
}

export function isOvernightShift(s?: DeliveryShift | null): boolean {
  if (!s?.opened_at || !s?.closed_at) return false
  try {
    return new Date(s.opened_at).toDateString() !== new Date(s.closed_at).toDateString()
  } catch {
    return false
  }
}

// ── 1. OPERATION NUMBER PAD MODAL ─────────────────────────────
export function OperationNumberPadModal({
  visible,
  product,
  unit,
  availableUnits = [],
  systemCode,
  jobName,
  userName,
  onClose,
  onConfirm,
}: {
  visible: boolean
  product: ShiftProductItem | null
  unit: string
  availableUnits?: string[]
  systemCode?: string
  jobName?: string | null
  userName?: string | null
  onClose: () => void
  onConfirm: (data: {
    direction: 'in' | 'out'
    quantity: number
    unit: string
    notes: string
    photos?: PickedOperationPhoto[]
  }) => Promise<void>
}) {
  const [valueStr, setValueStr] = useState<string>('')
  const [selectedUnit, setSelectedUnit] = useState<string>(unit || '')
  const [notes, setNotes] = useState<string>('')
  const [showNotes, setShowNotes] = useState(false)
  const [photos, setPhotos] = useState<PickedOperationPhoto[]>([])
  const [submittingDir, setSubmittingDir] = useState<'in' | 'out' | null>(null)

  const unitsList = useMemo(() => {
    const raw =
      availableUnits.length > 0
        ? availableUnits
        : product?.units && product.units.length > 0
          ? product.units
          : [unit, product?.defaultUnit, product?.unit].filter((u): u is string => Boolean(u && u.trim()))
    const unique = Array.from(new Set(raw.map(u => u.trim()).filter(Boolean)))
    return unique.sort((a, b) => {
      const aBox = a.toLowerCase().includes('thùng') ? 0 : 1
      const bBox = b.toLowerCase().includes('thùng') ? 0 : 1
      return aBox - bBox
    })
  }, [availableUnits, product, unit])

  useEffect(() => {
    if (!visible) return
    setValueStr('')
    setSelectedUnit(unit || unitsList[0] || product?.defaultUnit || product?.unit || '')
    setNotes('')
    setShowNotes(false)
    setPhotos([])
    setSubmittingDir(null)
  }, [visible, product, unit, unitsList])

  const parsedQty = useMemo(() => {
    const n = parseFloat(valueStr)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
  }, [valueStr])

  if (!visible || !product) return null

  const handleKey = (key: string) => {
    if (key === 'BS') {
      setValueStr(prev => prev.slice(0, -1))
      return
    }
    if (key === '.') {
      setValueStr(prev => {
        if (prev.includes('.')) return prev
        return prev ? prev + '.' : '0.'
      })
      return
    }
    setValueStr(prev => {
      if (prev === '0') return key
      if (prev.includes('.')) {
        const dec = prev.split('.')[1] || ''
        if (dec.length >= 2) return prev
      }
      if (prev.length >= 9) return prev
      return prev + key
    })
  }

  const handleQuickAdd = (delta: number) => {
    setValueStr(prev => {
      const cur = parseFloat(prev || '0') || 0
      const next = Math.round((cur + delta) * 100) / 100
      return String(next)
    })
  }

  const wmMeta = {
    systemCode,
    jobName,
    itemName: product.name,
    quantity: parsedQty > 0 ? parsedQty : null,
    unit: selectedUnit,
    direction: 'in' as const,
    userName,
  }

  const handleCamera = async () => {
    const p = await capturePhotoWithCamera(wmMeta)
    if (p) setPhotos(prev => [...prev, p])
  }

  const handleLibrary = async () => {
    const picked = await pickPhotosFromLibrary(6, wmMeta)
    if (picked.length > 0) setPhotos(prev => [...prev, ...picked])
  }

  const handleSubmit = async (dir: 'in' | 'out') => {
    if (parsedQty <= 0 || submittingDir !== null) return
    setSubmittingDir(dir)
    try {
      await onConfirm({
        direction: dir,
        quantity: parsedQty,
        unit: selectedUnit,
        notes: notes.trim(),
        photos: photos.length > 0 ? photos : undefined,
      })
      onClose()
    } finally {
      setSubmittingDir(null)
    }
  }

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'BS'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#0f172a] border-t sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700 gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-white line-clamp-2 leading-snug">
              {product.name}
            </div>
            <div className="flex items-center flex-wrap gap-1.5 mt-1">
              {product.sku && (
                <span className="text-[11px] font-bold text-indigo-400">SKU: {product.sku}</span>
              )}
              {product.aliases && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {product.aliases}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 overflow-y-auto overscroll-contain space-y-2.5">
          {/* Chọn ĐVT (Đơn vị tính thực tế của sản phẩm) */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-slate-400 shrink-0">ĐVT:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar flex-1">
              {unitsList.map(u => {
                const active = selectedUnit === u
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setSelectedUnit(u)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition ${
                      active
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                        : 'bg-[#1e293b] border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {u}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Màn hình hiển thị số lượng */}
          <div className="rounded-xl px-3.5 py-2.5 bg-[#1e293b] border border-slate-700 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-400 shrink-0">Số lượng:</span>
            <div className="flex items-baseline gap-1.5 min-w-0 justify-end">
              <span className="text-3xl font-black tracking-tight text-white truncate">
                {valueStr || '0'}
              </span>
              {selectedUnit && (
                <span className="text-xs font-bold text-indigo-300 shrink-0">{selectedUnit}</span>
              )}
            </div>
          </div>

          {/* Hàng cộng nhanh + nút ghi chú */}
          <div className="flex items-center gap-1.5">
            {[1, 5, 10, 20, 50].map(delta => (
              <button
                key={delta}
                type="button"
                onClick={() => handleQuickAdd(delta)}
                className="flex-1 py-2 rounded-lg bg-[#1e293b] hover:bg-slate-800 active:scale-95 border border-slate-700 text-indigo-300 font-extrabold text-xs transition"
              >
                +{delta}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNotes(prev => !prev)}
              title="Ghi chú"
              className={`px-3 py-2 rounded-lg border flex items-center justify-center transition relative ${
                showNotes || notes.trim()
                  ? 'bg-indigo-600/20 border-indigo-400 text-indigo-300'
                  : 'bg-[#1e293b] border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {notes.trim() && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          {/* Ô ghi chú thu gọn */}
          {showNotes && (
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Nhập ghi chú đợt nhập/xuất..."
              autoFocus
              className="w-full px-3 py-2 rounded-xl bg-[#1e293b] border border-indigo-500/50 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
          )}

          {/* Chụp ảnh / Thư viện */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCamera}
                className="flex-1 py-2 px-3 rounded-xl bg-sky-900/30 hover:bg-sky-900/40 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Chụp ảnh</span>
              </button>
              <button
                type="button"
                onClick={handleLibrary}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-900/30 hover:bg-indigo-900/40 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Thư viện ({photos.length})</span>
              </button>
            </div>

            {photos.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-600 shrink-0">
                    <img src={p.dataUrl} alt="proof" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bàn phím số 3x4 */}
          <div className="grid grid-cols-3 gap-2">
            {keypadRows.flat().map(k => (
              <button
                key={k}
                type="button"
                onClick={() => handleKey(k)}
                className={`h-12 rounded-xl font-extrabold text-lg flex items-center justify-center active:scale-95 transition ${
                  k === 'BS'
                    ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-700/40 hover:bg-indigo-950'
                    : 'bg-[#1e293b] text-white border border-slate-700 hover:bg-slate-800'
                }`}
              >
                {k === 'BS' ? '⌫' : k}
              </button>
            ))}
          </div>

          {/* 2 nút hành động lớn ở đáy: NHẬP KHO (+) / XUẤT KHO (-) */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              disabled={parsedQty <= 0 || submittingDir !== null}
              onClick={() => handleSubmit('in')}
              className={`py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
                parsedQty <= 0 || submittingDir !== null
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-950/50'
              }`}
            >
              {submittingDir === 'in' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowDownCircle className="w-4 h-4" />
              )}
              <span>NHẬP KHO (+)</span>
            </button>

            <button
              type="button"
              disabled={parsedQty <= 0 || submittingDir !== null}
              onClick={() => handleSubmit('out')}
              className={`py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
                parsedQty <= 0 || submittingDir !== null
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white shadow-lg shadow-rose-950/50'
              }`}
            >
              {submittingDir === 'out' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="w-4 h-4" />
              )}
              <span>XUẤT KHO (-)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 2. OPEN JOB MODAL ─────────────────────────────────────────
export function OpenJobModal({
  visible,
  templates,
  orderTypes = [],
  onClose,
  onConfirm,
}: {
  visible: boolean
  templates: DeliveryJobTemplate[]
  orderTypes?: OrderTypeOption[]
  onClose: () => void
  onConfirm: (data: {
    jobName: string
    notes: string
    templateId: string | null
    defaultProducts: ShiftProductItem[]
    orderTypeId?: string | null
    orderTypeName?: string | null
    orderTypeCode?: string | null
  }) => Promise<void>
}) {
  const [jobName, setJobName] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedOrderTypeId, setSelectedOrderTypeId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setJobName('')
    setNotes('')
    setSelectedTemplateId(null)
    setSelectedOrderTypeId(null)
    setSubmitting(false)
  }, [visible])

  if (!visible) return null

  const handleSelectTemplate = (tpl: DeliveryJobTemplate) => {
    setSelectedTemplateId(tpl.id)
    setJobName(tpl.name)
    const tplNote = tpl.notes || tpl.description
    if (tplNote && !notes) setNotes(tplNote)
  }

  const handleSubmit = async () => {
    if (!jobName.trim() || submitting) return
    setSubmitting(true)
    try {
      const tpl = templates.find(t => t.id === selectedTemplateId)
      const ot = orderTypes.find(o => o.id === selectedOrderTypeId)
      await onConfirm({
        jobName: jobName.trim(),
        notes: notes.trim(),
        templateId: selectedTemplateId,
        defaultProducts: Array.isArray(tpl?.default_products) ? tpl!.default_products! : [],
        orderTypeId: ot?.id || null,
        orderTypeName: ot?.name || null,
        orderTypeCode: ot?.code || null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-extrabold text-white">Tạo Công Việc Mới</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto overscroll-contain space-y-3">
          {templates.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                Chọn nhanh từ Mẫu Công Việc:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {templates.map(tpl => {
                  const active = selectedTemplateId === tpl.id
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                        active
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-[#1e293b] border-slate-700 text-slate-300'
                      }`}
                    >
                      {tpl.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Tên công việc / Ca làm việc *
            </label>
            <input
              type="text"
              value={jobName}
              onChange={e => setJobName(e.target.value)}
              placeholder="VD: Xuất cont 40ft đi Cảng Cát Lái..."
              className="w-full px-3 py-2.5 rounded-xl bg-[#1e293b] border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {orderTypes.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                Loại phiếu kế toán (Tùy chọn):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {orderTypes.map(ot => {
                  const active = selectedOrderTypeId === ot.id
                  return (
                    <button
                      key={ot.id}
                      type="button"
                      onClick={() => setSelectedOrderTypeId(active ? null : ot.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                        active
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-[#1e293b] border-slate-700 text-slate-300'
                      }`}
                    >
                      {ot.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Ghi chú công việc
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ghi chú biển số xe, số niêm chì, tổ bốc xếp..."
              className="w-full px-3 py-2 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!jobName.trim() || submitting}
              onClick={handleSubmit}
              className="flex-2 py-2.5 px-4 rounded-xl bg-indigo-600 disabled:bg-slate-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Bắt Đầu Công Việc</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 3. CLOSE JOB MODAL ────────────────────────────────────────
export function CloseJobModal({
  visible,
  shift,
  journals,
  orderTypes = [],
  onClose,
  onConfirm,
}: {
  visible: boolean
  shift: DeliveryShift | null
  journals: JournalRecord[]
  orderTypes?: OrderTypeOption[]
  onClose: () => void
  onConfirm: (data: {
    notes: string
    orderTypeId?: string | null
    orderTypeName?: string | null
    orderTypeCode?: string | null
  }) => Promise<void>
}) {
  const [notes, setNotes] = useState('')
  const [selectedOrderTypeId, setSelectedOrderTypeId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible || !shift) return
    setNotes('')
    setSelectedOrderTypeId(shift.summary_data?.order_type_id || null)
    setSubmitting(false)
  }, [visible, shift])

  if (!visible || !shift) return null

  const totalIn = journals
    .filter(j => j.direction === 'in')
    .reduce((acc, j) => acc + (Number(j.quantity_sent) || 0), 0)
  const totalOut = journals
    .filter(j => j.direction === 'out')
    .reduce((acc, j) => acc + (Number(j.quantity_sent) || 0), 0)

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const ot = orderTypes.find(o => o.id === selectedOrderTypeId)
      await onConfirm({
        notes: notes.trim(),
        orderTypeId: ot?.id ?? shift.summary_data?.order_type_id ?? null,
        orderTypeName: ot?.name ?? shift.summary_data?.order_type_name ?? null,
        orderTypeCode: ot?.code ?? shift.summary_data?.order_type_code ?? null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-extrabold text-white">Hoàn Thành &amp; Đóng Công Việc</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto overscroll-contain space-y-3">
          <div className="p-3 rounded-xl bg-[#1e293b] border border-slate-700 space-y-1">
            <div className="text-xs font-extrabold text-white">
              {shift.summary_data?.job_name || shift.notes || 'Công việc'}
            </div>
            <div className="text-[11px] text-slate-400">
              Tổng số đợt ghi nhận: <b className="text-white">{journals.length} đợt</b> • Nhập:{' '}
              <b className="text-emerald-400">+{Number(totalIn.toFixed(2))}</b> • Xuất:{' '}
              <b className="text-rose-400">-{Number(totalOut.toFixed(2))}</b>
            </div>
          </div>

          {orderTypes.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                Loại phiếu kế toán:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {orderTypes.map(ot => {
                  const active = selectedOrderTypeId === ot.id
                  return (
                    <button
                      key={ot.id}
                      type="button"
                      onClick={() => setSelectedOrderTypeId(active ? null : ot.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                        active
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-[#1e293b] border-slate-700 text-slate-300'
                      }`}
                    >
                      {ot.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Ghi chú chốt công việc (Tùy chọn)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Nhập ghi chú tổng kết ca / bàn giao..."
              className="w-full px-3 py-2 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
            >
              Quay lại
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Xác Nhận Hoàn Thành</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 4. INTERIM CLOSE MODAL (CHỐT CA TẠM ĐA NGƯỜI DÙNG - BẮT BUỘC CÓ MẠNG) ──
export function InterimCloseModal({
  visible,
  shift,
  user,
  currentJournals,
  subShiftNumber,
  onClose,
  onCompleted,
  onSyncedReload,
}: {
  visible: boolean
  shift: DeliveryShift | null
  user: any
  currentJournals: JournalRecord[]
  subShiftNumber: number
  onClose: () => void
  onCompleted: (result: ConfirmInterimCloseResult) => Promise<void>
  onSyncedReload?: () => Promise<void>
}) {
  const [notes, setNotes] = useState('')
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [status, setStatus] = useState<InterimCloseStatus | null>(null)
  const [keepWaiting, setKeepWaiting] = useState(false)
  const [confirmForceMode, setConfirmForceMode] = useState(false)

  const currentUserId = user?.id ? String(user.id) : ''
  const currentUserName = (user?.full_name || user?.email || '').trim().toLowerCase()

  const loadStatusOnline = async () => {
    if (!shift) return
    setLoadingStatus(true)
    setOfflineError(null)
    setConfirmForceMode(false)
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('OFFLINE_REQUIRED')
      }
      // Đồng bộ toàn bộ hàng đợi offline của máy này lên server trước
      const syncRes = await syncOperationsOfflineQueue()
      if (syncRes.remainingCount > 0) {
        throw new Error('OFFLINE_SYNC_INCOMPLETE')
      }
      const st = await getInterimCloseStatus(shift.id)
      setStatus(st)
      if (onSyncedReload) {
        await onSyncedReload()
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '')
      if (msg === 'OFFLINE_REQUIRED') {
        setOfflineError(
          'Chốt ca tạm BẮT BUỘC phải có kết nối mạng để đồng bộ số liệu và kiểm tra người làm chung. Vui lòng bật Wifi / 4G rồi bấm "Kiểm tra lại".'
        )
      } else if (msg === 'OFFLINE_SYNC_INCOMPLETE') {
        setOfflineError(
          'Còn số liệu ngoại tuyến chưa đẩy lên được máy chủ do mất mạng. Vui lòng ra khu vực có sóng ổn định rồi thử lại.'
        )
      } else if (msg === 'OFFLINE_SHIFT_UNSYNCED') {
        setOfflineError(
          'Công việc này được mở lúc mất mạng và chưa đồng bộ lên máy chủ. Vui lòng bật mạng để đồng bộ trước khi chốt tạm.'
        )
      } else {
        setOfflineError(`Không thể kết nối máy chủ: ${msg}`)
      }
      setStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    if (!visible || !shift) return
    setNotes('')
    setSubmitting(false)
    setKeepWaiting(false)
    setConfirmForceMode(false)
    void loadStatusOnline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shift?.id])

  if (!visible || !shift) return null

  const effectiveSubNumber = status?.next_sub_shift_number ?? subShiftNumber
  const effectiveBatchCount = status?.current_batch_count ?? currentJournals.length
  const participants = status?.participants || []
  const confirmedUsers = status?.confirmed_users || []
  const missingUsers = status?.missing_users || []

  const isUserConfirmed = (uid?: string | null, uname?: string | null) => {
    const cleanUid = uid ? String(uid) : ''
    const cleanName = (uname || '').trim().toLowerCase()
    return confirmedUsers.some(c => {
      if (cleanUid && c.user_id) return String(c.user_id) === cleanUid
      return cleanName && (c.user_name || '').trim().toLowerCase() === cleanName
    })
  }

  const iHaveConfirmed = isUserConfirmed(currentUserId, currentUserName)
  const otherMissingNames = missingUsers
    .filter(m => {
      if (currentUserId && m.user_id) return String(m.user_id) !== currentUserId
      return (m.user_name || '').trim().toLowerCase() !== currentUserName
    })
    .map(m => m.user_name)

  const handleConfirmAction = async (forceFinalize = false) => {
    if (submitting || loadingStatus) return
    setSubmitting(true)
    setOfflineError(null)
    try {
      const result = await confirmInterimClose({
        shift,
        user,
        notes: notes.trim(),
        forceFinalize,
        keepWaiting: !forceFinalize && keepWaiting,
      })
      await onCompleted(result)
      if (result.status === 'finalized') {
        onClose()
      } else {
        // Giữ modal mở hoặc tải lại trạng thái để người dùng thấy rõ "Bạn đã chốt - đang đợi ai"
        const st = await getInterimCloseStatus(shift.id)
        setStatus(st)
        setConfirmForceMode(false)
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '')
      if (msg === 'OFFLINE_REQUIRED' || msg === 'OFFLINE_SYNC_INCOMPLETE') {
        setOfflineError(
          'Mất kết nối mạng trong lúc chốt ca tạm! Vui lòng mở Wifi / 4G và bấm Thử lại.'
        )
      } else {
        setOfflineError(`Lỗi chốt ca tạm: ${msg}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelMyConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await cancelMyInterimClose(shift.id, user)
      await loadStatusOnline()
    } catch (err: any) {
      setOfflineError(`Không thể rút xác nhận: ${err?.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md max-h-[90vh] bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-extrabold text-white">
              Chốt Ca Tạm (Đợt #{effectiveSubNumber})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void loadStatusOnline()}
              disabled={loadingStatus}
              title="Tải lại trạng thái từ máy chủ"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {loadingStatus && !status && (
            <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 flex items-center gap-3 text-xs text-slate-200">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              <span>Đang kiểm tra mạng, đồng bộ số liệu của bạn và tải số liệu mọi người...</span>
            </div>
          )}

          {offlineError && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 space-y-2">
              <div className="flex items-start gap-2 text-xs text-rose-200 font-semibold">
                <WifiOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{offlineError}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadStatusOnline()}
                disabled={loadingStatus}
                className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                <span>Kiểm Tra Lại Mạng & Đồng Bộ</span>
              </button>
            </div>
          )}

          {status && !offlineError && (
            <>
              {/* Tổng quan số người & số lượt nhập/xuất */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-extrabold text-amber-300">
                    <Users className="w-4 h-4" />
                    Người tham gia công việc: {status.total_participants} người
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-[11px] font-bold">
                    Đã chốt {status.confirmed_count}/{status.total_participants}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Tổng số liệu đợt #{effectiveSubNumber} (đã gộp từ mọi người):{' '}
                  <b className="text-white">{effectiveBatchCount} lượt nhập/xuất</b>
                </div>

                {/* Danh sách chi tiết từng người */}
                <div className="space-y-1.5 pt-1">
                  {participants.map((p, idx) => {
                    const done = isUserConfirmed(p.user_id, p.user_name)
                    const isMe =
                      (currentUserId && p.user_id && String(p.user_id) === currentUserId) ||
                      (currentUserName && (p.user_name || '').trim().toLowerCase() === currentUserName)
                    const uKey = p.user_id || (p.user_name || '').trim().toLowerCase()
                    const uCount = status.per_user_counts?.[uKey] || 0
                    return (
                      <div
                        key={`${p.user_id || p.user_name}_${idx}`}
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs ${
                          done
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-slate-900/70 border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="font-bold truncate">
                            {p.user_name}
                            {isMe ? ' (Bạn)' : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            • {uCount} lượt
                          </span>
                        </div>
                        <span
                          className={`text-[11px] font-extrabold shrink-0 ${
                            done ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {done ? '✅ Đã chốt' : '⏳ Chưa chốt'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Thông báo trạng thái chờ nếu mình đã chốt */}
              {iHaveConfirmed ? (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 space-y-1.5 text-xs">
                  <div className="font-extrabold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Bạn đã xác nhận chốt ca tạm Đợt #{effectiveSubNumber}!</span>
                  </div>
                  {missingUsers.length > 0 ? (
                    <div className="text-amber-200">
                      ⏳ Đang chờ{' '}
                      <b>{missingUsers.map(m => m.user_name).join(', ')}</b> mở mạng và bấm Chốt ca tạm để hoàn tất đợt này.
                    </div>
                  ) : (
                    <div className="text-amber-200">
                      ⏳ Đang giữ trạng thái chờ đồng nghiệp khác mở mạng vào chốt cùng đợt #{effectiveSubNumber}.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {otherMissingNames.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                      Sau khi bạn bấm chốt, hệ thống sẽ ghi nhận phần của bạn và chờ:{' '}
                      <b>{otherMissingNames.join(', ')}</b> chốt tiếp.
                    </div>
                  )}

                  {status.total_participants <= 1 && (
                    <label className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700 cursor-pointer text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={keepWaiting}
                        onChange={e => setKeepWaiting(e.target.checked)}
                        className="mt-0.5 accent-amber-500"
                      />
                      <span>
                        <b>Đợi thêm đồng nghiệp trong kho</b> (nếu có người làm chung nhưng máy họ chưa bật mạng để đồng bộ)
                      </span>
                    </label>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Ghi chú đợt chốt tạm (Người bàn giao / Ca nhận...)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="VD: Chốt giao ca sáng cho ca chiều..."
                      className="w-full px-3 py-2 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </>
              )}

              {/* Các nút hành động */}
              {iHaveConfirmed ? (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCancelMyConfirm()}
                      disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                    >
                      Rút xác nhận
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
                    >
                      Đóng (Tiếp tục đợi)
                    </button>
                  </div>

                  {!confirmForceMode ? (
                    <button
                      type="button"
                      onClick={() => setConfirmForceMode(true)}
                      className="w-full py-2 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-[11px] font-bold"
                    >
                      Chốt hoàn tất ngay (không đợi người chưa chốt)
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 space-y-2">
                      <div className="text-[11px] text-amber-200">
                        Xác nhận hoàn tất Đợt #{effectiveSubNumber} ngay bây giờ với toàn bộ số liệu đã có trên máy chủ?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmForceMode(false)}
                          className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleConfirmAction(true)}
                          className="flex-1 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-extrabold flex items-center justify-center gap-1"
                        >
                          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Xác nhận chốt luôn</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={submitting || loadingStatus}
                    onClick={() => void handleConfirmAction(false)}
                    className="flex-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {otherMissingNames.length > 0 || keepWaiting
                        ? `Xác Nhận Chốt (${status.confirmed_count + 1}/${Math.max(status.total_participants, 1)})`
                        : `Hoàn Tất Chốt Đợt #${effectiveSubNumber}`}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 5. EDIT JOURNAL MODAL ─────────────────────────────────────
export function EditJournalModal({
  visible,
  journal,
  availableUnits = [],
  onClose,
  onSave,
}: {
  visible: boolean
  journal: JournalRecord | null
  availableUnits?: string[]
  onClose: () => void
  onSave: (data: {
    journalId: string
    quantity: number
    unit: string
    direction: 'in' | 'out'
    userNote: string
  }) => Promise<void>
}) {
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [qtyStr, setQtyStr] = useState('')
  const [unit, setUnit] = useState('Thùng (20kg)')
  const [userNote, setUserNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible || !journal) return
    setDirection(journal.direction || 'in')
    setQtyStr(String(journal.quantity_sent || ''))
    setUnit(journal.unit || 'Thùng (20kg)')
    setUserNote(extractCleanUserNote(journal.notes))
    setSaving(false)
  }, [visible, journal])

  if (!visible || !journal) return null

  const unitsList = Array.from(
    new Set([unit, ...(availableUnits || [])].filter(Boolean))
  )

  const handleSubmit = async () => {
    const q = parseFloat(qtyStr)
    if (!q || q <= 0 || saving) return
    setSaving(true)
    try {
      await onSave({
        journalId: journal.id,
        quantity: q,
        unit,
        direction,
        userNote,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
          <div className="text-sm font-extrabold text-white truncate">{journal.item_name}</div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('in')}
              className={`py-2 rounded-xl text-xs font-extrabold border ${
                direction === 'in'
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-[#1e293b] border-slate-700 text-slate-400'
              }`}
            >
              ↓ NHẬP (+)
            </button>
            <button
              type="button"
              onClick={() => setDirection('out')}
              className={`py-2 rounded-xl text-xs font-extrabold border ${
                direction === 'out'
                  ? 'bg-rose-600 border-rose-400 text-white'
                  : 'bg-[#1e293b] border-slate-700 text-slate-400'
              }`}
            >
              ↑ XUẤT (-)
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Số lượng
            </label>
            <input
              type="number"
              step="any"
              value={qtyStr}
              onChange={e => setQtyStr(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#1e293b] border border-slate-700 text-base font-extrabold text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Đơn vị tính
            </label>
            <div className="flex flex-wrap gap-1.5">
              {unitsList.map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    unit === u
                      ? 'bg-indigo-600 border-indigo-400 text-white'
                      : 'bg-[#1e293b] border-slate-700 text-slate-300'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Ghi chú
            </label>
            <input
              type="text"
              value={userNote}
              onChange={e => setUserNote(e.target.value)}
              placeholder="Ghi chú..."
              className="w-full px-3 py-2 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="flex-2 py-2.5 px-4 rounded-xl bg-indigo-600 text-white text-xs font-extrabold"
            >
              {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 6. PRODUCT HISTORY MODAL ──────────────────────────────────
export function ProductHistoryModal({
  visible,
  product,
  journals,
  onClose,
  onEditJournal,
  onDeleteJournal,
}: {
  visible: boolean
  product: ShiftProductItem | null
  journals: JournalRecord[]
  onClose: () => void
  onEditJournal: (j: JournalRecord) => void
  onDeleteJournal: (j: JournalRecord) => void
}) {
  if (!visible || !product) return null

  const prodJournals = journals.filter(
    j => (j.item_name || '').trim().toLowerCase() === (product.name || '').trim().toLowerCase()
  )

  const totalIn = prodJournals
    .filter(j => j.direction === 'in')
    .reduce((acc, j) => acc + (Number(j.quantity_sent) || 0), 0)
  const totalOut = prodJournals
    .filter(j => j.direction === 'out')
    .reduce((acc, j) => acc + (Number(j.quantity_sent) || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-sm font-extrabold text-white truncate">{product.name}</div>
            <div className="text-[11px] text-slate-400">
              {prodJournals.length} đợt • Nhập:{' '}
              <b className="text-emerald-400">+{Number(totalIn.toFixed(2))}</b> • Xuất:{' '}
              <b className="text-rose-400">-{Number(totalOut.toFixed(2))}</b>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 overflow-y-auto overscroll-contain space-y-2">
          {prodJournals.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 italic">
              Chưa có lịch sử nhập/xuất cho sản phẩm này trong ca.
            </div>
          ) : (
            prodJournals.map(j => {
              const isIn = j.direction === 'in'
              const cleanNote = extractCleanUserNote(j.notes)
              return (
                <div
                  key={j.id}
                  className="p-2.5 rounded-xl bg-[#1e293b] border border-slate-700 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-extrabold ${
                          isIn
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {isIn ? '+' : '-'}
                        {j.quantity_sent} {j.unit}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(j.sent_at)} • {j.sent_by_name || 'NV'}
                      </span>
                    </div>
                    {cleanNote && (
                      <div className="text-[11px] text-amber-300 mt-1 italic">📝 {cleanNote}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditJournal(j)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteJournal(j)}
                      className="p-1.5 rounded-lg bg-rose-950/50 text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── 7. CALENDAR PICKER MODAL ──────────────────────────────────
export function CalendarPickerModal({
  visible,
  onClose,
  selectedDates,
  onConfirm,
  availableDateKeys = [],
  title = 'Chọn ngày xem báo cáo',
  isMultiSelect = true,
}: {
  visible: boolean
  onClose: () => void
  selectedDates: string[]
  onConfirm: (dates: string[]) => void
  availableDateKeys?: string[]
  title?: string
  isMultiSelect?: boolean
}) {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)
  const [tempSelected, setTempSelected] = useState<string[]>([])

  useEffect(() => {
    if (!visible) return
    setTempSelected([...selectedDates])
    if (selectedDates.length > 0) {
      const parts = selectedDates[0].split('-')
      if (parts.length === 3) {
        setCurrentYear(Number(parts[0]))
        setCurrentMonth(Number(parts[1]))
      }
    }
  }, [visible, selectedDates])

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay()
    const startOffset = (firstDayIndex + 6) % 7
    const days: ({
      dateKey: string
      dayNum: number
      hasData: boolean
      isToday: boolean
    } | null)[] = []

    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        dateKey,
        dayNum: d,
        hasData: availableDateKeys.includes(dateKey),
        isToday: dateKey === todayKey,
      })
    }
    return days
  }, [currentYear, currentMonth, availableDateKeys, todayKey])

  if (!visible) return null

  const toggleDate = (dateKey: string) => {
    if (isMultiSelect) {
      setTempSelected(prev =>
        prev.includes(dateKey) ? prev.filter(d => d !== dateKey) : [...prev, dateKey]
      )
    } else {
      setTempSelected([dateKey])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-sm bg-[#0f172a] border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white">{title}</div>
              <div className="text-[11px] font-semibold text-indigo-400">
                {isMultiSelect ? `Đang chọn: ${tempSelected.length} ngày` : 'Chạm vào ngày để chọn'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between bg-[#1e293b] rounded-xl p-1">
          <button
            type="button"
            onClick={() => {
              if (currentMonth === 1) {
                setCurrentMonth(12)
                setCurrentYear(y => y - 1)
              } else setCurrentMonth(m => m - 1)
            }}
            className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center text-slate-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-extrabold text-white">
            Tháng {String(currentMonth).padStart(2, '0')} / {currentYear}
          </span>
          <button
            type="button"
            onClick={() => {
              if (currentMonth === 12) {
                setCurrentMonth(1)
                setCurrentYear(y => y + 1)
              } else setCurrentMonth(m => m + 1)
            }}
            className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center text-slate-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-500">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, i) => (
            <div key={d} className={i >= 5 ? 'text-rose-400' : ''}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((item, idx) => {
            if (!item) return <div key={`e-${idx}`} className="h-9" />
            const isSelected = tempSelected.includes(item.dateKey)
            return (
              <button
                key={item.dateKey}
                type="button"
                onClick={() => toggleDate(item.dateKey)}
                className={`h-9 rounded-lg flex flex-col items-center justify-center relative text-xs font-bold transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-extrabold'
                    : item.isToday
                      ? 'border border-sky-400 text-sky-400'
                      : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{item.dayNum}</span>
                {item.hasData && (
                  <span
                    className={`w-1 h-1 rounded-full absolute bottom-1 ${
                      isSelected ? 'bg-white' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Có dữ liệu
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded border border-sky-400" /> Hôm nay
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentYear(today.getFullYear())
              setCurrentMonth(today.getMonth() + 1)
              if (!tempSelected.includes(todayKey)) {
                setTempSelected(isMultiSelect ? [...tempSelected, todayKey] : [todayKey])
              }
            }}
            className="px-2 py-1 rounded bg-[#1e293b] border border-slate-700 text-sky-400 font-bold"
          >
            Về hôm nay
          </button>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setTempSelected([])}
            className="px-3 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-400"
          >
            Xóa chọn
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(tempSelected)
              onClose()
            }}
            className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" />
            <span>{isMultiSelect ? `Áp dụng (${tempSelected.length} ngày)` : 'Xác nhận'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 8. AGGREGATED REPORT MODAL ────────────────────────────────
export function AggregatedReportModal({
  visible,
  title,
  shifts,
  journals,
  allProducts,
  loading = false,
  onClose,
  onOpenShiftDetail,
}: {
  visible: boolean
  title: string
  shifts: DeliveryShift[]
  journals: JournalRecord[]
  allProducts?: ShiftProductItem[]
  loading?: boolean
  onClose: () => void
  onOpenShiftDetail?: (shift: DeliveryShift) => void
}) {
  const [expandProducts, setExpandProducts] = useState(true)
  const [expandUnits, setExpandUnits] = useState(true)
  const [expandShifts, setExpandShifts] = useState(true)

  const prodRows = useMemo(
    () => aggregateShiftsProducts(shifts, journals, allProducts),
    [shifts, journals, allProducts]
  )
  const unitRows = useMemo(() => aggregateShiftsUnits(prodRows), [prodRows])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a]">
      <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-white truncate">{title}</div>
          <div className="text-[11px] text-slate-400">
            Tổng số: <b className="text-indigo-400">{shifts.length} công việc</b> • Phát sinh:{' '}
            <b className="text-emerald-400">{prodRows.length} mặt hàng</b>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
          <span className="text-xs">Đang tổng hợp số liệu báo cáo...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3 pb-16">
          {/* 1. Chi tiết theo Mặt Hàng */}
          <div className="bg-[#1e293b] border border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandProducts(p => !p)}
              className="w-full px-3.5 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-extrabold text-white">1. Chi tiết theo Mặt Hàng</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold">
                  {prodRows.length} SP
                </span>
              </div>
              {expandProducts ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {expandProducts && (
              <div className="border-t border-slate-700 p-2">
                {prodRows.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-500 italic">
                    Chưa có phát sinh sản phẩm nào.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/60">
                    {prodRows.map((r, idx) => (
                      <div
                        key={`${r.product_name}___${r.unit}`}
                        className="py-2 px-1 flex items-start gap-2 text-xs"
                      >
                        <span className="w-6 text-center text-slate-500 font-bold">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white">{r.product_name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/25 text-indigo-300 text-[10px] font-extrabold">
                              {r.unit}
                            </span>
                            {r.aliases && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                {r.aliases}
                              </span>
                            )}
                          </div>
                          {r.jobs?.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {r.jobs.map(j => (
                                <div key={j.id} className="text-[10px] text-slate-400 truncate">
                                  • {j.name}{' '}
                                  {r.jobs.length > 1
                                    ? `(${j.in_qty > 0 ? `+${j.in_qty}` : '0'}${j.out_qty > 0 ? ` / -${j.out_qty}` : ''})`
                                    : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="w-16 text-right font-extrabold text-emerald-400">
                          {r.in_qty > 0 ? `+${r.in_qty}` : '0'}
                        </div>
                        <div className="w-16 text-right font-extrabold text-rose-400">
                          {r.out_qty > 0 ? `-${r.out_qty}` : '0'}
                        </div>
                        <div className="w-9 text-right text-slate-400 text-[11px]">{r.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Tổng hợp theo Đơn Vị Tính */}
          <div className="bg-[#1e293b] border border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandUnits(p => !p)}
              className="w-full px-3.5 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-extrabold text-white">
                  2. Tổng hợp theo Đơn Vị Tính
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold">
                  {unitRows.length} ĐVT
                </span>
              </div>
              {expandUnits ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {expandUnits && (
              <div className="border-t border-slate-700 p-2 divide-y divide-slate-700/60">
                {unitRows.map(u => (
                  <div key={u.unit} className="py-2 px-2 flex items-center text-xs">
                    <span className="flex-1 font-bold text-white">{u.unit}</span>
                    <span className="w-20 text-right font-extrabold text-emerald-400">
                      +{u.in_qty}
                    </span>
                    <span className="w-20 text-right font-extrabold text-rose-400">
                      -{u.out_qty}
                    </span>
                    <span className="w-12 text-right text-slate-400">{u.count} đợt</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Danh sách các Công Việc */}
          <div className="bg-[#1e293b] border border-slate-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandShifts(p => !p)}
              className="w-full px-3.5 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-extrabold text-white">
                  3. Danh sách các Công Việc
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
                  {shifts.length} CV
                </span>
              </div>
              {expandShifts ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {expandShifts && (
              <div className="border-t border-slate-700 p-2 space-y-2">
                {shifts.map((s, idx) => {
                  const name = s.summary_data?.job_name || s.notes || `Công việc #${idx + 1}`
                  const prodCount = Object.keys(s.summary_data?.products_summary || {}).length
                  const recCount = s.summary_data?.total_records || 0
                  return (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Chốt bởi: {s.closed_by_name || 'NV'} • {prodCount} SP • {recCount} đợt
                        </div>
                      </div>
                      {onOpenShiftDetail && (
                        <button
                          type="button"
                          onClick={() => onOpenShiftDetail(s)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 9. PAST SHIFT DETAIL MODAL ────────────────────────────────
export function PastShiftDetailModal({
  visible,
  shift,
  onClose,
  onReopened,
  onDeleted,
  onOpenAlbum,
}: {
  visible: boolean
  shift: DeliveryShift | null
  onClose: () => void
  onReopened: (shift: DeliveryShift) => void
  onDeleted: (shiftId: string) => void
  onOpenAlbum?: (shift: DeliveryShift) => void
}) {
  const [journals, setJournals] = useState<JournalRecord[]>([])
  const [subShifts, setSubShifts] = useState<SubShiftRecord[]>([])
  const [shiftImages, setShiftImages] = useState<OperationImageRecord[]>([])
  const [previewContext, setPreviewContext] = useState<{
    images: OperationImageRecord[]
    index: number
    title?: string
    showDirectionFilter?: boolean
    directionFilter?: 'all' | 'in' | 'out'
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'history'>('summary')
  const [processing, setProcessing] = useState(false)
  const [expandedSubShifts, setExpandedSubShifts] = useState<Set<string>>(new Set())

  const toggleSubShiftExpand = (id: string) => {
    setExpandedSubShifts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const effectiveSubShifts = useMemo(() => {
    if (!shift || !subShifts || subShifts.length === 0) return []
    const sortedSubs = [...subShifts].sort((a, b) => a.sub_shift_number - b.sub_shift_number)
    const sortedJournals = [...journals].sort((a, b) => (a.sent_at || '').localeCompare(b.sent_at || ''))
    const result: Array<SubShiftRecord & { _subLines: JournalRecord[]; is_auto_final?: boolean }> = sortedSubs.map((ss, idx) => {
      const prevToTime = idx > 0 ? sortedSubs[idx - 1].to_time : ss.from_time
      const subLines = sortedJournals.filter(l => {
        const sentAt = l.sent_at || ''
        return idx === 0
          ? sentAt >= ss.from_time && sentAt <= ss.to_time
          : sentAt > prevToTime && sentAt <= ss.to_time
      })
      return { ...ss, _subLines: subLines, is_auto_final: false }
    })

    const lastSS = sortedSubs[sortedSubs.length - 1]
    const remainingLines = sortedJournals.filter(l => (l.sent_at || '') > lastSS.to_time)
    if (remainingLines.length > 0) {
      const lastLine = remainingLines[remainingLines.length - 1]
      const fallbackTime = lastLine.sent_at || shift.closed_at || lastSS.to_time
      result.push({
        id: `auto_final_${shift.id}`,
        company_id: shift.company_id || '',
        system_code: shift.system_code,
        shift_id: shift.id,
        sub_shift_number: sortedSubs.length + 1,
        from_time: lastSS.to_time,
        to_time: shift.closed_at || fallbackTime,
        closed_by_name: shift.closed_by_name || lastLine.sent_by_name || 'Nhân viên',
        notes:
          shift.status === 'closed'
            ? 'Đợt cuối ca (tự động tính khi bấm Hoàn thành CV)'
            : 'Đợt đang nhập (chưa bấm Chốt tạm)',
        summary_data: {
          total_records: remainingLines.length,
        },
        created_at: fallbackTime,
        _subLines: remainingLines,
        is_auto_final: true,
      })
    }
    return result
  }, [shift, subShifts, journals])

  useEffect(() => {
    if (!visible || !shift) return
    setLoading(true)
    Promise.all([
      getShiftJournals(shift),
      getSubShifts(shift.id),
      getShiftOperationImages(shift.id).catch(() => [] as OperationImageRecord[]),
    ])
      .then(([jList, sList, imgList]) => {
        setJournals(jList)
        setSubShifts(sList)
        setShiftImages(imgList)
      })
      .finally(() => setLoading(false))
  }, [visible, shift])

  const prodSummary = useMemo(() => {
    if (shift && journals.length > 0) {
      return aggregateShiftsProducts([shift], journals)
    }
    return Object.values(shift?.summary_data?.products_summary || {}).map((p: any) => ({
      product_name: p.product_name,
      unit: p.unit,
      in_qty: p.in_qty ?? p.received ?? 0,
      out_qty: p.out_qty ?? p.sent ?? 0,
      count: p.count ?? 0,
    }))
  }, [journals, shift])

  const unitSummary = useMemo(() => {
    if (shift && journals.length > 0) {
      const rows = aggregateShiftsProducts([shift], journals)
      return aggregateShiftsUnits(rows).map(u => [u.unit, u] as const)
    }
    return Object.entries(shift?.summary_data?.units_summary || {}).map(([uName, uVal]: [string, any]) => [
      uName,
      {
        unit: uName,
        in_qty: uVal?.in_qty ?? uVal?.received ?? 0,
        out_qty: uVal?.out_qty ?? uVal?.sent ?? 0,
        count: uVal?.count ?? 0,
      },
    ] as const)
  }, [journals, shift])

  const getSubShiftProductImages = (
    productName: string,
    subLines: JournalRecord[],
    fromTime: string,
    toTime: string
  ) => {
    const target = (productName || '').trim().toLowerCase()
    if (!target) return []
    const matchingSubIds = new Set(
      (subLines || [])
        .filter(l => (l.item_name || '').trim().toLowerCase() === target)
        .map(l => l.id)
    )
    return shiftImages.filter(img => {
      if (img.journal_id && subLines.length > 0) {
        return matchingSubIds.has(img.journal_id)
      }
      const imgItem = (img.item_name || '').trim().toLowerCase()
      if (imgItem !== target) return false
      const cap = img.captured_at || ''
      return (!fromTime || cap >= fromTime) && (!toTime || cap <= toTime)
    })
  }

  if (!visible || !shift) return null

  const handleReopen = async () => {
    const reason = window.prompt(
      'Công việc đã hoàn thành cần quản lý duyệt để mở lại.\nNhập lý do mở lại (tùy chọn):',
      'Bổ sung / chỉnh sửa số liệu'
    )
    if (reason === null) return
    setProcessing(true)
    try {
      await reopenDeliveryShift(shift, { reason: reason.trim() || null })
      alert('Đã gửi yêu cầu Mở lại công việc! Sau khi quản lý duyệt tại mục Duyệt thao tác, công việc sẽ chuyển về tab Đang làm.')
      onClose()
    } catch (e: any) {
      alert(e?.message || 'Không thể gửi yêu cầu mở lại công việc')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('CẢNH BÁO: Xóa vĩnh viễn công việc này và toàn bộ lịch sử nhập xuất?'))
      return
    setProcessing(true)
    try {
      await deleteDeliveryShift(shift.id)
      onDeleted(shift.id)
      onClose()
    } catch (e: any) {
      alert('Lỗi xóa công việc: ' + (e?.message || e))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a]">
      <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
        <div className="min-w-0 flex-1 pr-2">
          <div className="text-sm font-extrabold text-white truncate">
            {shift.summary_data?.job_name || shift.notes || 'Chi tiết công việc'}
          </div>
          <div className="text-[11px] text-slate-400">
            Mở: {formatDateTime(shift.opened_at)} → Đóng: {formatDateTime(shift.closed_at)}
          </div>
        </div>
        {onOpenAlbum && (
          <button
            type="button"
            onClick={() => onOpenAlbum(shift)}
            className="px-2.5 py-1.5 mr-2 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-1"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Ảnh</span>
          </button>
        )}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-[#0f172a] border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`py-2 rounded-xl text-xs font-extrabold border ${
            activeTab === 'summary'
              ? 'bg-indigo-600 border-indigo-400 text-white'
              : 'bg-[#1e293b] border-slate-700 text-slate-400'
          }`}
        >
          Báo cáo tổng hợp
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2 rounded-xl text-xs font-extrabold border ${
            activeTab === 'history'
              ? 'bg-indigo-600 border-indigo-400 text-white'
              : 'bg-[#1e293b] border-slate-700 text-slate-400'
          }`}
        >
          Lịch sử ({journals.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : activeTab === 'summary' ? (
          <>
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-3 space-y-2">
              <div className="text-xs font-extrabold text-sky-400">
                1. Tổng hợp theo Mặt Hàng ({prodSummary.length})
              </div>
              {prodSummary.length === 0 ? (
                <div className="text-xs text-slate-500 italic">Không có dữ liệu mặt hàng.</div>
              ) : (
                <div className="divide-y divide-slate-700/60">
                  {prodSummary.map((p, idx) => {
                    const targetName = (p.product_name || '').trim().toLowerCase()
                    const matchingJournalIds = new Set(
                      journals
                        .filter(j => (j.item_name || '').trim().toLowerCase() === targetName)
                        .map(j => j.id)
                    )
                    const prodImages = shiftImages.filter(img => {
                      const imgItem = (img.item_name || '').trim().toLowerCase()
                      return imgItem === targetName || (img.journal_id && matchingJournalIds.has(img.journal_id))
                    })
                    return (
                    <div
                      key={`${p.product_name}_${p.unit}_${idx}`}
                      className="py-2 flex items-center justify-between text-xs gap-1.5"
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="font-bold text-white">{p.product_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-indigo-300">{p.unit}</span>
                          {prodImages.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewContext({
                                  images: prodImages,
                                  index: 0,
                                  title: p.product_name,
                                  showDirectionFilter: true,
                                  directionFilter: 'all',
                                })
                              }
                              className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold flex items-center gap-1"
                            >
                              <Camera className="w-2.5 h-2.5" />
                              <span>{prodImages.length} ảnh</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="w-14 text-right font-extrabold text-emerald-400">
                        +{p.in_qty}
                      </div>
                      <div className="w-14 text-right font-extrabold text-rose-400">
                        -{p.out_qty}
                      </div>
                      <div className="w-10 text-right text-slate-400 text-[11px]">{p.count} đợt</div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-3 space-y-2">
              <div className="text-xs font-extrabold text-indigo-400">
                2. Tổng hợp theo Đơn Vị Tính ({unitSummary.length})
              </div>
              {unitSummary.map(([uName, uVal]) => (
                <div
                  key={uName}
                  className="py-1.5 flex items-center justify-between text-xs border-b border-slate-700/50 last:border-0"
                >
                  <span className="font-bold text-white">{uName}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-extrabold text-emerald-400">+{uVal.in_qty}</span>
                    <span className="font-extrabold text-rose-400">-{uVal.out_qty}</span>
                    <span className="text-slate-400 text-[11px]">{uVal.count} đợt</span>
                  </div>
                </div>
              ))}
            </div>

            {effectiveSubShifts.length > 0 && (
              <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-3 space-y-2">
                <div className="text-xs font-extrabold text-amber-400">
                  3. Các lần chốt ca tạm ({effectiveSubShifts.length})
                </div>
                {effectiveSubShifts.map(sub => {
                  const isExpanded = expandedSubShifts.has(sub.id)
                  const subProds =
                    sub._subLines.length > 0 && shift
                      ? aggregateShiftsProducts([shift], sub._subLines)
                      : Object.values(sub.summary_data?.products_summary || {}).map((p: any) => ({
                          product_name: p.product_name,
                          unit: p.unit,
                          in_qty: p.in_qty ?? p.received ?? 0,
                          out_qty: p.out_qty ?? p.sent ?? 0,
                          count: p.count ?? (p.in_count || 0) + (p.out_count || 0),
                        }))
                  const totalIn = subProds.reduce((s, p) => s + (Number(p.in_qty) || 0), 0)
                  const totalOut = subProds.reduce((s, p) => s + (Number(p.out_qty) || 0), 0)
                  const totalCount =
                    sub._subLines.length > 0
                      ? sub._subLines.length
                      : sub.summary_data?.total_records ?? subProds.reduce((s, p) => s + (p.count || 0), 0)

                  return (
                    <div
                      key={sub.id}
                      className="rounded-lg bg-[#0f172a] border border-slate-700 text-xs overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSubShiftExpand(sub.id)}
                        className="w-full p-2.5 text-left hover:bg-slate-800/40 transition flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-amber-300 flex items-center gap-1.5 flex-wrap">
                            <span>Lần chốt tạm #{sub.sub_shift_number}</span>
                            {sub.is_auto_final && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold">
                                {shift?.status === 'closed' ? 'Đợt cuối ca' : 'Đợt đang nhập'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDateTime(sub.from_time)} → {formatDateTime(sub.to_time)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] font-bold whitespace-nowrap">
                            <span className="text-emerald-400">+{totalIn}</span>
                            <span className="mx-1 text-slate-600">|</span>
                            <span className="text-rose-400">-{totalOut}</span>
                            <span className="mx-1 text-slate-600">|</span>
                            <span className="text-slate-300">{totalCount} đợt</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-800 space-y-2">
                          <div className="text-[10px] font-extrabold uppercase text-slate-400">
                            Hàng hóa giao nhận trong đợt #{sub.sub_shift_number}
                          </div>
                          {subProds.length === 0 ? (
                            <div className="text-[11px] text-slate-500 italic">
                              Không có phát sinh sản phẩm trong đợt này.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-800/80 bg-[#1e293b]/50 rounded-lg px-2">
                              {subProds.map((p, pIdx) => {
                                const subProdImages = getSubShiftProductImages(
                                  p.product_name,
                                  sub._subLines,
                                  sub.from_time,
                                  sub.to_time
                                )
                                return (
                                <div
                                  key={`${p.product_name}_${p.unit}_${pIdx}`}
                                  className="py-1.5 flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-white truncate">{p.product_name}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-indigo-300">{p.unit}</span>
                                      {subProdImages.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewContext({
                                              images: subProdImages,
                                              index: 0,
                                              title: `${p.product_name} (Đợt #${sub.sub_shift_number})`,
                                              showDirectionFilter: true,
                                              directionFilter: 'all',
                                            })
                                          }
                                          className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold flex items-center gap-1"
                                        >
                                          <Camera className="w-2.5 h-2.5" />
                                          <span>{subProdImages.length} ảnh</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="w-12 text-right font-extrabold text-emerald-400">
                                    +{p.in_qty}
                                  </div>
                                  <div className="w-12 text-right font-extrabold text-rose-400">
                                    -{p.out_qty}
                                  </div>
                                  <div className="w-10 text-right text-slate-400 text-[10px]">
                                    {p.count} đợt
                                  </div>
                                </div>
                                )
                              })}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                            <span>Người bàn giao: <strong className="text-slate-200">{sub.closed_by_name || 'NV'}</strong></span>
                            {sub.notes && (
                              <span className="italic text-slate-400 truncate max-w-[55%]">
                                &ldquo;{sub.notes}&rdquo;
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {journals.map(j => {
              const isIn = j.direction === 'in'
              const cleanNote = extractCleanUserNote(j.notes)
              const rowImages = shiftImages.filter(img => img.journal_id === j.id)
              return (
                <div
                  key={j.id}
                  className="p-2.5 rounded-xl bg-[#1e293b] border border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white">{j.item_name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatDateTime(j.sent_at)} • {j.sent_by_name || 'NV'}
                      </div>
                      {cleanNote && (
                        <div className="text-[11px] text-amber-300 mt-0.5 italic">📝 {cleanNote}</div>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shrink-0 ${
                        isIn
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {isIn ? '+' : '-'}
                      {j.quantity_sent} {j.unit}
                    </span>
                  </div>
                  {rowImages.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5">
                      {rowImages.map((img, imgIdx) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() =>
                            setPreviewContext({
                              images: rowImages,
                              index: imgIdx,
                              title: j.item_name,
                            })
                          }
                          className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-600 shrink-0 bg-slate-900"
                        >
                          <img
                            src={getOperationImageDisplayUrl(img)}
                            alt={img.item_name || 'Ảnh đợt'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 bg-[#1e293b] border-t border-slate-700 flex items-center gap-2">
        <button
          type="button"
          disabled={processing}
          onClick={handleReopen}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Mở Lại Công Việc</span>
        </button>
        <button
          type="button"
          disabled={processing}
          onClick={handleDelete}
          className="w-11 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {previewContext && (() => {
        const { images: rawList, index: rawIdx, title, showDirectionFilter, directionFilter = 'all' } = previewContext
        const inCount = rawList.filter(x => x.direction === 'in').length
        const outCount = rawList.filter(x => x.direction === 'out').length
        const navList =
          directionFilter === 'in'
            ? rawList.filter(x => x.direction === 'in')
            : directionFilter === 'out'
              ? rawList.filter(x => x.direction === 'out')
              : rawList
        const curIdx = Math.min(rawIdx, Math.max(0, navList.length - 1))
        const curImg = navList[curIdx]
        const hasPrev = curIdx > 0
        const hasNext = curIdx < navList.length - 1
        return (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewContext(null)}
        >
          <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap pr-14" onClick={e => e.stopPropagation()}>
            <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-extrabold">
              {navList.length > 0 ? `${curIdx + 1} / ${navList.length}` : '0 / 0'}
            </span>
            {curImg?.direction === 'in' && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold">
                NHẬP
              </span>
            )}
            {curImg?.direction === 'out' && (
              <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">
                XUẤT
              </span>
            )}
            {title && (
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-slate-200 text-[11px] font-bold truncate max-w-[200px]">
                {title}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPreviewContext(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          {showDirectionFilter && (
            <div
              className="mb-3 mt-10 flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-full border border-slate-700"
              onClick={e => e.stopPropagation()}
            >
              {[
                { key: 'all', label: `Tất cả (${rawList.length})` },
                { key: 'in', label: `Nhập (${inCount})` },
                { key: 'out', label: `Xuất (${outCount})` },
              ].map(tab => {
                const active = directionFilter === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() =>
                      setPreviewContext(prev =>
                        prev ? { ...prev, directionFilter: tab.key as any, index: 0 } : null
                      )
                    }
                    className={`px-3 py-1 rounded-full text-xs font-extrabold transition ${
                      active
                        ? tab.key === 'in'
                          ? 'bg-emerald-600 text-white'
                          : tab.key === 'out'
                            ? 'bg-rose-600 text-white'
                            : 'bg-sky-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}
          {hasPrev && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setPreviewContext(prev => (prev ? { ...prev, index: Math.max(0, curIdx - 1) } : null))
              }}
              className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/65 border border-white/25 text-white flex items-center justify-center active:scale-95"
              title="Ảnh trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {curImg ? (
            <img
              src={getOperationImageDisplayUrl(curImg)}
              alt={curImg.item_name || 'Ảnh chi tiết'}
              className="max-w-full max-h-[78vh] rounded-xl object-contain"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div
              className="px-6 py-10 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 text-xs font-bold"
              onClick={e => e.stopPropagation()}
            >
              Không có ảnh {directionFilter === 'in' ? 'Nhập' : 'Xuất'} nào cho sản phẩm này.
            </div>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setPreviewContext(prev => (prev ? { ...prev, index: curIdx + 1 } : null))
              }}
              className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/65 border border-white/25 text-white flex items-center justify-center active:scale-95"
              title="Ảnh tiếp theo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          {curImg && (
            <div className="mt-3 text-center text-xs text-slate-300">
              {curImg.item_name} • {curImg.captured_by_name || 'Nhân viên'}
            </div>
          )}
        </div>
        )
      })()}
    </div>
  )
}

// ── 10. RECONCILE TAB VIEW (THAM CHIẾU SỐ ĐẦU - SỐ ĐUÔI / ĐẾM TỒN) ──
export function ReconcileTabView({
  productStats,
  unitStats,
  sessions,
  onSaveSessions,
  shift,
  user,
  onImagesChanged,
}: {
  productStats: { name: string; unit: string; inQty: number; outQty: number; count: number }[]
  unitStats: { unit: string; inQty: number; outQty: number; count: number }[]
  sessions: ReconcileSession[]
  onSaveSessions: (next: ReconcileSession[]) => void
  shift?: DeliveryShift | null
  user?: any
  onImagesChanged?: () => void
}) {
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [shiftImages, setShiftImages] = useState<OperationImageRecord[]>([])
  const [uploadingPhase, setUploadingPhase] = useState<'start' | 'end' | null>(null)

  const targets = useMemo(() => {
    const list: {
      key: string
      label: string
      product_name: string
      unit: string
      inQty: number
      outQty: number
    }[] = []

    if (unitStats.length > 0) {
      for (const u of unitStats) {
        list.push({
          key: `UNIT___${u.unit}`,
          label: `📦 Tổng ĐVT: ${u.unit}`,
          product_name: `Tổng ${u.unit}`,
          unit: u.unit,
          inQty: u.inQty,
          outQty: u.outQty,
        })
      }
    }
    for (const p of productStats) {
      list.push({
        key: `${p.name}___${p.unit}`,
        label: `${p.name} (${p.unit})`,
        product_name: p.name,
        unit: p.unit,
        inQty: p.inQty,
        outQty: p.outQty,
      })
    }
    return list
  }, [productStats, unitStats])

  useEffect(() => {
    if (!selectedKey && targets.length > 0) {
      setSelectedKey(targets[0].key)
    }
  }, [targets, selectedKey])

  useEffect(() => {
    if (!shift?.id) return
    getShiftOperationImages(shift.id)
      .then(setShiftImages)
      .catch(() => {})
  }, [shift?.id])

  const currentTarget = targets.find(t => t.key === selectedKey) || targets[0]

  const currentSession: ReconcileSession = useMemo(() => {
    if (!currentTarget) {
      return {
        key: 'default',
        product_name: '',
        unit: 'Thùng',
        calcType: 'range',
        mode: 'in',
        batches: [{ id: '1', startSeq: '', endSeq: '' }],
      }
    }
    const found = sessions.find(s => s.key === currentTarget.key)
    if (found) return found
    return {
      key: currentTarget.key,
      product_name: currentTarget.product_name,
      unit: currentTarget.unit,
      calcType: 'range',
      mode: currentTarget.inQty >= currentTarget.outQty ? 'in' : 'out',
      batches: [{ id: '1', startSeq: '', endSeq: '' }],
      countExisting: '',
      countStt: '',
    }
  }, [currentTarget, sessions])

  const updateCurrentSession = (patch: Partial<ReconcileSession>) => {
    if (!currentTarget) return
    const updated: ReconcileSession = {
      ...currentSession,
      ...patch,
      updated_at: new Date().toISOString(),
    }
    const others = sessions.filter(s => s.key !== currentTarget.key)
    onSaveSessions([...others, updated])
  }

  if (targets.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 italic">
        Chưa có phát sinh nhập/xuất để đối chiếu tham chiếu.
      </div>
    )
  }

  // Tính tổng số tham chiếu
  const refTotal = (() => {
    if (currentSession.calcType === 'count') {
      const a = parseFloat(currentSession.countExisting || '0') || 0
      const b = parseFloat(currentSession.countStt || '0') || 0
      return a + b
    }
    return (currentSession.batches || []).reduce((sum, b) => {
      const s = parseInt(b.startSeq, 10)
      const e = parseInt(b.endSeq, 10)
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        return sum + (e - s + 1)
      }
      return sum
    }, 0)
  })()

  const actualTotal =
    currentSession.mode === 'in'
      ? currentTarget?.inQty || 0
      : currentSession.mode === 'out'
        ? currentTarget?.outQty || 0
        : Math.abs((currentTarget?.inQty || 0) - (currentTarget?.outQty || 0))

  const diff = Number((actualTotal - refTotal).toFixed(2))

  const refTagPrefix = `[THAM_CHIEU:${currentSession.key}`
  const startPhotos = shiftImages.filter(i => i.notes?.startsWith(`${refTagPrefix}:start]`))
  const endPhotos = shiftImages.filter(i => i.notes?.startsWith(`${refTagPrefix}:end]`))

  const handleAddRefPhoto = async (phase: 'start' | 'end', fromCamera: boolean) => {
    if (!shift) return
    setUploadingPhase(phase)
    try {
      const refWmMeta = {
        systemCode: shift.system_code,
        jobName: shift.summary_data?.job_name || shift.notes || 'Công việc',
        itemName: `${currentTarget?.product_name || 'Tham chiếu'} (${phase === 'start' ? 'ĐẦU' : 'CUỐI'})`,
        unit: currentTarget?.unit || null,
        userName: user?.full_name || user?.email || null,
      }
      const picked = fromCamera
        ? await capturePhotoWithCamera(refWmMeta).then(p => (p ? [p] : []))
        : await pickPhotosFromLibrary(4, refWmMeta)
      if (picked.length === 0) return
      await uploadOperationImages({
        images: picked,
        systemCode: shift.system_code,
        companyId: shift.company_id || user?.company_id || null,
        shiftId: shift.id,
        scope: 'shift',
        jobName: shift.summary_data?.job_name || shift.notes || 'Công việc',
        itemName: currentTarget?.product_name || 'Tham chiếu',
        unit: currentTarget?.unit || null,
        notes: `[THAM_CHIEU:${currentSession.key}:${phase}] Ảnh tham chiếu ${phase === 'start' ? 'ĐẦU' : 'CUỐI'}`,
        user,
      })
      const refreshed = await getShiftOperationImages(shift.id)
      setShiftImages(refreshed)
      onImagesChanged?.()
    } finally {
      setUploadingPhase(null)
    }
  }

  return (
    <div className="p-3 space-y-3">
      {/* Chọn mặt hàng / ĐVT đối chiếu */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {targets.map(t => {
          const active = t.key === currentTarget?.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelectedKey(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                active
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-[#0f172a] border-slate-700 text-slate-300'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Kiểu tính & Chiều đối chiếu */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => updateCurrentSession({ calcType: 'range' })}
          className={`py-2 rounded-xl text-xs font-extrabold border ${
            currentSession.calcType === 'range'
              ? 'bg-sky-600 border-sky-400 text-white'
              : 'bg-[#0f172a] border-slate-700 text-slate-400'
          }`}
        >
          Số đầu → Số đuôi
        </button>
        <button
          type="button"
          onClick={() => updateCurrentSession({ calcType: 'count' })}
          className={`py-2 rounded-xl text-xs font-extrabold border ${
            currentSession.calcType === 'count'
              ? 'bg-sky-600 border-sky-400 text-white'
              : 'bg-[#0f172a] border-slate-700 text-slate-400'
          }`}
        >
          Đếm Tồn + Đếm STT
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { k: 'in', label: `So Nhập (+${currentTarget?.inQty || 0})` },
          { k: 'out', label: `So Xuất (-${currentTarget?.outQty || 0})` },
          { k: 'net', label: 'Cân đối' },
        ].map(m => (
          <button
            key={m.k}
            type="button"
            onClick={() => updateCurrentSession({ mode: m.k as any })}
            className={`py-1.5 rounded-lg text-[11px] font-bold border ${
              currentSession.mode === m.k
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : 'bg-[#0f172a] border-slate-700 text-slate-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Ô nhập Số đầu - Số đuôi hoặc Đếm Tồn */}
      {currentSession.calcType === 'range' ? (
        <div className="space-y-2">
          {(currentSession.batches || []).map((b, idx) => {
            const s = parseInt(b.startSeq, 10)
            const e = parseInt(b.endSeq, 10)
            const count = !isNaN(s) && !isNaN(e) && e >= s ? e - s + 1 : 0
            return (
              <div key={b.id} className="flex items-center gap-2 bg-[#0f172a] p-2 rounded-xl border border-slate-700">
                <span className="text-[11px] font-bold text-slate-400 w-10">Lô #{idx + 1}</span>
                <input
                  type="number"
                  placeholder="Số đầu"
                  value={b.startSeq}
                  onChange={ev => {
                    const next = currentSession.batches.map(r =>
                      r.id === b.id ? { ...r, startSeq: ev.target.value } : r
                    )
                    updateCurrentSession({ batches: next })
                  }}
                  className="w-20 px-2 py-1.5 rounded-lg bg-[#1e293b] border border-slate-700 text-xs font-bold text-white text-center"
                />
                <span className="text-slate-500">→</span>
                <input
                  type="number"
                  placeholder="Số đuôi"
                  value={b.endSeq}
                  onChange={ev => {
                    const next = currentSession.batches.map(r =>
                      r.id === b.id ? { ...r, endSeq: ev.target.value } : r
                    )
                    updateCurrentSession({ batches: next })
                  }}
                  className="w-20 px-2 py-1.5 rounded-lg bg-[#1e293b] border border-slate-700 text-xs font-bold text-white text-center"
                />
                <span className="flex-1 text-right text-xs font-extrabold text-sky-400">
                  = {count}
                </span>
                {currentSession.batches.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentSession({
                        batches: currentSession.batches.filter(r => r.id !== b.id),
                      })
                    }
                    className="p-1 text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() =>
              updateCurrentSession({
                batches: [
                  ...(currentSession.batches || []),
                  { id: String(Date.now()), startSeq: '', endSeq: '' },
                ],
              })
            }
            className="w-full py-1.5 rounded-xl border border-dashed border-sky-500/50 text-sky-400 text-xs font-bold flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm dải STT mới</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 bg-[#0f172a] p-2.5 rounded-xl border border-slate-700">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Đếm Tồn hiện có
            </label>
            <input
              type="number"
              value={currentSession.countExisting || ''}
              onChange={e => updateCurrentSession({ countExisting: e.target.value })}
              placeholder="0"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1e293b] border border-slate-700 text-xs font-bold text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Đếm theo STT
            </label>
            <input
              type="number"
              value={currentSession.countStt || ''}
              onChange={e => updateCurrentSession({ countStt: e.target.value })}
              placeholder="0"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1e293b] border border-slate-700 text-xs font-bold text-white"
            />
          </div>
        </div>
      )}

      {/* Kết quả đối chiếu */}
      <div
        className={`p-3 rounded-xl border flex items-center justify-between ${
          diff === 0
            ? 'bg-emerald-950/30 border-emerald-500/40'
            : 'bg-amber-950/30 border-amber-500/40'
        }`}
      >
        <div className="text-xs space-y-0.5">
          <div className="text-slate-300">
            Thực tế ghi nhận: <b className="text-white">{actualTotal}</b> • Tham chiếu:{' '}
            <b className="text-sky-400">{refTotal}</b>
          </div>
          <div
            className={`font-extrabold ${diff === 0 ? 'text-emerald-400' : 'text-amber-300'}`}
          >
            {diff === 0
              ? '✓ Khớp tuyệt đối (Chênh lệch: 0)'
              : `⚠ Lệch: ${diff > 0 ? `+${diff}` : diff} ${currentTarget?.unit || ''}`}
          </div>
        </div>
        <Scale className={`w-5 h-5 ${diff === 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
      </div>

      {/* Ảnh tham chiếu ĐẦU / CUỐI */}
      {shift && (
        <div className="grid grid-cols-2 gap-2">
          {(['start', 'end'] as const).map(phase => {
            const list = phase === 'start' ? startPhotos : endPhotos
            return (
              <div
                key={phase}
                className="p-2.5 rounded-xl bg-[#0f172a] border border-slate-700 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-amber-300">
                    📌 Ảnh {phase === 'start' ? 'ĐẦU CA' : 'CUỐI CA'} ({list.length})
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={uploadingPhase === phase}
                    onClick={() => handleAddRefPhoto(phase, true)}
                    className="flex-1 py-1.5 rounded-lg bg-sky-600/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Chụp</span>
                  </button>
                  <button
                    type="button"
                    disabled={uploadingPhase === phase}
                    onClick={() => handleAddRefPhoto(phase, false)}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Thư viện</span>
                  </button>
                </div>
                {list.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pt-1">
                    {list.map(img => (
                      <div
                        key={img.id}
                        className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-600 shrink-0"
                      >
                        <img
                          src={getOperationImageDisplayUrl(img)}
                          alt="ref"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteOperationImage(img)
                            setShiftImages(prev => prev.filter(x => x.id !== img.id))
                            onImagesChanged?.()
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-rose-300 flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 10. QUICK SNAP QUEUE MODAL (HÀNG CHỜ ẢNH CHỤP NHANH) ─────────────────────────
export function QuickSnapQueueModal({
  visible,
  snaps,
  openShifts,
  allProducts,
  recentProducts,
  onClose,
  onCaptureMore,
  onDeleteSnap,
  onChangeSnapShift,
  onSaveToShiftAlbum,
  onAssignSnap,
}: {
  visible: boolean
  snaps: QuickSnapItem[]
  openShifts: DeliveryShift[]
  allProducts: ShiftProductItem[]
  recentProducts: ShiftProductItem[]
  onClose: () => void
  onCaptureMore: () => void
  onDeleteSnap: (id: string) => Promise<void>
  onChangeSnapShift: (snapId: string, shift: DeliveryShift) => Promise<void>
  onSaveToShiftAlbum: (snap: QuickSnapItem) => void
  onAssignSnap: (
    snap: QuickSnapItem,
    payload: {
      product: ShiftProductItem
      direction: 'in' | 'out'
      quantity: number
      unit: string
      notes: string
    }
  ) => void
}) {
  const [selectedId, setSelectedId] = useState<string>('')
  const [query, setQuery] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<ShiftProductItem | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<string>('')
  const [qtyStr, setQtyStr] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [recentlyAssignedIds, setRecentlyAssignedIds] = useState<string[]>([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!visible || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setViewportHeight(vv.height)
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    if (snaps.length > 0 && !snaps.some(s => s.id === selectedId)) {
      setSelectedId(snaps[0].id)
    }
  }, [visible, snaps, selectedId])

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setSelectedProduct(null)
      setSelectedUnit('')
      setQtyStr('')
      setNotes('')
      setIsSearchFocused(false)
    }
  }, [visible])

  const activeSnap = useMemo(
    () => snaps.find(s => s.id === selectedId) || snaps[0] || null,
    [snaps, selectedId]
  )

  const unitOptions = useMemo(() => {
    if (!selectedProduct) return []
    const raw =
      selectedProduct.units && selectedProduct.units.length > 0
        ? selectedProduct.units
        : [selectedProduct.defaultUnit, selectedProduct.unit].filter((u): u is string =>
            Boolean(u && u.trim())
          )
    return Array.from(new Set(raw.map(u => u.trim()).filter(Boolean))).sort((a, b) => {
      const aBox = a.toLowerCase().includes('thùng') ? 0 : 1
      const bBox = b.toLowerCase().includes('thùng') ? 0 : 1
      return aBox - bBox
    })
  }, [selectedProduct])

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedUnit('')
      return
    }
    setSelectedUnit(unitOptions[0] || selectedProduct.defaultUnit || selectedProduct.unit || '')
  }, [selectedProduct, unitOptions])

  const activeShift = useMemo(
    () => (activeSnap ? openShifts.find(s => s.id === activeSnap.shiftId) || null : null),
    [openShifts, activeSnap]
  )

  const shiftPinnedProducts = useMemo(() => {
    const rawPinned: ShiftProductItem[] = Array.isArray(activeShift?.summary_data?.pinned_products)
      ? activeShift!.summary_data!.pinned_products!
      : []
    if (rawPinned.length === 0) return []
    const byId = new Map(allProducts.map(p => [p.id, p]))
    const bySku = new Map(
      allProducts.filter(p => p.sku).map(p => [String(p.sku).trim().toLowerCase(), p])
    )
    return rawPinned.map(p => {
      const fresh =
        byId.get(p.id) || (p.sku ? bySku.get(String(p.sku).trim().toLowerCase()) : undefined)
      return fresh ? { ...p, ...fresh } : p
    })
  }, [activeShift, allProducts])

  const quickPickProducts = useMemo(() => {
    const base = shiftPinnedProducts.length > 0 ? shiftPinnedProducts : recentProducts
    const byId = new Map<string, ShiftProductItem>()
    allProducts.forEach(p => byId.set(p.id, p))
    base.forEach(p => byId.set(p.id, p))

    const recentInOrder: ShiftProductItem[] = []
    const seen = new Set<string>()
    for (const id of recentlyAssignedIds) {
      const p = byId.get(id)
      if (p && !seen.has(p.id)) {
        seen.add(p.id)
        recentInOrder.push(p)
      }
    }
    for (const p of base) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        recentInOrder.push(p)
      }
    }
    return recentInOrder.slice(0, 12)
  }, [shiftPinnedProducts, recentProducts, allProducts, recentlyAssignedIds])

  useEffect(() => {
    setSelectedProduct(null)
    setQuery('')
  }, [activeSnap?.id, activeSnap?.shiftId])

  const suggestions = useMemo(() => {
    const q = normalizeViText(query.trim())
    if (!q) return []
    const tokens = q.split(/\s+/).filter(Boolean)
    const rankList = (list: ShiftProductItem[]) =>
      list
        .map(p => {
          const aliasNorm = normalizeViText(p.aliases)
          const skuNorm = normalizeViText(p.sku)
          const nameNorm = normalizeViText(p.name)
          const combined = `${aliasNorm} ${skuNorm} ${nameNorm}`
          if (!tokens.every(t => combined.includes(t))) return { p, score: 0 }
          let score = 10
          if (aliasNorm === q) score += 100
          else if (aliasNorm.includes(q)) score += 60
          if (skuNorm === q) score += 90
          else if (skuNorm.includes(q)) score += 50
          if (nameNorm.includes(q)) score += 30
          return { p, score }
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(x => x.p)

    if (shiftPinnedProducts.length > 0) {
      const inShift = rankList(shiftPinnedProducts)
      if (inShift.length > 0) return inShift
    }
    return rankList(allProducts)
  }, [query, shiftPinnedProducts, allProducts])

  if (!visible) return null

  const parsedQty = parseFloat(qtyStr)
  const validQty = Number.isFinite(parsedQty) && parsedQty > 0 ? Math.round(parsedQty * 100) / 100 : 0

  const handleAssign = (direction: 'in' | 'out') => {
    if (!activeSnap || !selectedProduct || validQty <= 0) return
    const assignedId = selectedProduct.id
    onAssignSnap(activeSnap, {
      product: selectedProduct,
      direction,
      quantity: validQty,
      unit: selectedUnit,
      notes: notes.trim(),
    })
    setRecentlyAssignedIds(prev => [assignedId, ...prev.filter(id => id !== assignedId)])
    setSelectedProduct(null)
    setQtyStr('')
    setNotes('')
    setQuery('')
  }

  const isTypingSearch = isSearchFocused || query.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#0f172a] border-t sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        style={viewportHeight ? { maxHeight: `${Math.round(viewportHeight * 0.94)}px` } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
          <div>
            <div className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>Ảnh Chụp Nhanh Chờ Gán</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black">
                {snaps.length}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Chụp trước lúc bận — gán SP &amp; số lượng khi giãn nhịp
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void onCaptureMore()}
              className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300 text-xs font-extrabold flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Chụp thêm</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {snaps.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-xs font-semibold text-slate-400">
              Không còn ảnh nào trong hàng chờ.
            </div>
            <button
              type="button"
              onClick={() => void onCaptureMore()}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Chụp Nhanh Ngay</span>
            </button>
          </div>
        ) : (
          <>
          <div className="p-3 overflow-y-auto overflow-x-hidden overscroll-contain space-y-3 flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Dải thumbnail các ảnh chờ (ẩn khi đang gõ tìm kiếm để không bị bàn phím che) */}
            {!isTypingSearch && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {snaps.map((s, idx) => {
                  const isSel = activeSnap?.id === s.id
                  const t = new Date(s.capturedAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`relative shrink-0 w-20 rounded-xl overflow-hidden border-2 cursor-pointer transition ${
                        isSel ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700 opacity-75'
                      }`}
                    >
                      <img
                        src={s.photo.dataUrl}
                        alt={`snap-${idx}`}
                        className="w-20 h-16 object-cover"
                      />
                      <div className="bg-[#1e293b] text-[10px] font-bold text-slate-300 text-center py-0.5">
                        {t}
                      </div>
                      <div className="bg-[#0f172a] text-[9px] font-extrabold text-indigo-300 text-center px-1 pb-0.5 truncate">
                        {s.jobName || 'Công việc'}
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          void onDeleteSnap(s.id)
                        }}
                        title="Xóa ảnh này"
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 text-rose-300 flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Công việc của ảnh đang chọn + Đổi CV + Lưu thẳng Album */}
            {!isTypingSearch && activeSnap && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#1e293b] border border-indigo-500/40">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-slate-400">THUỘC CÔNG VIỆC:</div>
                    <div className="text-xs font-extrabold text-indigo-200 truncate">
                      {activeSnap.jobName || 'Công việc'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSaveToShiftAlbum(activeSnap)}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 text-[11px] font-extrabold flex items-center gap-1 shrink-0"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Lưu thẳng Album</span>
                  </button>
                </div>

                {openShifts.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">Đổi CV:</span>
                    {openShifts.map(sh => {
                      const isCur = sh.id === activeSnap.shiftId
                      const shName = sh.summary_data?.job_name || sh.notes || 'Công việc'
                      return (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => void onChangeSnapShift(activeSnap.id, sh)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border transition ${
                            isCur
                              ? 'bg-indigo-600 border-indigo-400 text-white'
                              : 'bg-[#1e293b] border-slate-700 text-slate-300'
                          }`}
                        >
                          {shName}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Xem lớn ảnh đang chọn (ẩn khi đang gõ tìm kiếm, thu gọn khi đã chọn SP) */}
            {!isTypingSearch && activeSnap && (
              <div
                className={`rounded-xl overflow-hidden border border-slate-700 bg-black/50 flex items-center justify-center transition-all ${
                  selectedProduct ? 'max-h-28' : 'max-h-44'
                }`}
              >
                <img
                  src={activeSnap.photo.dataUrl}
                  alt="preview"
                  className={`${selectedProduct ? 'max-h-28' : 'max-h-44'} w-auto object-contain`}
                />
              </div>
            )}

            {/* Chọn nhanh SP theo Công việc của ảnh */}
            {!isTypingSearch && quickPickProducts.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-400">
                  {shiftPinnedProducts.length > 0
                    ? `Sản phẩm của công việc (${shiftPinnedProducts.length}):`
                    : 'Chọn nhanh sản phẩm vừa làm:'}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {quickPickProducts.map(rp => {
                    const active = selectedProduct?.id === rp.id
                    return (
                      <button
                        key={rp.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(rp)
                          setIsSearchFocused(false)
                          searchInputRef.current?.blur()
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap border transition ${
                          active
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-[#1e293b] border-slate-700 text-slate-300'
                        }`}
                      >
                        {rp.aliases ? `${rp.aliases} • ` : ''}
                        {rp.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tìm SP với Autocomplete (hiển thị gợi ý ngay phía trên ô gõ để không bị bàn phím che) */}
            <div className="relative space-y-1">
              {suggestions.length > 0 && (
                <div className="rounded-xl bg-[#1e293b] border border-indigo-500/40 max-h-56 overflow-y-auto divide-y divide-slate-700/60 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {suggestions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setSelectedProduct(p)
                        setQuery('')
                        setIsSearchFocused(false)
                        searchInputRef.current?.blur()
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white break-words leading-snug">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {p.aliases && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
                              {p.aliases}
                            </span>
                          )}
                          {p.sku && (
                            <span className="text-[10px] font-bold text-indigo-400">{p.sku}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">Chọn</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1e293b] border border-slate-700 focus-within:border-indigo-500">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 120)}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Gõ tên viết tắt (alias), SKU, tên SP..."
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setQuery('')}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* SP đang chọn + ĐVT + Số lượng */}
            {selectedProduct && (
              <div className="rounded-xl p-3 bg-[#1e293b] border border-indigo-500/40 space-y-2.5">
                <div className="text-xs font-extrabold text-white">{selectedProduct.name}</div>

                {unitOptions.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <span className="text-[11px] font-bold text-slate-400 shrink-0">ĐVT:</span>
                    {unitOptions.map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setSelectedUnit(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border ${
                          selectedUnit === u
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-[#0f172a] border-slate-700 text-slate-300'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={qtyStr}
                    onChange={e => setQtyStr(e.target.value)}
                    placeholder="Nhập số lượng..."
                    className="min-w-0 flex-1 px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-700 text-sm font-black text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                  {[1, 5, 10, 20].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setQtyStr(prev => {
                          const c = parseFloat(prev || '0') || 0
                          return String(Math.round((c + d) * 100) / 100)
                        })
                      }
                      className="shrink-0 px-2 py-2 rounded-lg bg-[#0f172a] border border-slate-700 text-indigo-300 text-xs font-extrabold"
                    >
                      +{d}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ghi chú (tùy chọn)..."
                  className="w-full px-3 py-1.5 rounded-xl bg-[#0f172a] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            )}
          </div>
          {selectedProduct && (
            <div className="grid grid-cols-2 gap-2 px-3 py-2.5 bg-[#0f172a] border-t border-slate-800 shrink-0">
              <button
                type="button"
                disabled={validQty <= 0}
                onClick={() => handleAssign('in')}
                className={`py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 ${
                  validQty <= 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>NHẬP KHO (+)</span>
              </button>
              <button
                type="button"
                disabled={validQty <= 0}
                onClick={() => handleAssign('out')}
                className={`py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 ${
                  validQty <= 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>XUẤT KHO (-)</span>
              </button>
            </div>
          )}
        </>
        )}
      </div>
    </div>
  )
}

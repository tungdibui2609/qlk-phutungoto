'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  Trash2,
  Send,
  Edit2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
} from 'lucide-react'
import type { DraftProposal, ProposalItem, SubmittedProposal, LookedUpLot } from './types'
import { fetchSubmittedProposals, lookupLotBySttOrCode } from './warehouseAdjustmentService'

interface Props {
  visible: boolean
  draft: DraftProposal
  initialTab?: 'DRAFT' | 'SUBMITTED'
  onClose: () => void
  onEditItem: (item: ProposalItem) => void
  onRemoveItem: (positionId: string) => void
  onClearAll: () => void
  onSubmitProposal: (note: string) => Promise<void>
}

export default function WarehouseDraftListModal({
  visible,
  draft,
  initialTab = 'DRAFT',
  onClose,
  onEditItem,
  onRemoveItem,
  onClearAll,
  onSubmitProposal,
}: Props) {
  const [activeTab, setActiveTab] = useState<'DRAFT' | 'SUBMITTED'>(initialTab)
  const [note, setNote] = useState(draft.note || '')
  const [submitting, setSubmitting] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  // Submitted proposals state
  const [submittedList, setSubmittedList] = useState<SubmittedProposal[]>([])
  const [loadingSubmitted, setLoadingSubmitted] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [submittedPosSearch, setSubmittedPosSearch] = useState<string>('')
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null)
  const [resolvedLotsMap, setResolvedLotsMap] = useState<Record<string, LookedUpLot>>({})

  const loadSubmitted = useCallback(async () => {
    setLoadingSubmitted(true)
    try {
      const list = await fetchSubmittedProposals()
      setSubmittedList(list)
    } finally {
      setLoadingSubmitted(false)
    }
  }, [])

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab)
      setConfirmClearAll(false)
      loadSubmitted()
    }
  }, [visible, initialTab, loadSubmitted])

  // Auto enrich ASSIGN_LOT items that lack product name
  useEffect(() => {
    if (!visible) return
    const allItems: ProposalItem[] = [
      ...draft.items,
      ...submittedList.flatMap(p => p.items || []),
    ]
    const sttsToLookup = Array.from(
      new Set(
        allItems
          .filter(i => i.action === 'ASSIGN_LOT' && i.new_stt && !i.new_product_name)
          .map(i => i.new_stt!.replace(/^#/, '').trim())
          .filter(s => s && !resolvedLotsMap[s])
      )
    )

    if (sttsToLookup.length === 0) return

    let cancelled = false
    ;(async () => {
      const newMap: Record<string, LookedUpLot> = {}
      for (const stt of sttsToLookup) {
        const found = await lookupLotBySttOrCode(stt)
        if (found && !cancelled) {
          newMap[stt] = found
        }
      }
      if (!cancelled && Object.keys(newMap).length > 0) {
        setResolvedLotsMap(prev => ({ ...prev, ...newMap }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [visible, draft.items, submittedList, resolvedLotsMap])

  const filteredSubmittedList = useMemo(() => {
    const posQuery = submittedPosSearch.trim().toUpperCase()
    return submittedList.filter(p => {
      const s = (p.status || 'PENDING').toUpperCase()
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING' && s !== 'PENDING') return false
        if (statusFilter === 'APPROVED' && s !== 'APPROVED' && s !== 'DONE' && s !== 'COMPLETED')
          return false
        if (statusFilter === 'REJECTED' && s !== 'REJECTED' && s !== 'CANCELLED') return false
      }
      if (posQuery) {
        const hasMatchingPos = (p.items || []).some(item =>
          (item.position_code || '').toUpperCase().includes(posQuery)
        )
        if (!hasMatchingPos) return false
      }
      return true
    })
  }, [submittedList, statusFilter, submittedPosSearch])

  const statusCounts = useMemo(() => {
    let pending = 0
    let approved = 0
    let rejected = 0
    for (const p of submittedList) {
      const s = (p.status || 'PENDING').toUpperCase()
      if (s === 'APPROVED' || s === 'DONE' || s === 'COMPLETED') approved++
      else if (s === 'REJECTED' || s === 'CANCELLED') rejected++
      else pending++
    }
    return { all: submittedList.length, pending, approved, rejected }
  }, [submittedList])

  if (!visible) return null

  const getActionBadge = (item: ProposalItem) => {
    switch (item.action) {
      case 'NOTE':
        return {
          label: '💬 GHI CHÚ',
          className:
            'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
          desc: item.reason || 'Có ghi chú gửi Web',
        }
      case 'CLEAR':
        return {
          label: 'XUẤT RỖNG (X)',
          className:
            'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
          desc: 'Trừ vị trí khỏi Lot (Ô thực tế trống)',
        }
      case 'SET_QTY': {
        const addedCount = item.sub_items ? item.sub_items.filter(s => s.is_new).length : 0
        if (item.sub_items && item.sub_items.length > 1) {
          return {
            label: addedCount > 0 ? `SỬA SL (+${addedCount} SP MỚI)` : 'SỬA SL TỪNG SP',
            className:
              'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
            desc: `Tổng SL mới: ${item.new_qty ?? 0} (${item.sub_items.length} mặt hàng)`,
          }
        }
        return {
          label: item.old_lot_id ? 'SỬA SỐ LƯỢNG' : 'TẠO LOT MỚI',
          className:
            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
          desc: `Số lượng mới: ${item.new_qty ?? 0} ${item.new_unit || item.old_unit || 'Thùng'}${
            item.new_product_name ? ` • ${item.new_product_name}` : ''
          }`,
        }
      }
      case 'ASSIGN_LOT': {
        const cleanStt = (item.new_stt || '').replace(/^#/, '').trim()
        const resolved = cleanStt ? resolvedLotsMap[cleanStt] : undefined
        const prodName = item.new_product_name || resolved?.product_name || ''
        const qtyVal = item.new_qty ?? resolved?.quantity
        const unitVal = item.new_unit || resolved?.unit || 'Thùng'
        const lotCodeVal = item.new_lot_code || resolved?.code || ''

        return {
          label: 'GẮN LOT VÀO Ô',
          className:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
          desc: `Gắn STT #${item.new_stt || '?'}${lotCodeVal ? ` (${lotCodeVal})` : ''}${
            prodName ? ` • ${prodName}` : ''
          }${qtyVal !== null && qtyVal !== undefined ? ` (${qtyVal} ${unitVal})` : ''}`,
        }
      }
      case 'MOVE':
        return {
          label: 'CHUYỂN VỊ TRÍ',
          className:
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
          desc: `Chuyển sang ô: ${item.target_position_code || '?'}`,
        }
    }
  }

  const getStatusBadge = (status: string) => {
    const s = (status || 'PENDING').toUpperCase()
    if (s === 'APPROVED' || s === 'DONE' || s === 'COMPLETED') {
      return {
        label: 'ĐÃ DUYỆT',
        className:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        Icon: CheckCircle2,
      }
    }
    if (s === 'REJECTED' || s === 'CANCELLED') {
      return {
        label: 'TỪ CHỐI',
        className:
          'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
        Icon: XCircle,
      }
    }
    return {
      label: 'CHỜ DUYỆT',
      className:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      Icon: Clock,
    }
  }

  const handleSubmit = async () => {
    if (draft.items.length === 0) return
    setSubmitting(true)
    try {
      await onSubmitProposal(note)
      await loadSubmitted()
      setActiveTab('SUBMITTED')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[115] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
          <div>
            <h3 className="text-[16px] font-black text-slate-900 dark:text-white tracking-tight">
              📋 Phiếu Đề Xuất Điều Chỉnh Kho
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Quản lý các vị trí ghi nháp &amp; lịch sử phiếu đã gửi lên Web
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('DRAFT')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'DRAFT'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            ✏️ Đang nháp ({draft.items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUBMITTED')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'SUBMITTED'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            📤 Đã gửi duyệt ({submittedList.length})
          </button>
        </div>

        {activeTab === 'DRAFT' ? (
          <>
            <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-3">
              {draft.items.length === 0 ? (
                <div className="py-10 text-center space-y-1.5">
                  <div className="text-sm font-black text-slate-700 dark:text-slate-300">
                    Chưa có vị trí nào trong phiếu nháp
                  </div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Bật chế độ &quot;Ghi nháp&quot; trên Sơ đồ kho và chạm vào ô bất kỳ để thêm điều chỉnh.
                  </p>
                </div>
              ) : (
                draft.items.map(item => {
                  const badge = getActionBadge(item)
                  return (
                    <div
                      key={item.position_id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin size={14} className="text-blue-600 shrink-0" />
                          <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                            {item.position_code}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 truncate">
                            • {item.zone_path}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-black shrink-0 ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Hiện trạng:{' '}
                        {item.old_product_name
                          ? `${item.old_stt ? `#${item.old_stt} • ` : ''}${item.old_product_name} (${
                              item.old_qty ?? 0
                            } ${item.old_unit || 'Thùng'})`
                          : 'Ô đang trống'}
                      </div>

                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        ➔ {badge.desc}
                      </div>

                      {item.action === 'SET_QTY' && item.sub_items && item.sub_items.length > 1 && (
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                          {item.sub_items.map((sub, sIdx) => (
                            <div key={sIdx} className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate pr-2">
                                {sub.is_new ? '➕ [Mới] ' : '• '}
                                {sub.product_name}
                              </span>
                              <span className="font-black text-blue-600 dark:text-blue-400 shrink-0">
                                {sub.is_new
                                  ? `+${sub.new_qty} ${sub.unit}`
                                  : `${sub.old_qty} ➔ ${sub.new_qty} ${sub.unit}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {item.reason && item.action !== 'NOTE' && (
                        <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          📝 Ghi chú: {item.reason}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                        <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Edit2 size={12} />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.position_id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}

              {draft.items.length > 0 && (
                <div className="pt-2">
                  <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                    Ghi chú chung của ca kiểm kho (tùy chọn):
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Nhập ghi chú gửi lên Web cho người duyệt..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              )}
            </div>

            {draft.items.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    <span>Xóa hết</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll()
                      setConfirmClearAll(false)
                    }}
                    className="px-3 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    <span>Xác nhận xóa?</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={15} />
                      <span>GỬI ĐỀ XUẤT DUYỆT ({draft.items.length})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter bar */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { key: 'ALL', label: `Tất cả (${statusCounts.all})` },
                    { key: 'PENDING', label: `🟡 Chờ duyệt (${statusCounts.pending})` },
                    { key: 'APPROVED', label: `🟢 Đã duyệt (${statusCounts.approved})` },
                    { key: 'REJECTED', label: `🔴 Từ chối (${statusCounts.rejected})` },
                  ].map(f => {
                    const active = statusFilter === f.key
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setStatusFilter(f.key as any)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-all ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={loadSubmitted}
                  disabled={loadingSubmitted}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 shrink-0"
                >
                  <RefreshCw size={14} className={loadingSubmitted ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={submittedPosSearch}
                  onChange={e => setSubmittedPosSearch(e.target.value)}
                  placeholder="Tìm theo mã vị trí (VD: K1D1A01...)"
                  className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none uppercase"
                />
                {submittedPosSearch.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSubmittedPosSearch('')}
                    className="text-slate-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-2.5">
              {loadingSubmitted && submittedList.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={22} className="animate-spin text-blue-600" />
                  <span className="text-xs font-semibold">Đang tải danh sách phiếu đã gửi...</span>
                </div>
              ) : filteredSubmittedList.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <div className="text-sm font-black text-slate-700 dark:text-slate-300">
                    Không có phiếu đề xuất nào
                  </div>
                  <p className="text-xs text-slate-500">
                    Các phiếu bạn gửi duyệt sẽ hiển thị tại đây kèm trạng thái.
                  </p>
                </div>
              ) : (
                filteredSubmittedList.map(prop => {
                  const st = getStatusBadge(prop.status)
                  const StIcon = st.Icon
                  const isExpanded = expandedProposalId === prop.id
                  const dateStr = new Date(prop.created_at).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })

                  return (
                    <div
                      key={prop.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedProposalId(isExpanded ? null : prop.id)}
                        className="w-full p-3.5 text-left flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {prop.title}
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                            🕒 {dateStr} • {prop.items.length} vị trí
                          </div>
                          {prop.note && (
                            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 truncate mt-0.5">
                              💬 {prop.note}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black ${st.className}`}
                          >
                            <StIcon size={11} />
                            <span>{st.label}</span>
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={16} className="text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/60 space-y-2 bg-white dark:bg-slate-900">
                          {prop.items.map((item, idx) => {
                            const badge = getActionBadge(item)
                            return (
                              <div
                                key={`${prop.id}-${item.position_id}-${idx}`}
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                                    📍 {item.position_code}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </div>
                                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  ➔ {badge.desc}
                                </div>
                                {item.reason && item.action !== 'NOTE' && (
                                  <div className="text-[10px] text-amber-700 dark:text-amber-400">
                                    📝 {item.reason}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

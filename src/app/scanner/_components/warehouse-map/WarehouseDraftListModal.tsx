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
  ClipboardList,
} from 'lucide-react'
import type { DraftProposal, ProposalItem, SubmittedProposal } from './types'
import { fetchSubmittedProposals, getCachedSubmittedProposals } from './warehouseAdjustmentService'

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
  const [notes, setNotes] = useState(draft.notes || '')
  const [submitting, setSubmitting] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  // Submitted proposals state
  const [submittedList, setSubmittedList] = useState<SubmittedProposal[]>([])
  const [loadingSubmitted, setLoadingSubmitted] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [submittedPosSearch, setSubmittedPosSearch] = useState<string>('')
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null)

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
    if (!visible) return
    setActiveTab(initialTab)
    setNotes(draft.notes || '')
    setConfirmClearAll(false)
    // Đọc cache nhanh trước để mở tức thì, rồi tải mới từ server
    getCachedSubmittedProposals().then(cached => {
      if (cached.length > 0) setSubmittedList(cached)
    })
    void loadSubmitted()
  }, [visible, initialTab, draft.notes, loadSubmitted])

  const filteredSubmittedList = useMemo(() => {
    const posQuery = submittedPosSearch.trim().toUpperCase()
    return submittedList.filter(p => {
      const s = (p.status || 'PENDING').toUpperCase()
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING' && s !== 'PENDING' && s !== 'PARTIAL') return false
        if (statusFilter === 'APPROVED' && s !== 'APPROVED' && s !== 'DONE' && s !== 'COMPLETED')
          return false
        if (statusFilter === 'REJECTED' && s !== 'REJECTED' && s !== 'CANCELLED') return false
      }
      if (posQuery) {
        const hasMatchingPos = (p.items || []).some(
          item =>
            (item.position_code || '').toUpperCase().includes(posQuery) ||
            (item.target_position_code || '').toUpperCase().includes(posQuery)
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
    switch (item.action_type) {
      case 'NOTE':
        return {
          label: '📝 GHI CHÚ',
          className: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
          desc: item.note || 'Có ghi chú gửi Web',
        }
      case 'CLEAR':
        return {
          label: 'XUẤT RỖNG (X)',
          className: 'bg-rose-950/60 text-rose-300 border-rose-500/40',
          desc: 'Trừ vị trí khỏi Lot (Ô thực tế trống)',
        }
      case 'SET_QTY': {
        const subs = item.sub_items || []
        const addedCount = subs.filter(s => s.is_new).length
        const isCreateNewLot = !item.lot_id
        if (isCreateNewLot) {
          return {
            label: `TẠO LOT MỚI (${item.new_quantity ?? 0} ${item.unit || 'th'})`,
            className: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
            desc:
              subs.length > 0
                ? `Tạo Lot mới: ${subs.length} SP • Tổng ${item.new_quantity ?? 0} ${item.unit || 'Thùng'}`
                : `Tạo Lot mới: ${item.new_quantity ?? 0} ${item.unit || 'Thùng'}`,
          }
        }
        if (subs.length > 1 || addedCount > 0) {
          return {
            label: addedCount > 0 ? `SỬA SL (+${addedCount} SP MỚI)` : `SỬA SL: ${item.new_quantity ?? 0} ${item.unit || 'th'}`,
            className: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
            desc: `Tổng SL: ${item.current_quantity ?? '---'} ➔ ${item.new_quantity ?? 0} ${item.unit || 'Thùng'} (${subs.length} SP)`,
          }
        }
        return {
          label: `SỬA SL: ${item.new_quantity ?? 0} ${item.unit || 'th'}`,
          className: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
          desc: `Số lượng: ${item.current_quantity ?? '---'} ➔ ${item.new_quantity ?? 0} ${item.unit || 'Thùng'}`,
        }
      }
      case 'ASSIGN_LOT': {
        return {
          label: `🏷️ STT: ${item.lot_stt || item.lot_code || '---'}`,
          className: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
          desc:
            item.lot_found === false
              ? `⚠️ Không tìm thấy Lot khớp STT ${item.lot_stt || '---'} trong kho`
              : `Gắn STT ${item.lot_stt || '?'}${item.lot_code ? ` (${item.lot_code})` : ''}${
                  item.product_name ? ` • ${item.product_name}` : ''
                }${item.new_quantity != null ? ` (${item.new_quantity} ${item.unit || 'Thùng'})` : ''}`,
        }
      }
      case 'MOVE':
        return {
          label: `➔ ${item.target_position_code || '---'}`,
          className: 'bg-sky-950/60 text-sky-300 border-sky-500/40',
          desc: `Chuyển sang ô: ${item.target_position_code || '?'}`,
        }
      default:
        return {
          label: 'ĐIỀU CHỈNH',
          className: 'bg-slate-800 text-slate-300 border-slate-700',
          desc: item.note || 'Điều chỉnh vị trí',
        }
    }
  }

  const getStatusBadge = (status: string) => {
    const s = (status || 'PENDING').toUpperCase()
    if (s === 'APPROVED' || s === 'DONE' || s === 'COMPLETED') {
      return {
        label: 'ĐÃ DUYỆT',
        className: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
        Icon: CheckCircle2,
      }
    }
    if (s === 'REJECTED' || s === 'CANCELLED') {
      return {
        label: 'TỪ CHỐI',
        className: 'bg-rose-950/60 text-rose-300 border-rose-500/40',
        Icon: XCircle,
      }
    }
    return {
      label: 'CHỜ DUYỆT',
      className: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
      Icon: Clock,
    }
  }

  const handleSubmit = async () => {
    if (draft.items.length === 0) return
    setSubmitting(true)
    try {
      await onSubmitProposal(notes)
      await loadSubmitted()
      setActiveTab('SUBMITTED')
    } finally {
      setSubmitting(false)
    }
  }

  const renderSubItemsBox = (item: ProposalItem) => {
    const subs = item.sub_items
    if (!subs || subs.length === 0) return null
    const showDetailed =
      subs.length > 1 || subs.some(s => s.is_new) || (!item.lot_id && item.action_type === 'SET_QTY')
    if (!showDetailed) return null

    return (
      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
        <div className="text-[10px] font-black text-amber-300 uppercase">
          {!item.lot_id
            ? `Lot mới (${subs.length} sản phẩm)`
            : `Chi tiết sản phẩm (${subs.length} dòng)`}
        </div>
        {subs.map((sub, sIdx) => (
          <div key={sIdx} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-slate-200 truncate pr-2">
              {sub.is_new ? '➕ [Mới] ' : '• '}
              {sub.product_name}
            </span>
            <span className="font-mono font-black shrink-0 text-emerald-400">
              {sub.is_new
                ? `+${sub.new_quantity} ${sub.unit}`
                : `${sub.current_quantity} ➔ ${
                    item.action_type === 'CLEAR' ? 0 : sub.new_quantity
                  } ${sub.unit}`}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] text-slate-100 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col shadow-2xl border border-slate-700/80 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-[#111827]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ClipboardList size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black text-white tracking-tight truncate">
                PHIẾU GHI NHÁP ĐIỀU CHỈNH
              </h3>
              <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                {draft.items.length} vị trí đang ghi nháp · Lịch sử đã gửi duyệt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 grid grid-cols-2 gap-1.5 p-2 bg-slate-900 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('DRAFT')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'DRAFT'
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            ✏️ Đang nháp ({draft.items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUBMITTED')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'SUBMITTED'
                ? 'bg-sky-500/20 border border-sky-500/50 text-sky-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            📤 Đã gửi duyệt ({submittedList.length})
          </button>
        </div>

        {activeTab === 'DRAFT' ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar p-4 space-y-3">
              {draft.items.length === 0 ? (
                <div className="py-10 text-center space-y-1.5">
                  <div className="text-sm font-black text-slate-200">
                    Chưa có vị trí nào trong phiếu nháp
                  </div>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Bật chế độ &quot;Ghi nháp&quot; trên Sơ đồ kho và chạm vào ô bất kỳ để thêm
                    điều chỉnh (Xuất rỗng, Sửa số lượng, Tạo Lot mới, Gắn STT, Chuyển ô).
                  </p>
                </div>
              ) : (
                draft.items.map(item => {
                  const badge = getActionBadge(item)
                  return (
                    <div
                      key={item.id || item.position_id}
                      className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin size={14} className="text-amber-400 shrink-0" />
                          <span className="text-sm font-black font-mono text-white">
                            {item.position_code}
                          </span>
                          {item.warehouse_name && (
                            <span className="text-[11px] font-medium text-slate-400 truncate">
                              • {item.warehouse_name}
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-black shrink-0 ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-200 leading-snug">
                        {item.product_name ||
                          (item.lot_id ? 'Hàng đông lạnh' : 'Ô đang trống trên hệ thống')}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                        {item.lot_code && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-cyan-300">
                            {item.lot_code}
                          </span>
                        )}
                        <span className="font-bold text-slate-200">➔ {badge.desc}</span>
                      </div>

                      {renderSubItemsBox(item)}

                      {item.note && item.action_type !== 'NOTE' && (
                        <div className="text-[11px] font-semibold text-amber-300">
                          💬 {item.note}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          className="px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-500/30 text-sky-300 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Edit2 size={12} />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.position_id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1"
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
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">
                    Ghi chú chung của ca kiểm kho (tùy chọn):
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Nhập ghi chú gửi lên Web cho người duyệt..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-white outline-none focus:border-amber-500 resize-none placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>

            {draft.items.length > 0 && (
              <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-slate-800 bg-[#111827]">
                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3 py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 shrink-0"
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
                    className="px-3 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-1 shrink-0"
                  >
                    <Trash2 size={14} />
                    <span>Xác nhận xóa?</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
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
            <div className="shrink-0 p-3 border-b border-slate-800 space-y-2 bg-slate-900/70">
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
                            ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
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
                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-sky-400 shrink-0"
                  title="Tải mới từ máy chủ"
                >
                  <RefreshCw size={14} className={loadingSubmitted ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={submittedPosSearch}
                  onChange={e => setSubmittedPosSearch(e.target.value)}
                  placeholder="Tìm theo mã vị trí (VD: K1D1A01...)"
                  className="flex-1 min-w-0 bg-transparent text-xs font-bold text-white outline-none uppercase placeholder:text-slate-500"
                />
                {submittedPosSearch.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSubmittedPosSearch('')}
                    className="text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar p-4 space-y-2.5">
              {loadingSubmitted && submittedList.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={22} className="animate-spin text-sky-400" />
                  <span className="text-xs font-semibold">Đang tải danh sách phiếu đã gửi...</span>
                </div>
              ) : filteredSubmittedList.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <div className="text-sm font-black text-slate-200">
                    Không có phiếu đề xuất nào
                  </div>
                  <p className="text-xs text-slate-400">
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
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedProposalId(isExpanded ? null : prop.id)}
                        className="w-full p-3.5 text-left flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {prop.code && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[10px] font-black">
                                {prop.code}
                              </span>
                            )}
                            <span className="text-xs font-black text-white truncate">
                              {prop.title}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                            🕒 {dateStr} • {prop.items.length} vị trí
                            {prop.created_by_name ? ` • ${prop.created_by_name}` : ''}
                          </div>
                          {prop.notes && (
                            <div className="text-[11px] font-semibold text-amber-300 truncate mt-0.5">
                              💬 {prop.notes}
                            </div>
                          )}
                          {prop.review_notes && (
                            <div className="text-[11px] font-semibold text-emerald-300 truncate mt-0.5">
                              ✅ Duyệt ({prop.approved_by_name || 'Web'}): {prop.review_notes}
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
                        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-800 space-y-2 bg-slate-950/60">
                          {prop.items.map((item, idx) => {
                            const badge = getActionBadge(item)
                            return (
                              <div
                                key={`${prop.id}-${item.id || item.position_id}-${idx}`}
                                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="text-xs font-black font-mono text-white">
                                    📍 {item.position_code}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </div>
                                {item.product_name && (
                                  <div className="text-[11px] font-bold text-slate-200">
                                    {item.product_name}
                                  </div>
                                )}
                                <div className="text-[11px] font-bold text-sky-300">
                                  ➔ {badge.desc}
                                </div>
                                {renderSubItemsBox(item)}
                                {item.note && item.action_type !== 'NOTE' && (
                                  <div className="text-[10px] text-amber-300">💬 {item.note}</div>
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

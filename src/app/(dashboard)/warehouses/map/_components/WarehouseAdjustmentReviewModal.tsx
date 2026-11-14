'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
    X,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Eye,
    RefreshCw,
    FileText,
    ArrowRight,
    MoveRight,
    Check,
    Loader2,
    Calendar,
    User,
    Layers,
    Filter,
    Search
} from 'lucide-react'
import {
    WarehouseProposal,
    ProposalItem,
    getWarehouseProposals,
    approveWarehouseProposal,
    rejectWarehouseProposal
} from '@/lib/warehouseAdjustmentService'
import { SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

interface WarehouseAdjustmentReviewModalProps {
    isOpen: boolean
    onClose: () => void
    supabase: SupabaseClient
    systemCode: string
    currentUserName?: string
    currentUserId?: string
    onFocusPosition?: (positionId: string, positionCode?: string) => void
    onProposalApproved?: () => void
    onStartVisualReview?: (proposal: WarehouseProposal, startIndex?: number) => void
}

export function WarehouseAdjustmentReviewModal({
    isOpen,
    onClose,
    supabase,
    systemCode,
    currentUserName,
    currentUserId,
    onFocusPosition,
    onProposalApproved,
    onStartVisualReview
}: WarehouseAdjustmentReviewModalProps) {
    const [proposals, setProposals] = useState<WarehouseProposal[]>([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
    const [positionQuery, setPositionQuery] = useState('')
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null)
    const [isApproving, setIsApproving] = useState(false)
    const [isRejecting, setIsRejecting] = useState(false)
    const [reviewNotes, setReviewNotes] = useState('')

    const loadProposals = useCallback(async () => {
        if (!systemCode) return
        setLoading(true)
        try {
            const list = await getWarehouseProposals(supabase, systemCode, statusFilter)
            setProposals(list)
            if (list.length > 0 && !selectedProposalId) {
                setSelectedProposalId(list[0].id)
            } else if (list.length === 0) {
                setSelectedProposalId(null)
            }
        } finally {
            setLoading(false)
        }
    }, [supabase, systemCode, statusFilter, selectedProposalId])

    useEffect(() => {
        if (isOpen) {
            loadProposals()
        }
    }, [isOpen, loadProposals])

    const selectedProposal = useMemo(() => {
        return proposals.find(p => p.id === selectedProposalId) || null
    }, [proposals, selectedProposalId])

    const pendingCount = useMemo(() => {
        return proposals.filter(p => p.status === 'PENDING').length
    }, [proposals])

    const normalizedPosQuery = positionQuery.trim().toUpperCase()

    const filteredProposals = useMemo(() => {
        if (!normalizedPosQuery) return proposals
        return proposals.filter(prop =>
            prop.items.some(it =>
                (it.position_code || '').toUpperCase().includes(normalizedPosQuery) ||
                (it.target_position_code || '').toUpperCase().includes(normalizedPosQuery)
            )
        )
    }, [proposals, normalizedPosQuery])

    const positionHistoryEntries = useMemo(() => {
        if (!normalizedPosQuery) return []
        const entries: Array<{ proposal: WarehouseProposal; item: ProposalItem; itemIndex: number }> = []
        for (const prop of filteredProposals) {
            prop.items.forEach((it, idx) => {
                const matchSrc = (it.position_code || '').toUpperCase().includes(normalizedPosQuery)
                const matchDst = (it.target_position_code || '').toUpperCase().includes(normalizedPosQuery)
                if (matchSrc || matchDst) {
                    entries.push({ proposal: prop, item: it, itemIndex: idx })
                }
            })
        }
        return entries
    }, [filteredProposals, normalizedPosQuery])

    const handleApprove = async () => {
        if (!selectedProposal || isApproving) return
        if (!window.confirm(`Bạn có chắc chắn muốn DUYỆT phiếu đề xuất và cập nhật ${selectedProposal.items.length} vị trí vào sơ đồ kho?`)) {
            return
        }

        setIsApproving(true)
        try {
            const res = await approveWarehouseProposal(supabase, selectedProposal, {
                id: currentUserId,
                name: currentUserName || 'Quản lý',
                notes: reviewNotes.trim() || undefined
            })

            if (res.success) {
                alert(`✅ Đã duyệt thành công và cập nhật ${res.appliedCount || selectedProposal.items.length} vị trí vào sơ đồ kho!`)
                setReviewNotes('')
                if (onProposalApproved) {
                    onProposalApproved()
                }
                await loadProposals()
            } else {
                alert(`❌ Lỗi khi duyệt: ${res.error}`)
            }
        } finally {
            setIsApproving(false)
        }
    }

    const handleReject = async () => {
        if (!selectedProposal || isRejecting) return
        const reason = window.prompt('Nhập lý do từ chối đề xuất này (tùy chọn):', reviewNotes)
        if (reason === null) return

        setIsRejecting(true)
        try {
            const res = await rejectWarehouseProposal(supabase, selectedProposal.id, {
                id: currentUserId,
                name: currentUserName || 'Quản lý',
                notes: reason.trim() || undefined
            })

            if (res.success) {
                alert('Đã từ chối phiếu đề xuất.')
                setReviewNotes('')
                await loadProposals()
            } else {
                alert(`❌ Lỗi: ${res.error}`)
            }
        } finally {
            setIsRejecting(false)
        }
    }

    const renderItemCard = (
        proposal: WarehouseProposal,
        it: ProposalItem,
        idx: number,
        displayIndex: number,
        showProposalMeta: boolean = false
    ) => {
        const isItemApproved = it.status === 'APPROVED' || proposal.status === 'APPROVED'
        return (
            <div
                key={`${proposal.id}-${it.id || idx}`}
                className="rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/40 p-4 transition space-y-3"
            >
                {showProposalMeta && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                                <Clock className="w-3 h-3" />
                                {proposal.created_at ? format(new Date(proposal.created_at), 'dd/MM/yyyy HH:mm:ss') : '---'}
                            </span>
                            {proposal.code && (
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                                    {proposal.code}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-slate-400">
                                <User className="w-3 h-3 text-blue-400" />
                                {proposal.created_by_name || 'Nhân viên'}
                            </span>
                        </div>
                        <div>
                            {proposal.status === 'PENDING' && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Chờ duyệt
                                </span>
                            )}
                            {proposal.status === 'APPROVED' && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Đã duyệt
                                </span>
                            )}
                            {proposal.status === 'REJECTED' && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    Từ chối
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Hàng 1: STT, Mã vị trí, Thao tác, Trước -> Sau, Nút soi */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-400 font-mono text-xs font-bold flex items-center justify-center">
                            {displayIndex + 1}
                        </span>

                        <div>
                            <span className="font-bold text-slate-100 text-sm font-mono bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
                                {it.position_code}
                            </span>
                            {it.warehouse_name && (
                                <span className="ml-2 text-xs text-slate-500">
                                    {it.warehouse_name}
                                </span>
                            )}
                        </div>

                        {it.action_type === 'CLEAR' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                                🔴 Xuất rỗng ô
                            </span>
                        )}
                        {it.action_type === 'SET_QTY' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                🟡 Sửa số lượng
                            </span>
                        )}
                        {it.action_type === 'MOVE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                                🔵 Chuyển vị trí
                            </span>
                        )}
                        {it.action_type === 'ASSIGN_LOT' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                🏷️ Gắn STT Lot
                            </span>
                        )}
                        {it.action_type === 'NOTE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                📝 Chỉ ghi chú
                            </span>
                        )}

                        {isItemApproved && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                ✓ Đã duyệt
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        {it.action_type === 'CLEAR' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 line-through">
                                    {it.current_quantity ?? 'Có hàng'} {it.unit || 'thùng'}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                                <span className="font-bold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                                    Trống ô (0)
                                </span>
                            </div>
                        )}
                        {it.action_type === 'SET_QTY' && !(it.sub_items && it.sub_items.length > 1) && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">
                                    {it.current_quantity ?? '--'}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                                <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                                    {it.new_quantity} {it.unit || 'thùng'}
                                </span>
                            </div>
                        )}
                        {it.action_type === 'MOVE' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-mono">
                                    {it.position_code}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="font-bold text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 font-mono">
                                    {it.target_position_code || 'Vị trí mới'}
                                </span>
                            </div>
                        )}
                        {it.action_type === 'ASSIGN_LOT' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">Gắn STT:</span>
                                <span className="font-bold text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-700/40 font-mono">
                                    {it.lot_stt || it.lot_code || '---'}
                                </span>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                if (onStartVisualReview && proposal.status === 'PENDING') {
                                    onStartVisualReview(proposal, idx)
                                    onClose()
                                } else if (onFocusPosition) {
                                    onFocusPosition(it.position_id, it.position_code)
                                    onClose()
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 transition text-xs font-semibold border border-slate-700 hover:border-amber-400 whitespace-nowrap"
                            title="Xem ô này trên sơ đồ kho"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Soi trên bản đồ</span>
                        </button>
                    </div>
                </div>

                {/* Hàng 2: Thông tin Mặt hàng & Lô (nếu có) */}
                {it.sub_items && it.sub_items.length > 1 ? (
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/70">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Pallet hỗn hợp ({it.sub_items.length} SP)
                            </span>
                            {it.lot_stt && (
                                <span className="text-purple-300 font-bold font-mono bg-purple-950/50 px-2 py-0.5 rounded border border-purple-700/50 text-[11px]">
                                    STT: {it.lot_stt}
                                </span>
                            )}
                            {it.lot_code && (
                                <span className="text-xs text-blue-400 font-mono">
                                    Lot: {it.lot_code}
                                </span>
                            )}
                            {it.action_type === 'SET_QTY' && (
                                <span className="text-xs text-amber-400 font-semibold ml-auto">
                                    Tổng sau sửa: {it.new_quantity} {it.unit || 'thùng'}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {it.sub_items.map((sub, sIdx) => (
                                <div key={sIdx} className="bg-slate-900/80 rounded-lg px-3 py-1.5 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                                    <div className="min-w-0">
                                        <div className="font-medium text-slate-200 truncate">
                                            {sub.product_name}
                                        </div>
                                        {sub.sku && (
                                            <div className="text-[10px] text-slate-500 font-mono">
                                                SKU: {sub.sku}
                                            </div>
                                        )}
                                    </div>
                                    {it.action_type === 'SET_QTY' && (
                                        <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                                            <span className="text-slate-400">{sub.current_quantity}</span>
                                            <ArrowRight className="w-3 h-3 text-amber-400" />
                                            <span className={`font-bold px-1.5 py-0.5 rounded border ${sub.new_quantity === 0 ? 'text-rose-400 bg-rose-950/40 border-rose-800/40' : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'}`}>
                                                {sub.new_quantity} {sub.unit || 'th'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : it.action_type === 'ASSIGN_LOT' && it.lot_found === false ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>
                            Không tìm thấy Lot nào khớp STT <strong className="font-mono">{it.lot_stt || '---'}</strong> trong phân hệ kho hiện tại.
                        </span>
                    </div>
                ) : (it.product_name || it.lot_code || it.action_type !== 'NOTE') ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-1 border-t border-slate-800/70">
                        <span className="font-medium text-slate-200">
                            {it.product_name || (it.action_type === 'NOTE' ? 'Ô trống' : 'Hàng đông lạnh')}
                        </span>
                        {it.lot_stt && (
                            <span className="text-purple-300 font-bold font-mono bg-purple-950/50 px-2 py-0.5 rounded border border-purple-700/50 text-[11px]">
                                STT: {it.lot_stt}
                            </span>
                        )}
                        {it.lot_code && (
                            <span className="text-blue-400 font-mono bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40 text-[11px]">
                                Lot: {it.lot_code}
                            </span>
                        )}
                        {it.action_type === 'ASSIGN_LOT' && it.new_quantity != null && (
                            <span className="text-emerald-300 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 text-[11px]">
                                SL: {it.new_quantity} {it.unit || 'Thùng'}
                            </span>
                        )}
                        {it.action_type === 'ASSIGN_LOT' && it.target_position_code && it.target_position_code !== it.position_code && (
                            <span className="text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 text-[11px]">
                                Đang ở ô {it.target_position_code} ➔ chuyển sang {it.position_code}
                            </span>
                        )}
                    </div>
                ) : null}

                {/* Hàng 3: Ghi chú thực tế */}
                {it.note && (
                    <div className={`rounded-lg px-3 py-2 border text-xs leading-relaxed ${
                        it.action_type === 'NOTE'
                            ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-200'
                            : 'bg-slate-900 border-slate-700/80 text-amber-200'
                    }`}>
                        <span className="font-bold mr-1.5">💬 Ghi chú:</span>
                        <span className="whitespace-pre-wrap break-words">{it.note}</span>
                    </div>
                )}
            </div>
        )
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-2 sm:p-4">
            <div className="relative w-[96vw] max-w-[1440px] h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-100">
                                    Duyệt Đề Xuất Điều Chỉnh Vị Trí Kho
                                </h2>
                                {pendingCount > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        {pendingCount} chờ duyệt
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400">
                                Tiếp nhận ghi nháp từ App và phê duyệt cập nhật trực tiếp vào sơ đồ kho
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => loadProposals()}
                            disabled={loading}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
                            title="Làm mới"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-950/60 border-b border-slate-800 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 mr-1 flex items-center gap-1">
                                <Filter className="w-3.5 h-3.5" /> Lọc:
                            </span>
                            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                                        statusFilter === st
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                    }`}
                                >
                                    {st === 'PENDING' && 'Chờ duyệt'}
                                    {st === 'APPROVED' && 'Đã duyệt'}
                                    {st === 'REJECTED' && 'Đã từ chối'}
                                    {st === 'ALL' && 'Tất cả'}
                                </button>
                            ))}
                        </div>

                        {/* Ô tìm kiếm theo vị trí */}
                        <div className="relative flex items-center ml-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                            <input
                                type="text"
                                value={positionQuery}
                                onChange={e => setPositionQuery(e.target.value)}
                                placeholder="Tìm theo mã vị trí (VD: K1D1A02T102)..."
                                className="w-64 sm:w-72 pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                            />
                            {positionQuery ? (
                                <button
                                    onClick={() => setPositionQuery('')}
                                    className="absolute right-2 text-slate-400 hover:text-white"
                                    title="Xóa tìm kiếm"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="text-slate-400">
                        {normalizedPosQuery ? (
                            <span>
                                Tìm thấy <strong className="text-amber-300">{positionHistoryEntries.length}</strong> lần nháp trong <strong className="text-slate-200">{filteredProposals.length}</strong> phiếu
                            </span>
                        ) : (
                            <span>
                                Tổng số: <strong className="text-slate-200">{filteredProposals.length}</strong> phiếu
                            </span>
                        )}
                    </div>
                </div>

                {/* Body: Split 2 columns */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Proposal List */}
                    <div className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col">
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {loading && proposals.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                                    <span>Đang tải danh sách...</span>
                                </div>
                            ) : filteredProposals.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-center p-4 text-slate-400">
                                    <FileText className="w-10 h-10 text-slate-600 mb-2" />
                                    <p className="font-semibold text-slate-300">
                                        {normalizedPosQuery ? `Không tìm thấy vị trí "${positionQuery.trim()}"` : 'Không có phiếu đề xuất nào'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {normalizedPosQuery
                                            ? 'Thử chọn tab "Tất cả" hoặc kiểm tra lại mã vị trí.'
                                            : 'Khi nhân viên ghi nháp trên App và bấm gửi, các phiếu sẽ hiển thị tại đây.'}
                                    </p>
                                </div>
                            ) : (
                                filteredProposals.map(prop => {
                                    const isSelected = prop.id === selectedProposalId
                                    return (
                                        <div
                                            key={prop.id}
                                            onClick={() => setSelectedProposalId(prop.id)}
                                            className={`p-3 rounded-xl cursor-pointer border transition ${
                                                isSelected
                                                    ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-950/50'
                                                    : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-1 mb-1">
                                                <span className="font-semibold text-xs text-slate-200 truncate flex-1">
                                                    {prop.title || 'Điều chỉnh vị trí'}
                                                </span>
                                                {prop.status === 'PENDING' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                                        Chờ duyệt
                                                    </span>
                                                )}
                                                {prop.status === 'APPROVED' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                                        Đã duyệt
                                                    </span>
                                                )}
                                                {prop.status === 'REJECTED' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                                                        Từ chối
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                                                <User className="w-3 h-3 text-slate-500" />
                                                <span className="truncate">{prop.created_by_name || 'Nhân viên'}</span>
                                                <span>•</span>
                                                <span>{prop.items.length} vị trí</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                                                <Clock className="w-3 h-3" />
                                                <span>
                                                    {prop.created_at
                                                        ? format(new Date(prop.created_at), 'dd/MM/yyyy HH:mm')
                                                        : ''}
                                                </span>
                                            </div>

                                            {prop.notes ? (
                                                <p className="text-[11px] text-amber-200/80 bg-amber-950/30 px-2 py-1 rounded mt-1.5 line-clamp-1 border border-amber-900/40">
                                                    💬 {prop.notes}
                                                </p>
                                            ) : null}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Proposal Details */}
                    <div className="flex-1 flex flex-col bg-slate-900/30 overflow-hidden">
                        {normalizedPosQuery ? (
                            <>
                                <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <Search className="w-4 h-4 text-amber-400" />
                                        <h3 className="text-sm font-bold text-white">
                                            Lịch sử nháp vị trí{' '}
                                            <span className="font-mono text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                                                {positionQuery.trim().toUpperCase()}
                                            </span>
                                        </h3>
                                        <span className="text-xs text-slate-400">
                                            ({positionHistoryEntries.length} lần nháp)
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setPositionQuery('')}
                                        className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700"
                                    >
                                        Xóa lọc vị trí
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                    {positionHistoryEntries.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
                                            <Search className="w-8 h-8 mb-2 opacity-40" />
                                            <span>Không có lần nháp nào khớp vị trí &quot;{positionQuery.trim()}&quot; trong mục đang lọc.</span>
                                        </div>
                                    ) : (
                                        positionHistoryEntries.map((entry, listIdx) =>
                                            renderItemCard(entry.proposal, entry.item, entry.itemIndex, listIdx, true)
                                        )
                                    )}
                                </div>
                            </>
                        ) : selectedProposal ? (
                            <>
                                {/* Proposal meta bar */}
                                <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-base font-bold text-white">
                                                    {selectedProposal.title}
                                                </h3>
                                                {selectedProposal.code && (
                                                    <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 font-mono">
                                                        {selectedProposal.code}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                <span className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-blue-400" />
                                                    Người gửi: <strong className="text-slate-200">{selectedProposal.created_by_name || 'Nhân viên'}</strong>
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                                    {selectedProposal.created_at
                                                        ? format(new Date(selectedProposal.created_at), 'dd/MM/yyyy HH:mm:ss')
                                                        : ''}
                                                </span>
                                            </div>

                                            {selectedProposal.notes && (
                                                <div className="mt-2 text-xs bg-amber-950/40 border border-amber-800/50 text-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                    <span className="font-semibold text-amber-400">Ghi chú ca:</span>
                                                    <span>{selectedProposal.notes}</span>
                                                </div>
                                            )}

                                            {selectedProposal.status === 'APPROVED' && selectedProposal.approved_at && (
                                                <div className="mt-2 text-xs bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                    <span>
                                                        Đã duyệt bởi <strong>{selectedProposal.approved_by_name || 'Quản lý'}</strong> lúc {format(new Date(selectedProposal.approved_at), 'dd/MM/yyyy HH:mm')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right flex flex-col items-end gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400">Tổng điều chỉnh:</span>
                                                <span className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 font-bold text-xs border border-blue-500/30">
                                                    {selectedProposal.items.length} vị trí
                                                </span>
                                            </div>

                                            {/* Nút Kích Hoạt Chế Độ Duyệt Trực Quan Trên Bản Đồ */}
                                            {selectedProposal.status === 'PENDING' && onStartVisualReview && (
                                                <button
                                                    onClick={() => {
                                                        onStartVisualReview(selectedProposal, 0)
                                                        onClose()
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-950 transition hover:scale-105 active:scale-95 border border-amber-400"
                                                    title="Mở sơ đồ kho, làm nổi bật các ô và duyệt trực tiếp trên bản đồ"
                                                >
                                                    <span>🗺️ Soi & Duyệt trên Bản Đồ</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* List of items */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                    {selectedProposal.items.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-44 text-slate-500 text-sm">
                                            <FileText className="w-8 h-8 mb-2 opacity-50" />
                                            <span>Phiếu này không có dữ liệu vị trí chi tiết.</span>
                                        </div>
                                    ) : (
                                        selectedProposal.items.map((it, idx) =>
                                            renderItemCard(selectedProposal, it, idx, idx, false)
                                        )
                                    )}
                                </div>

                                {/* Footer actions */}
                                {selectedProposal.status === 'PENDING' && (
                                    <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
                                        <div className="flex-1 max-w-md">
                                            <input
                                                type="text"
                                                value={reviewNotes}
                                                onChange={e => setReviewNotes(e.target.value)}
                                                placeholder="Ghi chú phản hồi của người duyệt (tùy chọn)..."
                                                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleReject}
                                                disabled={isRejecting || isApproving}
                                                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 border border-rose-800/60 transition disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                {isRejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                <span>Từ chối</span>
                                            </button>

                                            <button
                                                onClick={handleApprove}
                                                disabled={isApproving || isRejecting}
                                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition shadow-lg shadow-emerald-950/50 flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {isApproving ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>Đang cập nhật sơ đồ...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        <span>DUYỆT & CẬP NHẬT VÀO SƠ ĐỒ</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                <Layers className="w-12 h-12 text-slate-700 mb-2" />
                                <span>Chọn một phiếu đề xuất ở danh sách bên trái để xem</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}


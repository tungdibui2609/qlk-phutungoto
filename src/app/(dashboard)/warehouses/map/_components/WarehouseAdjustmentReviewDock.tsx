'use client'

import React, { useState } from 'react'
import {
    ChevronLeft,
    ChevronRight,
    Check,
    CheckCheck,
    X,
    Eye,
    Maximize2,
    Minimize2,
    ArrowRight,
    Layers,
    AlertCircle,
    User,
    Calendar,
    Loader2,
    Package
} from 'lucide-react'
import { WarehouseProposal, ProposalItem } from '@/lib/warehouseAdjustmentService'

interface WarehouseAdjustmentReviewDockProps {
    proposal: WarehouseProposal
    currentIndex: number
    onSelectIndex: (index: number) => void
    onClose: () => void
    onApproveItem: (item: ProposalItem) => Promise<void>
    onApproveAll: () => Promise<void>
    onFocusPosition: (positionId: string, positionCode?: string) => void
    onExpandProposalZones?: () => void
    isProcessing?: boolean
}

export function WarehouseAdjustmentReviewDock({
    proposal,
    currentIndex,
    onSelectIndex,
    onClose,
    onApproveItem,
    onApproveAll,
    onFocusPosition,
    onExpandProposalZones,
    isProcessing = false
}: WarehouseAdjustmentReviewDockProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [showSubItemsPopup, setShowSubItemsPopup] = useState(false)

    const items = proposal.items || []
    const total = items.length
    const currentItem = items[currentIndex] || items[0]

    if (!currentItem || total === 0) return null

    const handlePrev = () => {
        const nextIdx = currentIndex > 0 ? currentIndex - 1 : total - 1
        onSelectIndex(nextIdx)
        const target = items[nextIdx]
        if (target) {
            onFocusPosition(target.position_id, target.position_code)
        }
    }

    const handleNext = () => {
        const nextIdx = currentIndex < total - 1 ? currentIndex + 1 : 0
        onSelectIndex(nextIdx)
        const target = items[nextIdx]
        if (target) {
            onFocusPosition(target.position_id, target.position_code)
        }
    }

    const hasSubItems = Boolean(currentItem.sub_items && currentItem.sub_items.length > 1)

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-5xl transition-all duration-200">
            {/* Popover xem chi tiết từng dòng con khi là pallet hỗn hợp */}
            {showSubItemsPopup && hasSubItems && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-96 bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl p-4 text-xs text-slate-200 backdrop-blur-md">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <span className="font-bold text-amber-300 flex items-center gap-1.5">
                            <Package className="w-4 h-4" /> Chi tiết Pallet Hỗn Hợp ({currentItem.sub_items?.length} SP)
                        </span>
                        <button
                            onClick={() => setShowSubItemsPopup(false)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                        {currentItem.sub_items?.map((sub, sIdx) => (
                            <div key={sIdx} className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                                <div className="font-semibold text-white truncate">{sub.product_name}</div>
                                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                    <span>SKU: {sub.sku || '---'}</span>
                                    <span>
                                        {sub.current_quantity} ➔{' '}
                                        <strong className={sub.new_quantity === 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                            {sub.new_quantity} {sub.unit || 'th'}
                                        </strong>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Thanh Dock chính */}
            <div className="bg-slate-950/95 border-2 border-amber-500/50 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-xl overflow-hidden">
                {/* Header thanh Dock: Tên phiếu & Điều hướng */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/70 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            CHẾ ĐỘ DUYỆT TRÊN BẢN ĐỒ
                        </span>
                        <span className="text-slate-300 font-semibold truncate max-w-[280px]">
                            {proposal.title}
                        </span>
                        {proposal.created_by_name && (
                            <span className="text-slate-400 text-[11px] hidden sm:inline">
                                • {proposal.created_by_name}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {onExpandProposalZones && (
                            <button
                                onClick={onExpandProposalZones}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 font-bold text-[11px] flex items-center gap-1 transition"
                                title="Mở bung tất cả Dãy / Ô / Tầng có vị trí thay đổi trên cây sơ đồ"
                            >
                                <Layers className="w-3 h-3" />
                                Mở khu có đề xuất
                            </button>
                        )}
                        {/* Nút Thu nhỏ / Mở rộng */}
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                            title={isCollapsed ? 'Mở rộng' : 'Thu nhỏ'}
                        >
                            {isCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                        </button>
                        {/* Nút Đóng chế độ duyệt */}
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded"
                            title="Thoát chế độ duyệt"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {!isCollapsed && (
                    <div className="p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* Khối Trái: Điều Hướng STT & Mã Vị Trí */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl p-1">
                                <button
                                    onClick={handlePrev}
                                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition disabled:opacity-30"
                                    title="Ô trước đó"
                                    disabled={isProcessing}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-2 text-xs font-bold text-amber-400 font-mono">
                                    {currentIndex + 1} / {total}
                                </span>
                                <button
                                    onClick={handleNext}
                                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition disabled:opacity-30"
                                    title="Ô tiếp theo"
                                    disabled={isProcessing}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                onClick={() => onFocusPosition(currentItem.position_id, currentItem.position_code)}
                                className="group flex flex-col text-left hover:opacity-90 transition"
                                title="Bấm để zoom phóng to ô này"
                            >
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                    Vị trí đang chọn <Eye className="w-3 h-3 text-amber-400 group-hover:scale-110 transition" />
                                </span>
                                <span className="text-base font-black text-white font-mono tracking-tight group-hover:text-amber-400">
                                    {currentItem.position_code}
                                </span>
                            </button>
                        </div>

                        {/* Khối Giữa: Thao Tác & So Sánh Trước ➔ Sau */}
                        <div className="flex-1 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
                            {/* Tag Thao tác */}
                            {currentItem.action_type === 'CLEAR' && (
                                <span className="px-2.5 py-1 rounded-lg font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    🔴 Xuất rỗng ô
                                </span>
                            )}
                            {currentItem.action_type === 'SET_QTY' && (
                                <span className="px-2.5 py-1 rounded-lg font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    🟡 Sửa số lượng
                                </span>
                            )}
                            {currentItem.action_type === 'MOVE' && (
                                <span className="px-2.5 py-1 rounded-lg font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                    🔵 Chuyển vị trí
                                </span>
                            )}
                            {currentItem.action_type === 'ASSIGN_LOT' && (
                                <span className="px-2.5 py-1 rounded-lg font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                    🏷️ Gắn STT: {currentItem.lot_stt || currentItem.lot_code || '---'}
                                </span>
                            )}
                            {currentItem.action_type === 'NOTE' && (
                                <span className="px-2.5 py-1 rounded-lg font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    📝 Chỉ ghi chú
                                </span>
                            )}

                            {/* So sánh số lượng Trước ➔ Sau (ẩn khi chỉ ghi chú) */}
                            {currentItem.action_type !== 'NOTE' && (
                            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
                                {currentItem.action_type === 'CLEAR' && (
                                    <>
                                        <span className="text-slate-400 line-through">
                                            {currentItem.current_quantity ?? 'Có hàng'} {currentItem.unit || 'th'}
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                                        <span className="font-extrabold text-rose-400">
                                            Trống ô (0)
                                        </span>
                                    </>
                                )}
                                {currentItem.action_type === 'SET_QTY' && (
                                    <>
                                        <span className="text-slate-400">
                                            {currentItem.current_quantity ?? '--'}
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="font-extrabold text-emerald-400">
                                            {currentItem.new_quantity} {currentItem.unit || 'th'}
                                        </span>
                                        {hasSubItems && (
                                            <button
                                                onClick={() => setShowSubItemsPopup(!showSubItemsPopup)}
                                                className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-semibold"
                                            >
                                                {currentItem.sub_items?.length} dòng SP ▾
                                            </button>
                                        )}
                                    </>
                                )}
                                {currentItem.action_type === 'MOVE' && (
                                    <>
                                        <span className="text-slate-400 font-mono">
                                            {currentItem.position_code}
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                                        <span className="font-extrabold text-cyan-300 font-mono">
                                            {currentItem.target_position_code || 'Vị trí mới'}
                                        </span>
                                    </>
                                )}
                            </div>
                            )}

                            {/* Ghi chú thực tế */}
                            {currentItem.note && (
                                <span className={`bg-slate-900 text-amber-200 px-3 py-1.5 rounded-lg border border-slate-700 text-xs ${
                                    currentItem.action_type === 'NOTE' ? 'max-w-md whitespace-normal font-medium text-emerald-200 border-emerald-500/40 bg-emerald-950/40' : 'text-[11px] truncate max-w-[240px]'
                                }`}>
                                    💬 {currentItem.note}
                                </span>
                            )}
                        </div>

                        {/* Khối Phải: Cụm Nút Phê Duyệt */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Nút Duyệt riêng ô này */}
                            <button
                                onClick={() => onApproveItem(currentItem)}
                                disabled={isProcessing}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white border border-slate-700 hover:border-emerald-600 transition font-bold text-xs shadow-sm disabled:opacity-50"
                                title="Chỉ duyệt và cập nhật riêng vị trí này"
                            >
                                {isProcessing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                                <span>Duyệt ô này</span>
                            </button>

                            {/* Nút Duyệt toàn bộ phiếu */}
                            <button
                                onClick={onApproveAll}
                                disabled={isProcessing}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-950 transition hover:scale-105 active:scale-95 disabled:opacity-50"
                                title={`Duyệt và cập nhật toàn bộ ${total} vị trí vào sơ đồ`}
                            >
                                {isProcessing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <CheckCheck className="w-4 h-4" />
                                )}
                                <span>Duyệt cả phiếu ({total} ô)</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}


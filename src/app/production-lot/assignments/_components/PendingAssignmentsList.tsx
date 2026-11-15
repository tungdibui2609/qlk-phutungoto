'use client'

import React from 'react'
import { CheckCircle2, MapPin, Loader2, AlertCircle, Trash2, Check, X, XCircle, ArrowRight, Search, Filter, AlertTriangle, Edit2, Info } from 'lucide-react'
import { type PendingAssignment, type Lot, safeFormatDate, getLotDateStr } from './helpers'
import { decodeSTT } from '@/lib/numberUtils'
import { TagDisplay } from '@/components/lots/TagDisplay'

interface PendingAssignmentsListProps {
    loading: boolean
    pendingList: PendingAssignment[]
    filteredPendingList: PendingAssignment[]
    unmatchedPendingList: PendingAssignment[]
    lotsInDay: Lot[]
    allPositions: any[]
    pendingSearchTerm: string
    setPendingSearchTerm: React.Dispatch<React.SetStateAction<string>>
    showOnlyUnassigned: boolean
    setShowOnlyUnassigned: React.Dispatch<React.SetStateAction<boolean>>
    selectedIds: Set<string>
    actionLoading: string | null
    manualEdits: Record<string, { lot_stt: number; position_code: string }>
    getLotPositions: (lot: Lot | undefined | null) => any[]
    toggleSelect: (id: string, e?: React.MouseEvent) => void
    handleSelectAll: () => void
    handleSelectUnmatchedOnly: () => void
    handleClearSelection: () => void
    handleBulkApprove: () => Promise<void>
    handleBulkReject: (customIds?: string[]) => Promise<void>
    handleBulkDelete: (customIds?: string[]) => Promise<void>
    handleApprove: (ass: PendingAssignment, lotId: string) => Promise<void>
    handleReject: (ass: PendingAssignment) => Promise<void>
    handleDeleteAssignment: (assId: string) => Promise<void>
    startEdit: (ass: PendingAssignment) => void
}

export function PendingAssignmentsList({
    loading,
    pendingList,
    filteredPendingList,
    unmatchedPendingList,
    lotsInDay,
    allPositions,
    pendingSearchTerm,
    setPendingSearchTerm,
    showOnlyUnassigned,
    setShowOnlyUnassigned,
    selectedIds,
    actionLoading,
    manualEdits,
    getLotPositions,
    toggleSelect,
    handleSelectAll,
    handleSelectUnmatchedOnly,
    handleClearSelection,
    handleBulkApprove,
    handleBulkReject,
    handleBulkDelete,
    handleApprove,
    handleReject,
    handleDeleteAssignment,
    startEdit,
}: PendingAssignmentsListProps) {
    return (
        <>
            {/* Header danh sách & Công cụ chọn hàng loạt */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleSelectAll}
                        disabled={filteredPendingList.length === 0}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            selectedIds.size > 0 && filteredPendingList.length > 0 && filteredPendingList.every(a => selectedIds.has(a.id))
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : selectedIds.size > 0
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600'
                                : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 text-transparent'
                        }`}
                        title={filteredPendingList.length > 0 && filteredPendingList.every(a => selectedIds.has(a.id)) ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    >
                        {selectedIds.size > 0 && filteredPendingList.length > 0 && filteredPendingList.every(a => selectedIds.has(a.id)) ? (
                            <Check size={14} strokeWidth={3} />
                        ) : selectedIds.size > 0 ? (
                            <div className="w-2.5 h-1 bg-blue-600 rounded-full" />
                        ) : null}
                    </button>
                    <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        Yêu cầu từ Mobile ({pendingList.length})
                        {pendingSearchTerm && (
                            <span className="text-blue-600 dark:text-blue-400 normal-case font-bold text-xs">
                                (Khớp: {filteredPendingList.length})
                            </span>
                        )}
                        {selectedIds.size > 0 && (
                            <span className="text-blue-600 dark:text-blue-400 font-bold normal-case text-xs">
                                • Đã chọn {selectedIds.size}
                            </span>
                        )}
                    </h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Ô tìm kiếm STT, Vị trí */}
                    <div className="relative min-w-[160px] sm:min-w-[200px]">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Tìm STT (#), Vị trí..."
                            value={pendingSearchTerm}
                            onChange={(e) => setPendingSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-1.5 pl-8 pr-7 text-xs font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-500 transition-colors shadow-sm"
                        />
                        {pendingSearchTerm && (
                            <button
                                onClick={() => setPendingSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded-full"
                                title="Xóa tìm kiếm"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {unmatchedPendingList.length > 0 && (
                        <button
                            onClick={handleSelectUnmatchedOnly}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all flex items-center gap-1.5"
                        >
                            <AlertCircle size={12} />
                            Chọn mục lỗi ({unmatchedPendingList.length})
                        </button>
                    )}
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleClearSelection}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all"
                        >
                            Bỏ chọn
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Action Bar khi có chọn items */}
            {selectedIds.size > 0 && (
                <div className="sticky top-2 z-20 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-xl border border-zinc-700 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center font-black text-xs text-blue-400">
                            {selectedIds.size}
                        </div>
                        <div>
                            <div className="text-xs font-black">Đã chọn {selectedIds.size} / {pendingList.length} yêu cầu</div>
                            <div className="text-[10px] text-zinc-400">Thao tác hàng loạt cho các mục đã chọn:</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBulkApprove}
                            disabled={!!actionLoading}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                        >
                            {actionLoading === 'bulk-approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            Duyệt đã chọn ({selectedIds.size})
                        </button>
                        <button
                            onClick={() => handleBulkReject()}
                            disabled={!!actionLoading}
                            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-black text-xs uppercase rounded-xl flex items-center gap-2 active:scale-95 transition-all"
                        >
                            {actionLoading === 'bulk-reject' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                            Từ chối ({selectedIds.size})
                        </button>
                        <button
                            onClick={() => handleBulkDelete()}
                            disabled={!!actionLoading}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-xl flex items-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                        >
                            {actionLoading === 'bulk-delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Xóa vĩnh viễn ({selectedIds.size})
                        </button>
                        <button
                            onClick={handleClearSelection}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                            title="Bỏ chọn tất cả"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
                    <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">Đang tải dữ liệu...</p>
                </div>
            ) : pendingList.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-[32px] border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-300">
                    <CheckCircle2 size={40} className="mb-4 opacity-20" />
                    <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">Không có yêu cầu chờ duyệt</p>
                </div>
            ) : filteredPendingList.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-[32px] border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
                    <Search size={36} className="mb-3 opacity-30 text-zinc-400" />
                    <p className="text-zinc-700 dark:text-zinc-200 font-black text-sm">Không tìm thấy yêu cầu nào</p>
                    <p className="text-zinc-400 text-xs mt-1">Không có STT hoặc vị trí nào khớp với "{pendingSearchTerm}"</p>
                    <button
                        onClick={() => setPendingSearchTerm('')}
                        className="mt-4 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        Xóa từ khóa tìm kiếm
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredPendingList.map((ass) => {
                        const isSelected = selectedIds.has(ass.id)
                        const targetStt = manualEdits[ass.id]?.lot_stt || ass.lot_stt
                        const allMatchedLotsRaw = lotsInDay.filter(l => l.daily_seq === targetStt)

                        // Lô đã có vị trí trong kho trùng STT này
                        const duplicateAssignedLots = allMatchedLotsRaw.filter(l => getLotPositions(l).length > 0)
                        const duplicatePosCodes = Array.from(new Set(duplicateAssignedLots.flatMap(l => getLotPositions(l).map(p => p.code)))).filter(Boolean)

                        const unassignedLots = allMatchedLotsRaw.filter(l => getLotPositions(l).length === 0)
                        // Nếu bật lọc và có lô chưa gán, ưu tiên các lô chưa gán; nếu không có lô chưa gán thì hiển thị toàn bộ để không ẩn vị trí
                        const allMatchedLots = (showOnlyUnassigned && unassignedLots.length > 0) ? unassignedLots : allMatchedLotsRaw
                        const dateMatchedLots = allMatchedLots.filter(l => getLotDateStr(l) === ass.production_date)
                        const perfectMatch = dateMatchedLots.length === 1 ? dateMatchedLots[0] : null

                        // Danh sách lô trùng STT để hiển thị
                        const effectiveMatchedLots = allMatchedLotsRaw.length > 0 ? (allMatchedLots.length > 0 ? allMatchedLots : allMatchedLotsRaw) : []
                        const effectiveHasMatches = effectiveMatchedLots.length > 0
                        const hiddenByFilter = allMatchedLotsRaw.length > 0 && allMatchedLots.length === 0
                        const effectiveHiddenByFilter = hiddenByFilter && unassignedLots.length === 0 && effectiveMatchedLots.length === 0

                        return (
                            <div 
                                key={ass.id} 
                                className={`bg-white dark:bg-zinc-900 border rounded-2xl p-3 sm:p-3.5 shadow-sm hover:shadow transition-all group relative ${
                                    isSelected 
                                        ? 'border-blue-500 bg-blue-50/15 dark:bg-blue-950/20 dark:border-blue-500 ring-2 ring-blue-500/20' 
                                        : 'border-zinc-200/80 dark:border-zinc-800'
                                }`}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                    {/* Cột trái: Checkbox + STT + Vị trí */}
                                    <div className="flex items-center gap-3 shrink-0">
                                        {/* Checkbox chọn từng item */}
                                        <button
                                            onClick={(e) => toggleSelect(ass.id, e)}
                                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                                isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:border-blue-400 text-transparent'
                                            }`}
                                            title={isSelected ? "Bỏ chọn" : "Chọn yêu cầu này"}
                                        >
                                            <Check size={12} strokeWidth={3} className={isSelected ? "opacity-100" : "opacity-0"} />
                                        </button>

                                        {/* Hộp STT */}
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-100 dark:border-blue-900/30 flex flex-col items-center justify-center font-black shrink-0">
                                            <span className="text-[8px] opacity-60 uppercase text-zinc-500">STT</span>
                                            <span className="text-base sm:text-lg leading-tight">#{decodeSTT(manualEdits[ass.id]?.lot_stt || ass.lot_stt)}</span>
                                        </div>

                                        <ArrowRight size={14} className="text-zinc-300 dark:text-zinc-700 shrink-0" />

                                        {/* Khối Vị trí */}
                                        <div className="flex flex-col gap-1 shrink-0">
                                            <div 
                                                className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-xl cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center gap-2" 
                                                onClick={() => startEdit(ass)}
                                                title="Bấm để chỉnh sửa STT hoặc Vị trí"
                                            >
                                                <MapPin size={13} className="text-red-500 shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black uppercase text-zinc-900 dark:text-white leading-tight">
                                                        {manualEdits[ass.id]?.position_code || ass.position?.code || '---'}
                                                    </span>
                                                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">
                                                        SX: {safeFormatDate(ass.production_date)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Cảnh báo vị trí đích đang bị chiếm bởi lô khác */}
                                            {(() => {
                                                const targetPosCode = manualEdits[ass.id]?.position_code || ass.position?.code
                                                if (!targetPosCode || targetPosCode === '---') return null
                                                const pos = allPositions.find(p => p.code === targetPosCode)
                                                if (pos?.lot_id) {
                                                    if (perfectMatch && pos.lot_id === perfectMatch.id) return null
                                                    const occupant = lotsInDay.find(l => l.id === pos.lot_id) || (pos as any).lots
                                                    const occupantStt = occupant?.daily_seq ? decodeSTT(occupant.daily_seq) : ''
                                                    const occupantCode = occupant?.code || ''
                                                    return (
                                                        <div className="px-2 py-0.5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg text-[8px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1" title={occupantCode ? `Vị trí này đang chứa lô ${occupantCode}` : 'Vị trí này đang có hàng'}>
                                                            <AlertTriangle size={9} className="shrink-0" />
                                                            <span>Đang chứa: {occupantStt ? `STT #${occupantStt} ` : ''}{occupantCode ? `(${occupantCode})` : 'Có hàng'}</span>
                                                        </div>
                                                    )
                                                }
                                                return null
                                            })()}

                                            {/* Hiển thị vị trí hiện tại của lô trùng STT nếu đã có vị trí trong kho */}
                                            {duplicatePosCodes.length > 0 && (
                                                <div className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-[8px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1" title={`Lô mang STT này hiện đang nằm ở vị trí: ${duplicatePosCodes.join(', ')}`}>
                                                    <MapPin size={9} className="text-amber-600 shrink-0" /> Trùng STT ở: {duplicatePosCodes.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Cột phải: Trạng thái & Khớp thông tin (Gọn gàng) */}
                                    <div className="flex-1 w-full min-w-0">
                                        {perfectMatch ? (
                                            <div className="p-2.5 sm:p-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                                            <CheckCircle2 size={12} /> Khớp STT & Ngày SX
                                                        </span>
                                                        {(() => {
                                                            const pmPositions = getLotPositions(perfectMatch)
                                                            const pmPosCodes = pmPositions.map(p => p.code).filter(Boolean).join(', ')
                                                            const targetPosCode = manualEdits[ass.id]?.position_code || ass.position?.code
                                                            const isAtTarget = pmPosCodes && pmPosCodes === targetPosCode

                                                            if (pmPosCodes) {
                                                                return (
                                                                    <span className={`px-1.5 py-0.5 text-[8px] font-black rounded border flex items-center gap-1 shrink-0 ${
                                                                        isAtTarget 
                                                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/60'
                                                                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60'
                                                                    }`}>
                                                                        <MapPin size={9} className={isAtTarget ? 'text-blue-600' : 'text-amber-600 dark:text-amber-400'} />
                                                                        {isAtTarget ? `Đã ở: ${pmPosCodes}` : `Đã gán: ${pmPosCodes}`}
                                                                    </span>
                                                                )
                                                            }
                                                            return (
                                                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[8px] font-black rounded border border-emerald-200 dark:border-emerald-700/60 shrink-0">
                                                                    Chưa có vị trí
                                                                </span>
                                                            )
                                                        })()}
                                                        {allMatchedLotsRaw.length > 1 && (
                                                            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 text-[8px] font-black rounded border border-red-300 dark:border-red-700/60 flex items-center gap-1 shrink-0">
                                                                <AlertTriangle size={9} />
                                                                Trùng thêm {allMatchedLotsRaw.length - 1} lô khác STT #{decodeSTT(targetStt)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-black text-zinc-900 dark:text-white truncate">{perfectMatch.code}</span>
                                                        {perfectMatch.production_code && (
                                                            <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded text-[9px] font-bold" title="Mã phụ sản xuất">
                                                                Mã phụ: {perfectMatch.production_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[9px] text-zinc-600 dark:text-zinc-400 font-medium truncate mt-0.5">{perfectMatch.product_names?.join(', ') || '---'}</div>
                                                    {perfectMatch.tags && perfectMatch.tags.length > 0 && (
                                                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                            <TagDisplay
                                                                tags={perfectMatch.tags}
                                                                variant="compact"
                                                                placeholderMap={{ '@': perfectMatch.product_skus?.[0] || '' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                    <button 
                                                        onClick={() => handleApprove(ass, perfectMatch.id)} 
                                                        disabled={!!actionLoading} 
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all"
                                                    >
                                                        Duyệt ngay
                                                    </button>
                                                    <button onClick={() => handleReject(ass)} title="Từ chối yêu cầu" className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : effectiveHasMatches ? (
                                            <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl space-y-1.5">
                                                <div className="flex items-center justify-between px-1">
                                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                                                        <Info size={11} /> {effectiveMatchedLots.length} Lô trùng STT:
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => startEdit(ass)} title="Sửa STT/Vị trí" className="p-1 text-zinc-400 hover:text-blue-500 transition-colors"><Edit2 size={12} /></button>
                                                        <button onClick={() => handleReject(ass)} title="Từ chối" className="p-1 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                                                    {effectiveMatchedLots.map(l => {
                                                        const lotPositions = getLotPositions(l)
                                                        const posCodes = lotPositions.map(p => p.code).filter(Boolean).join(', ')
                                                        const targetPosCode = manualEdits[ass.id]?.position_code || ass.position?.code
                                                        const isAtTargetPos = posCodes && posCodes === targetPosCode

                                                        return (
                                                            <button 
                                                                key={l.id} 
                                                                onClick={() => handleApprove(ass, l.id)} 
                                                                disabled={!!actionLoading}
                                                                className="w-full text-left p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 rounded-lg transition-all flex items-center justify-between gap-3 group"
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                                                                            SX: {safeFormatDate(l.inbound_date || l.created_at)}
                                                                        </span>
                                                                        <span className="text-[10px] font-black text-zinc-900 dark:text-white truncate">
                                                                            {l.code}
                                                                        </span>
                                                                        {l.production_code && (
                                                                            <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded text-[8px] font-bold" title="Mã phụ sản xuất">
                                                                                Mã phụ: {l.production_code}
                                                                            </span>
                                                                        )}
                                                                        {posCodes ? (
                                                                            <span className={`px-1.5 py-0.5 text-[8px] font-black rounded border flex items-center gap-1 shrink-0 ${
                                                                                isAtTargetPos 
                                                                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/60'
                                                                                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60'
                                                                            }`}>
                                                                                <MapPin size={9} className={isAtTargetPos ? 'text-blue-600' : 'text-amber-600 dark:text-amber-400'} />
                                                                                {isAtTargetPos ? `Đã ở vị trí: ${posCodes}` : `Vị trí: ${posCodes}`}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[8px] font-black rounded border border-emerald-300 dark:border-emerald-700/60 shrink-0">
                                                                                Chưa có vị trí
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[8px] text-zinc-500 dark:text-zinc-400 truncate mt-1">
                                                                        {l.product_names?.join(', ') || '---'}
                                                                    </div>
                                                                    {l.tags && l.tags.length > 0 && (
                                                                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                            <TagDisplay
                                                                                tags={l.tags}
                                                                                variant="compact"
                                                                                placeholderMap={{ '@': l.product_skus?.[0] || '' }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className={`px-2.5 py-1 text-white rounded-md text-[9px] font-black uppercase shrink-0 transition-colors shadow-sm ${
                                                                    posCodes && !isAtTargetPos
                                                                        ? 'bg-amber-600 group-hover:bg-amber-700'
                                                                        : 'bg-blue-600 group-hover:bg-blue-700'
                                                                }`}>
                                                                    {posCodes && !isAtTargetPos ? 'Duyệt chuyển' : 'Duyệt'}
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ) : effectiveHiddenByFilter ? (
                                            <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/30 rounded-xl flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Filter size={14} className="text-amber-600 shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black text-amber-900 dark:text-amber-200 truncate">STT #{decodeSTT(targetStt)} đã có vị trí</div>
                                                        <div className="text-[9px] text-amber-700 dark:text-amber-400 truncate">
                                                            {duplicatePosCodes.length > 0 ? `Đang ở vị trí: ${duplicatePosCodes.join(', ')}. ` : ''}Tìm thấy {allMatchedLotsRaw.length} lô đã gán. Tắt lọc để chuyển vị trí.
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => setShowOnlyUnassigned(false)} className="px-2 py-1 bg-amber-200/80 hover:bg-amber-300/80 text-amber-900 text-[9px] font-black rounded-lg transition-colors">TẮT LỌC</button>
                                                    <button onClick={() => startEdit(ass)} className="p-1 text-zinc-400 hover:text-blue-500"><Edit2 size={13} /></button>
                                                    <button onClick={() => handleReject(ass)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={13} /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-2.5 sm:p-3 bg-amber-50/60 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-900/30 rounded-xl flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0">
                                                        <AlertCircle size={16} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5 truncate">
                                                            <span>Không có lô hàng mang STT #{decodeSTT(targetStt)}</span>
                                                        </div>
                                                        <div className="text-[9px] text-amber-700/80 dark:text-amber-400 font-medium truncate">
                                                            Chưa tạo Lô hoặc sai STT. Bấm sửa STT hoặc bấm xóa để dọn dẹp.
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => startEdit(ass)} title="Chỉnh sửa STT / Vị trí" className="p-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-all">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleReject(ass)} title="Từ chối yêu cầu" className="p-1.5 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-all">
                                                        <XCircle size={14} />
                                                    </button>
                                                    <button onClick={() => handleDeleteAssignment(ass.id)} title="Xóa vĩnh viễn yêu cầu này" className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

        </>
    )
}

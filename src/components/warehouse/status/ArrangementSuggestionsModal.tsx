'use client'

import React, { useState, useMemo } from 'react'
import {
    X,
    Sparkles,
    Search,
    Package,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Warehouse,
    Filter,
    MoveRight,
    Loader2,
    Layers,
    ChevronDown,
    ExternalLink
} from 'lucide-react'
import { FloorSuggestion, CandidateLot, PositionWithZone } from '@/lib/warehouseArrangement'
import { getProductColorStyle } from '@/lib/warehouseUtils'

interface ArrangementSuggestionsModalProps {
    suggestions: FloorSuggestion[]
    warehouses: Array<{ id: string, name: string }>
    displayInternalInfo?: boolean
    onClose: () => void
    onMoveLot: (lotId: string, fromPosId: string, toPosId: string, lotCode: string, targetPosCode: string) => Promise<boolean>
    onSelectZone?: (binId: string) => void
}

export function ArrangementSuggestionsModal({
    suggestions,
    warehouses,
    displayInternalInfo = false,
    onClose,
    onMoveLot,
    onSelectZone
}: ArrangementSuggestionsModalProps) {
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'hall' | 'ready'>('all')

    // Confirm state for moving
    const [confirmingMove, setConfirmingMove] = useState<{
        lot: CandidateLot
        targetPos: PositionWithZone
        suggestion: FloorSuggestion
    } | null>(null)
    const [isMoving, setIsMoving] = useState(false)

    // Expanded candidate cards
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

    const toggleExpandCard = (key: string) => {
        setExpandedCards(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    // Filtered suggestions
    const filteredSuggestions = useMemo(() => {
        return suggestions.filter(s => {
            // Filter by Warehouse
            if (selectedWarehouseId !== 'all') {
                if (s.warehouseId && s.warehouseId !== selectedWarehouseId) return false
            }

            // Filter by type
            if (filterType === 'hall') {
                const hasHallCandidate = s.candidateLots.some(c => c.isHall)
                if (!hasHallCandidate) return false
            } else if (filterType === 'ready') {
                if (s.candidateLots.length === 0) return false
            }

            // Search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase()
                const matchBin = s.binName.toLowerCase().includes(term) || (s.binCode || '').toLowerCase().includes(term)
                const matchLevel = s.levelName.toLowerCase().includes(term)
                const matchProdName = s.dominantProduct.productName.toLowerCase().includes(term)
                const matchSku = s.dominantProduct.sku.toLowerCase().includes(term)
                const matchInternalCode = (s.dominantProduct.internalCode || '').toLowerCase().includes(term)
                const matchInternalName = (s.dominantProduct.internalName || '').toLowerCase().includes(term)
                const matchPos = s.emptyPositions.some(p => p.code.toLowerCase().includes(term))

                if (!matchBin && !matchLevel && !matchProdName && !matchSku && !matchInternalCode && !matchInternalName && !matchPos) {
                    return false
                }
            }

            return true
        })
    }, [suggestions, selectedWarehouseId, filterType, searchTerm])

    // Summary counts
    const totalFillablePositions = useMemo(() => {
        return suggestions.reduce((sum, s) => sum + (s.candidateLots.length > 0 ? Math.min(s.emptyCount, s.candidateLots.length) : 0), 0)
    }, [suggestions])

    const hallCandidateCount = useMemo(() => {
        let count = 0
        suggestions.forEach(s => {
            count += s.candidateLots.filter(c => c.isHall).length
        })
        return count
    }, [suggestions])

    const handleConfirmMove = async () => {
        if (!confirmingMove) return
        setIsMoving(true)
        try {
            const success = await onMoveLot(
                confirmingMove.lot.lotId,
                confirmingMove.lot.currentPositionId,
                confirmingMove.targetPos.id,
                confirmingMove.lot.lotCode,
                confirmingMove.targetPos.code
            )
            if (success) {
                setConfirmingMove(null)
            }
        } finally {
            setIsMoving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-indigo-50/50 via-white to-amber-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850">
                    <div className="flex items-start gap-3.5">
                        <div className="p-3 bg-gradient-to-br from-amber-500 to-indigo-600 rounded-xl text-white shadow-md shadow-indigo-200 dark:shadow-none">
                            <Sparkles size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                    GỢI Ý SẮP XẾP & TỐI ƯU VỊ TRÍ KHO
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                                    {suggestions.length} cơ hội lấp đầy
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                                Tự động nhận diện các ô - tầng đang thiếu hàng và gợi ý đưa các lô hàng cùng loại từ Sảnh hoặc kệ lẻ vào lấp đầy, đảm bảo tiêu chuẩn 1 ô 1 loại hàng.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filter & Toolbar */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Warehouse selector */}
                        {warehouses.length > 1 && (
                            <select
                                value={selectedWarehouseId}
                                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                                className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">Tất cả kho</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        )}

                        {/* Filter tabs */}
                        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    filterType === 'all'
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                Tất cả ({suggestions.length})
                            </button>
                            <button
                                onClick={() => setFilterType('hall')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                    filterType === 'hall'
                                        ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Có hàng ở Sảnh ({hallCandidateCount})
                            </button>
                            <button
                                onClick={() => setFilterType('ready')}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    filterType === 'ready'
                                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                Sẵn sàng lấp đầy
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative min-w-[240px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm ô, vị trí, tên sản phẩm, SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Content List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 bg-slate-50/40 dark:bg-slate-900/40">
                    {filteredSuggestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 mb-3">
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
                                {suggestions.length === 0
                                    ? 'Kho hiện tại đã được sắp xếp đồng nhất!'
                                    : 'Không tìm thấy gợi ý phù hợp với bộ lọc'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                {suggestions.length === 0
                                    ? 'Tất cả các ô - tầng đều đã được lấp đầy đồng nhất hoặc không có vị trí trống cần bù hàng.'
                                    : 'Hãy thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.'}
                            </p>
                        </div>
                    ) : (
                        filteredSuggestions.map((suggestion) => {
                            const isExpanded = expandedCards.has(suggestion.key)
                            const colorStyle = getProductColorStyle(suggestion.dominantProduct.productColor)
                            const displayProdName = displayInternalInfo && suggestion.dominantProduct.internalName
                                ? suggestion.dominantProduct.internalName
                                : suggestion.dominantProduct.productName
                            const displayProdCode = displayInternalInfo && suggestion.dominantProduct.internalCode
                                ? suggestion.dominantProduct.internalCode
                                : suggestion.dominantProduct.sku

                            const hasHallCandidate = suggestion.candidateLots.some(c => c.isHall)

                            return (
                                <div
                                    key={suggestion.key}
                                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all overflow-hidden"
                                >
                                    {/* Card Header */}
                                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="flex items-start sm:items-center gap-3">
                                            {/* Visual Floor representation (like Image 2) */}
                                            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                                                <div className="text-[9px] font-black text-slate-500 uppercase mb-1">
                                                    {suggestion.binName}
                                                </div>
                                                <div className="flex gap-1 items-center">
                                                    {Array.from({ length: suggestion.totalPositions }).map((_, idx) => {
                                                        const isSlotOccupied = idx < suggestion.occupiedCount
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`w-3.5 h-3.5 rounded-xs transition-all ${
                                                                    isSlotOccupied
                                                                        ? ''
                                                                        : 'bg-amber-100 dark:bg-amber-950/40 border border-dashed border-amber-500 animate-pulse'
                                                                }`}
                                                                style={isSlotOccupied ? colorStyle : undefined}
                                                                title={isSlotOccupied ? 'Đã có hàng' : 'Vị trí trống cần lấp'}
                                                            />
                                                        )
                                                    })}
                                                </div>
                                                <span className="text-[8px] font-mono font-bold text-slate-400 mt-1">
                                                    {suggestion.occupiedCount}/{suggestion.totalPositions}
                                                </span>
                                            </div>

                                            {/* Location & Target Info */}
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                                        {suggestion.warehouseName} • {suggestion.aisleName} • {suggestion.binName} • {suggestion.levelName}
                                                    </span>
                                                    {hasHallCandidate && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60">
                                                            ⚡ Có hàng ở Sảnh
                                                        </span>
                                                    )}
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        Còn thiếu {suggestion.emptyCount} vị trí
                                                    </span>
                                                </div>

                                                {/* Product Info */}
                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    <span className="text-[10px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded shadow-xs">
                                                        {displayProdCode}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {displayProdName}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 italic">
                                                        ({suggestion.dominantProduct.occupiedPositionsCount}/{suggestion.occupiedCount} vị trí hiện tại đã chứa)
                                                    </span>
                                                </div>

                                                {/* Empty Positions Codes */}
                                                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                                                    <span>Mã vị trí còn trống:</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {suggestion.emptyPositions.map(p => (
                                                            <span key={p.id} className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 text-[10px]">
                                                                {p.code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action buttons on card header */}
                                        <div className="flex items-center gap-2 self-end lg:self-center">
                                            {onSelectZone && (
                                                <button
                                                    onClick={() => {
                                                        onSelectZone(suggestion.binId)
                                                        onClose()
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors"
                                                    title="Xem ô này trên sơ đồ chi tiết"
                                                >
                                                    <ExternalLink size={13} />
                                                    Xem trên sơ đồ
                                                </button>
                                            )}

                                            <button
                                                onClick={() => toggleExpandCard(suggestion.key)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                                                    suggestion.candidateLots.length > 0
                                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                <span>{isExpanded ? 'Thu gọn' : `Xem ${suggestion.candidateLots.length} lô gợi ý`}</span>
                                                <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Candidate Lots (Always show first item or full list if expanded) */}
                                    <div className="p-4 sm:p-5">
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                                            <span>DANH SÁCH LÔ HÀNG CÙNG LOẠI CÓ THỂ CHUYỂN VÀO ({suggestion.candidateLots.length})</span>
                                            {suggestion.candidateLots.length > 0 && (
                                                <span className="text-indigo-600 dark:text-indigo-400 font-bold lowercase">
                                                    ưu tiên từ sảnh & kệ lẻ
                                                </span>
                                            )}
                                        </div>

                                        {suggestion.candidateLots.length === 0 ? (
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-500 flex items-center gap-2 italic">
                                                <AlertCircle size={14} className="text-slate-400 shrink-0" />
                                                Hiện tại không tìm thấy lô hàng cùng loại nào khác đang nằm ở Sảnh hoặc kệ lẻ để đưa vào vị trí này.
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {(isExpanded ? suggestion.candidateLots : suggestion.candidateLots.slice(0, 2)).map((candidate) => {
                                                    const targetPosition = suggestion.emptyPositions[0]

                                                    return (
                                                        <div
                                                            key={`${candidate.lotId}-${candidate.currentPositionId}`}
                                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all gap-3"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-lg shrink-0 ${candidate.isHall ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'}`}>
                                                                    <Package size={16} />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-100">
                                                                            {candidate.lotCode}
                                                                        </span>
                                                                        <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase tracking-tight ${
                                                                            candidate.priority === 1
                                                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60'
                                                                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                                        }`}>
                                                                            {candidate.priorityLabel}
                                                                        </span>
                                                                        <span className="text-[11px] font-bold text-slate-500">
                                                                            {candidate.quantity} {candidate.unit}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                                                        <span>Vị trí hiện tại:</span>
                                                                        <strong className="text-slate-700 dark:text-slate-300 font-mono">
                                                                            {candidate.currentLocationName}
                                                                        </strong>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Transfer Button */}
                                                            {targetPosition && (
                                                                <button
                                                                    onClick={() => setConfirmingMove({
                                                                        lot: candidate,
                                                                        targetPos: targetPosition,
                                                                        suggestion
                                                                    })}
                                                                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 self-end sm:self-center"
                                                                >
                                                                    <span>Chuyển vào {targetPosition.code}</span>
                                                                    <MoveRight size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })}

                                                {!isExpanded && suggestion.candidateLots.length > 2 && (
                                                    <div className="text-center pt-1">
                                                        <button
                                                            onClick={() => toggleExpandCard(suggestion.key)}
                                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                                        >
                                                            + Xem thêm {suggestion.candidateLots.length - 2} lô khác có thể chuyển vào
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                        <span>
                            Tổng số cơ hội tối ưu: <strong className="text-slate-800 dark:text-slate-200 font-bold">{suggestions.length}</strong> tầng
                        </span>
                        <span>
                            Số vị trí có thể lấp đầy ngay: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalFillablePositions}</strong> vị trí
                        </span>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors self-end sm:self-auto"
                    >
                        Đóng
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmingMove && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => !isMoving && setConfirmingMove(null)}></div>

                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-4">
                            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                                <Sparkles size={20} />
                            </div>
                            <h3 className="text-base font-black text-slate-800 dark:text-white">
                                Xác nhận chuyển vị trí lô hàng
                            </h3>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                            Bạn có chắc chắn muốn chuyển lô hàng sau vào vị trí còn thiếu không?
                        </p>

                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800 text-xs mb-5">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Mã Lô:</span>
                                <span className="font-mono font-black text-slate-800 dark:text-slate-100">{confirmingMove.lot.lotCode}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Sản phẩm:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[220px]" title={confirmingMove.suggestion.dominantProduct.productName}>
                                    {confirmingMove.suggestion.dominantProduct.productName}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Vị trí hiện tại:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{confirmingMove.lot.currentLocationName}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-slate-400">Vị trí đích:</span>
                                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">{confirmingMove.targetPos.code}</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                disabled={isMoving}
                                onClick={() => setConfirmingMove(null)}
                                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                disabled={isMoving}
                                onClick={handleConfirmMove}
                                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs"
                            >
                                {isMoving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                <span>Xác nhận chuyển</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

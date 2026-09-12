import React, { useMemo, useState } from 'react'
import { X, Package, Hash, Sparkles, MoveRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { getProductColorStyle } from '@/lib/warehouseUtils'
import { FloorSuggestion, CandidateLot } from '@/lib/warehouseArrangement'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

interface GroupedZoneDetailModalProps {
    zone: Zone
    allPositions: PositionWithZone[]
    zones: Zone[]
    occupiedIds: Set<string>
    lotInfo: Record<string, {
        code: string,
        items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[], internal_code?: string, internal_name?: string, product_color?: string | null }>,
        inbound_date?: string,
        created_at?: string,
        tags?: string[]
    }>
    displayInternalInfo?: boolean
    suggestions?: FloorSuggestion[]
    onMoveLot?: (lotId: string, fromPosId: string, toPosId: string, lotCode: string, targetPosCode: string) => Promise<boolean>
    onClose: () => void
}

export function GroupedZoneDetailModal({
    zone,
    allPositions,
    zones,
    occupiedIds,
    lotInfo,
    onClose,
    displayInternalInfo,
    suggestions = [],
    onMoveLot
}: GroupedZoneDetailModalProps) {
    const occupiedCount = allPositions.filter(p => occupiedIds.has(p.id)).length

    // State for candidate lots selection modal
    const [selectingCandidateForPos, setSelectingCandidateForPos] = useState<{
        pos: PositionWithZone
        suggestion: FloorSuggestion
    } | null>(null)

    const [movingLotId, setMovingLotId] = useState<string | null>(null)

    // Build map for quick suggestion lookup by levelId
    const suggestionsByLevel = useMemo(() => {
        const map = new Map<string, FloorSuggestion>()
        suggestions.forEach(s => {
            map.set(s.levelId, s)
        })
        return map
    }, [suggestions])

    // Group positions by Level
    const positionsByLevel = useMemo(() => {
        const groups = new Map<string, { zone: Zone, positions: PositionWithZone[] }>()
        
        allPositions.forEach(pos => {
            const zid = pos.zone_id || 'unknown'
            if (!groups.has(zid)) {
                const lvlZone = zones.find(z => z.id === zid)
                groups.set(zid, { 
                    zone: lvlZone || { name: 'Không rõ tầng', id: zid } as any, 
                    positions: [] as PositionWithZone[]
                })
            }
            groups.get(zid)!.positions.push(pos)
        })

        // Sort groups by display_order
        return Array.from(groups.values()).sort((a, b) => {
            const oa = (a.zone as any).display_order ?? 0
            const ob = (b.zone as any).display_order ?? 0
            if (oa !== ob) return oa - ob
            return (a.zone.name || '').localeCompare(b.zone.name || '', undefined, { numeric: true })
        })
    }, [allPositions, zones])

    const handleExecuteMove = async (candidate: CandidateLot) => {
        if (!selectingCandidateForPos || !onMoveLot) return
        setMovingLotId(candidate.lotId)
        try {
            const success = await onMoveLot(
                candidate.lotId,
                candidate.currentPositionId,
                selectingCandidateForPos.pos.id,
                candidate.lotCode,
                selectingCandidateForPos.pos.code
            )
            if (success) {
                setSelectingCandidateForPos(null)
            }
        } finally {
            setMovingLotId(null)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Chi tiết {zone.name}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Tổng quan các vị trí trong khu vực (Nhóm theo tầng)
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Table Header */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 grid grid-cols-12 gap-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <div className="col-span-2">VỊ TRÍ</div>
                    <div className="col-span-3">MÃ LÔ (LOT)</div>
                    <div className="col-span-5">SẢN PHẨM / CHI TIẾT</div>
                    <div className="col-span-2 text-right">SỐ LƯỢNG</div>
                </div>

                {/* Content Container (Scrollable) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    {positionsByLevel.map(group => {
                        const floorSuggestion = suggestionsByLevel.get(group.zone.id)

                        return (
                            <div key={group.zone.id} className="mb-6">
                                {/* Level Header Separator */}
                                <div className="sticky top-0 z-10 px-6 py-2 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm border-y border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">
                                            {group.zone.name} ({group.positions.length} vị trí)
                                        </span>
                                    </div>
                                    {floorSuggestion && (
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                            <Sparkles size={11} className="animate-pulse" />
                                            Gợi ý lấp đầy ({floorSuggestion.emptyCount} vị trí trống)
                                        </span>
                                    )}
                                </div>

                                {/* Floor Suggestion Banner */}
                                {floorSuggestion && (
                                    <div className="mx-2 sm:mx-4 mt-2 px-3 py-2.5 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent border border-amber-300/40 dark:border-amber-700/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                                            <Sparkles size={15} className="text-amber-500 shrink-0" />
                                            <div>
                                                <span>
                                                    Tầng này đang chứa <strong>{floorSuggestion.dominantProduct.occupiedPositionsCount}/{floorSuggestion.totalPositions}</strong> vị trí sản phẩm:
                                                </span>{' '}
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                    [{displayInternalInfo && floorSuggestion.dominantProduct.internalCode ? floorSuggestion.dominantProduct.internalCode : floorSuggestion.dominantProduct.sku}] {displayInternalInfo && floorSuggestion.dominantProduct.internalName ? floorSuggestion.dominantProduct.internalName : floorSuggestion.dominantProduct.productName}
                                                </span>
                                                {floorSuggestion.candidateLots.length > 0 ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1">
                                                        • Có {floorSuggestion.candidateLots.length} lô cùng loại có thể đưa vào!
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic ml-1">
                                                        • Chưa có lô cùng loại ở Sảnh/Kệ lẻ để chuyển vào.
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="p-2 sm:p-4 space-y-2">
                                    {group.positions
                                        .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
                                        .map(pos => {
                                            const isOccupied = occupiedIds.has(pos.id)
                                            const lot = pos.lot_id ? lotInfo[pos.lot_id] : null

                                            // Get quantity and unit string
                                            let displayProduct = ''
                                            let displayQty = ''

                                            if (lot && lot.items && lot.items.length > 0) {
                                                if (lot.items.length === 1) {
                                                    const item = lot.items[0]
                                                    displayProduct = displayInternalInfo && item.internal_name ? item.internal_name : item.product_name
                                                    displayQty = `${item.quantity} ${item.unit}`
                                                } else {
                                                    displayProduct = `Nhiều sản phẩm (${lot.items.length})`
                                                    displayQty = '...'
                                                }
                                            }

                                            const canSuggestForThisEmptyPos = !isOccupied && floorSuggestion && floorSuggestion.candidateLots.length > 0

                                            return (
                                                <div
                                                    key={pos.id}
                                                    className={`
                                                        grid grid-cols-12 gap-4 items-center p-3 rounded-lg border bg-white dark:bg-slate-800 transition-all
                                                        ${isOccupied ? 'border-indigo-100 dark:border-indigo-900/50 shadow-sm' : canSuggestForThisEmptyPos ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs' : 'border-slate-100 dark:border-slate-800 opacity-60'}
                                                    `}
                                                >
                                                    <div className="col-span-2 flex items-center gap-3">
                                                        {(() => {
                                                            const pColor = lot?.items?.find((item: any) => item.product_color)?.product_color;
                                                            const colorStyle = getProductColorStyle(pColor);
                                                            const hasColor = !!pColor;

                                                            return (
                                                                <div 
                                                                    className={`p-1.5 rounded-md shadow-sm border ${isOccupied ? '' : canSuggestForThisEmptyPos ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 border-amber-300 dark:border-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                                                                    style={isOccupied ? { 
                                                                        ...colorStyle,
                                                                        color: hasColor ? 'white' : undefined,
                                                                        borderColor: 'rgba(0,0,0,0.1)'
                                                                    } : {}}
                                                                >
                                                                    {canSuggestForThisEmptyPos ? (
                                                                        <Sparkles size={14} className="animate-pulse" />
                                                                    ) : (
                                                                        <Package size={14} className={isOccupied && hasColor ? 'drop-shadow-sm' : ''} />
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate" title={pos.code}>
                                                            {pos.code?.split('.').pop() || pos.code}
                                                        </span>
                                                    </div>

                                                    <div className="col-span-3 min-w-0">
                                                        {isOccupied && lot ? (
                                                            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group cursor-default">
                                                                <Hash size={12} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                                                <span className="text-xs font-mono font-black text-slate-900 dark:text-slate-100 tracking-tight">{lot.code}</span>
                                                            </span>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-slate-400 italic">Trống</span>
                                                                {canSuggestForThisEmptyPos && (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60">
                                                                        Có gợi ý
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="col-span-5">
                                                        {isOccupied && lot ? (
                                                            <div className="flex flex-col gap-1.5">
                                                                {lot.items.length === 1 ? (
                                                                    <>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="text-[10px] font-black text-white bg-indigo-600 dark:bg-indigo-500 px-1.5 py-0.5 rounded shadow-sm">
                                                                                    {displayInternalInfo && lot.items[0].internal_code ? lot.items[0].internal_code : lot.items[0].sku}
                                                                                </span>
                                                                                {displayInternalInfo && lot.items[0].internal_code && lot.items[0].internal_code !== lot.items[0].sku && (
                                                                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                                                                        SKU: {lot.items[0].sku}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {lot.items[0].tags?.map((tag: string, ti: number) => (
                                                                                <span key={ti} className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-800 uppercase tracking-tighter shadow-sm">{tag}</span>
                                                                            ))}
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={displayProduct}>
                                                                                {displayProduct}
                                                                            </div>
                                                                            {displayInternalInfo && lot.items[0].internal_name && lot.items[0].internal_name !== lot.items[0].product_name && (
                                                                                <div className="text-[10px] text-slate-400 italic leading-none mt-0.5">
                                                                                    Gốc: {lot.items[0].product_name}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                                                                        {`Nhiều sản phẩm (${lot.items.length})`}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : canSuggestForThisEmptyPos ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                                                                    <Sparkles size={13} className="text-amber-500" />
                                                                    Gợi ý: Lấp đầy bằng {displayInternalInfo && floorSuggestion.dominantProduct.internalName ? floorSuggestion.dominantProduct.internalName : floorSuggestion.dominantProduct.productName}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-slate-400 tracking-widest opacity-30">---</div>
                                                        )}
                                                    </div>

                                                    <div className="col-span-2 text-right">
                                                        {isOccupied && lot ? (
                                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                                {displayQty}
                                                            </span>
                                                        ) : canSuggestForThisEmptyPos && onMoveLot ? (
                                                            <button
                                                                onClick={() => setSelectingCandidateForPos({ pos, suggestion: floorSuggestion })}
                                                                className="px-2.5 py-1 rounded-md text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs active:scale-95 transition-all ml-auto"
                                                                title="Xem danh sách lô cùng loại có thể đưa vào vị trí này"
                                                            >
                                                                <Sparkles size={11} />
                                                                <span>Gợi ý xếp ({floorSuggestion.candidateLots.length})</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center text-sm">
                    <div className="text-slate-500">
                        Tổng <span className="font-bold text-slate-700 dark:text-slate-300">{allPositions.length}</span> vị trí
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-indigo-500"></div>
                            <span className="text-slate-600 dark:text-slate-300">Đã lấp đầy: <strong>{occupiedCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-slate-200 dark:bg-slate-700"></div>
                            <span className="text-slate-600 dark:text-slate-300">Trống: <strong>{allPositions.length - occupiedCount}</strong></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Candidate Lot Selection Modal for Empty Position */}
            {selectingCandidateForPos && (
                <div className="fixed inset-0 z-[115] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => !movingLotId && setSelectingCandidateForPos(null)}></div>

                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Sparkles size={18} className="text-amber-500" />
                                    Gợi ý đưa hàng vào {selectingCandidateForPos.pos.code}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Sản phẩm yêu cầu:{' '}
                                    <strong className="text-slate-700 dark:text-slate-200">
                                        {selectingCandidateForPos.suggestion.dominantProduct.productName}
                                    </strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectingCandidateForPos(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="py-4 space-y-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                DANH SÁCH LÔ HÀNG CÙNG LOẠI ({selectingCandidateForPos.suggestion.candidateLots.length})
                            </div>

                            {selectingCandidateForPos.suggestion.candidateLots.map((c) => (
                                <div
                                    key={c.lotId}
                                    className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 hover:border-indigo-300 transition-all"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-100">
                                                {c.lotCode}
                                            </span>
                                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                                c.isHall
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/50'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200'
                                            }`}>
                                                {c.priorityLabel}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            Hiện tại: <strong className="text-slate-700 dark:text-slate-300">{c.currentLocationName}</strong>
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            Số lượng: {c.quantity} {c.unit}
                                        </div>
                                    </div>

                                    <button
                                        disabled={movingLotId === c.lotId}
                                        onClick={() => handleExecuteMove(c)}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                                    >
                                        {movingLotId === c.lotId ? (
                                            <Loader2 size={13} className="animate-spin" />
                                        ) : (
                                            <MoveRight size={13} />
                                        )}
                                        <span>Chuyển vào đây</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button
                                onClick={() => setSelectingCandidateForPos(null)}
                                className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

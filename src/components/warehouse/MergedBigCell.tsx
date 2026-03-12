'use client'
import React from 'react'
import { Maximize2, Eye, Package, MoreHorizontal, Layers } from 'lucide-react'

const MergedBigCell = React.memo<{
    pos: any,
    isMobile: boolean,
    isOccupied: boolean,
    isSelected: boolean,
    isTargetLot: boolean,
    aggregatedItems: Array<{ product_name: string, sku: string, unit: string, quantity: number, internal_name?: string, internal_code?: string }>,
    isAssignmentMode: boolean,
    isHighlightBlinking: boolean,
    displayInternalCode?: boolean,
    zoneBreadcrumb?: string[],
    onPositionSelect?: (id: string | string[]) => void,
    onViewDetails?: (lotId: string) => void,
    onPositionMenu?: (pos: any, event: React.MouseEvent) => void,
    mergedLevels?: string[],
    levelGroups?: Array<{ name: string, items: Array<{ product_name: string, sku: string, unit: string, quantity: number, internal_name?: string, internal_code?: string }> }>,
    isPrintPage?: boolean,
    isGrouped?: boolean,
    isSanh?: boolean,
    isManualMerge?: boolean
}>(({ pos, isMobile, isOccupied, isSelected, isTargetLot, aggregatedItems, isAssignmentMode, isHighlightBlinking, displayInternalCode, zoneBreadcrumb, onPositionSelect, onViewDetails, onPositionMenu, mergedLevels, levelGroups, isPrintPage, isGrouped, isSanh, isManualMerge }) => {
    const ids = pos.realIds || [pos.id]
    const mergedCount = pos.mergedCount || ids.length
    const originalCodes = pos.originalCodes || [pos.code]

    let bgClass = 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20'
    let borderClass = 'border-indigo-300 dark:border-indigo-700'
    let ringClass = ''

    if (isSelected) {
        bgClass = 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30'
        borderClass = 'border-blue-500'
        ringClass = 'ring-2 ring-blue-300'
    } else if (isTargetLot) {
        bgClass = 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30'
        borderClass = 'border-purple-500'
        ringClass = 'ring-2 ring-purple-300'
    } else if (isOccupied) {
        bgClass = 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10'
        borderClass = 'border-amber-300 dark:border-amber-700'
    }

    return (
        <div
            style={{ 
                gridColumn: '1 / -1', 
                minHeight: isPrintPage ? (isSanh ? '60px' : (isManualMerge ? '250px' : '125px')) : (isMobile ? '110px' : '150px'),
                height: isPrintPage ? '100%' : '100%'
            }}
            className={`
                relative ${isAssignmentMode ? 'cursor-pointer' : ''} p-2.5 print:p-1.5 rounded-xl border-2 transition-all
                flex flex-col flex-1 h-full min-h-0 overflow-hidden print:overflow-visible
                ${bgClass} ${borderClass} ${ringClass}
                ${isAssignmentMode ? 'hover:shadow-lg hover:scale-[1.01] hover:z-10' : ''}
                ${isHighlightBlinking ? 'animate-highlight-blink' : ''}
            `}
            onClick={() => isAssignmentMode && onPositionSelect?.(ids)}
        >
            {/* Top row: badge + code + actions */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    {/* Checkbox */}
                    {!isAssignmentMode && !isPrintPage && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPositionSelect?.(ids) }}
                            className={`w-5 h-5 rounded shrink-0 border-2 transition-all flex items-center justify-center
                                ${isSelected
                                    ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                                    : 'bg-white/90 dark:bg-gray-800/90 border-gray-300 dark:border-gray-500 hover:border-blue-400'
                                }
                            `}
                            title={isSelected ? "Bỏ chọn" : "Chọn vị trí"}
                        >
                            {isSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* Big Position Title */}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Maximize2 size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                            {zoneBreadcrumb && zoneBreadcrumb.length > 0
                                ? zoneBreadcrumb.join(' • ')
                                : pos.code
                            }
                        </span>
                        <span className="text-[9px] bg-indigo-100 dark:bg-indigo-800/50 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold shrink-0 whitespace-nowrap">
                            {mergedLevels && mergedLevels.length > 0 
                                ? `Gộp ${mergedLevels.length} tầng`
                                : `${mergedCount} ô gộp`
                            }
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {!isAssignmentMode && isOccupied && aggregatedItems.length > 0 && !isPrintPage && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewDetails?.(pos.lot_id!) }}
                            className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                            title="Xem chi tiết LOT"
                        >
                            <Eye size={14} />
                        </button>
                    )}
                    {isOccupied && !isPrintPage && (
                        <Package size={14} className="text-amber-500 dark:text-amber-400" />
                    )}
                    {isTargetLot && (
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                    )}
                    {!isAssignmentMode && !isPrintPage && (
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPositionMenu?.(pos, e) }}
                            className="text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 transition-colors p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Tùy chọn"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content: Aggregated product summary */}
            {aggregatedItems.length > 0 || (levelGroups && levelGroups.length > 0) ? (
                <div className={`flex flex-col gap-1.5 flex-1 ${isPrintPage ? 'overflow-visible' : 'overflow-y-auto'} custom-scrollbar pr-1`}>
                    {levelGroups && levelGroups.length > 0 ? (
                        <div className="space-y-2">
                            {levelGroups.map((group, gIdx) => (
                                <div key={gIdx} className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-2 py-0.5 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-r">
                                    <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1">
                                        <Layers size={10} /> {group.name}
                                    </div>
                                    <div className="grid gap-y-0.5 items-start" style={{ gridTemplateColumns: '1fr auto', columnGap: '6px' }}>
                                        {group.items.length > 0 ? (
                                            group.items.map((item, idx) => {
                                                const nameObj = displayInternalCode && item.internal_name ? item.internal_name : item.product_name;
                                                const codeObj = displayInternalCode && item.internal_code ? item.internal_code : item.sku;
                                                return (
                                                    <React.Fragment key={idx}>
                                                        <span className="text-[10px] text-gray-600 dark:text-gray-300 line-clamp-1">{nameObj}{nameObj ? ` (${codeObj || '-'})` : (codeObj || '-')}</span>
                                                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap text-right">
                                                            : {item.quantity} {item.unit || '-'}
                                                        </span>
                                                    </React.Fragment>
                                                )
                                            })
                                        ) : (
                                            <span className={`text-[10px] text-gray-400 dark:text-gray-500 italic col-span-2 ${isPrintPage ? 'not-italic font-mono uppercase' : ''}`}>Trống</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-y-0.5 items-start" style={{ gridTemplateColumns: '1fr auto', columnGap: '6px' }}>
                            {aggregatedItems.slice(0, isMobile ? 3 : 5).map((item, idx) => {
                                const nameObj = displayInternalCode && item.internal_name ? item.internal_name : item.product_name;
                                const codeObj = displayInternalCode && item.internal_code ? item.internal_code : item.sku;
                                return (
                                    <React.Fragment key={idx}>
                                        <span className="text-[10px] text-gray-600 dark:text-gray-300">{nameObj}{nameObj ? ` (${codeObj || '-'})` : (codeObj || '-')}</span>
                                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap text-right">
                                            : {item.quantity} {item.unit || '-'}
                                        </span>
                                    </React.Fragment>
                                )
                            })}

                            {aggregatedItems.length > (isMobile ? 3 : 5) && (() => {
                                const others = aggregatedItems.slice(isMobile ? 3 : 5);
                                const unitSums = others.reduce((acc: any, curr: any) => {
                                    const unit = curr.unit || '-';
                                    acc[unit] = (acc[unit] || 0) + curr.quantity;
                                    return acc;
                                }, {} as Record<string, number>);

                                const summaryText = Object.entries(unitSums)
                                    .map(([unit, qty]) => `${qty} ${unit}`)
                                    .join(' và ');

                                return (
                                    <React.Fragment>
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">Các mặt hàng khác</span>
                                        <span className="text-[10px] font-mono text-blue-500 dark:text-blue-500 font-bold whitespace-nowrap text-right">
                                            : {summaryText}
                                        </span>
                                    </React.Fragment>
                                );
                            })()}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <span className={`text-[10px] text-gray-400 font-medium ${isPrintPage ? 'font-mono uppercase not-italic' : 'italic'}`}>
                        {isPrintPage ? 'Trống' : 'Ô lớn trống — gán LOT để sử dụng'}
                    </span>
                </div>
            )}

            {/* Footer: original position codes - Hide in print view */}
            {!isPrintPage && (
                <div className="flex items-center gap-1 mt-1 pt-1 border-t border-indigo-200/50 dark:border-indigo-700/30 overflow-hidden">
                    <span className="text-[7px] text-gray-400 dark:text-gray-500 shrink-0">Gồm:</span>
                    <div className="flex gap-0.5 overflow-hidden whitespace-nowrap">
                        {originalCodes.map((code: string, i: number) => (
                            <span key={i} className="text-[7px] px-0.5 bg-white/60 dark:bg-gray-800/40 rounded text-gray-500 dark:text-gray-400 font-mono">
                                {code}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}, (prev, next) => {
    return prev.pos.id === next.pos.id &&
        prev.pos.lot_id === next.pos.lot_id &&
        prev.isMobile === next.isMobile &&
        prev.isOccupied === next.isOccupied &&
        prev.isSelected === next.isSelected &&
        prev.isTargetLot === next.isTargetLot &&
        prev.aggregatedItems === next.aggregatedItems &&
        prev.isAssignmentMode === next.isHighlightBlinking &&
        prev.isHighlightBlinking === next.isHighlightBlinking &&
        prev.displayInternalCode === next.displayInternalCode &&
        prev.isPrintPage === next.isPrintPage &&
        prev.isGrouped === next.isGrouped &&
        prev.isSanh === next.isSanh &&
        prev.isManualMerge === next.isManualMerge
});

export default MergedBigCell;

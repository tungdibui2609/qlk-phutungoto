'use client'
import React from 'react'
import { Eye, MoreHorizontal, Package } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { TagDisplay } from '@/components/lots/TagDisplay'

type Position = Database['public']['Tables']['positions']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

const PositionCell = React.memo<{
    pos: PositionWithZone,
    cellHeight: number,
    cellWidth: number,
    isMobile: boolean,
    isOccupied: boolean,
    isSelected: boolean,
    isTargetLot: boolean,
    lotDetail: any,
    isAssignmentMode: boolean,
    isHighlightBlinking: boolean,
    displayInternalCode?: boolean,
    isGrouped?: boolean,
    onPositionSelect?: (id: string | string[]) => void,
    onViewDetails?: (lotId: string) => void,
    onPositionMenu?: (pos: any, event: React.MouseEvent) => void,
    isPrintPage?: boolean,
    isSanh?: boolean
}>(({
    pos, cellHeight, cellWidth, isMobile, isOccupied, isSelected,
    isTargetLot, lotDetail, isAssignmentMode, isHighlightBlinking, displayInternalCode, isGrouped,
    onPositionSelect, onViewDetails, onPositionMenu, isPrintPage, isSanh
}) => {
    const ids = (pos as any).realIds || [pos.id]
    let bgClass = 'bg-white dark:bg-gray-700'
    let borderClass = 'border-gray-200 dark:border-gray-600'
    let ringClass = ''

    if (isSelected) {
        bgClass = 'bg-blue-50 dark:bg-blue-900/30'
        borderClass = 'border-blue-500'
        ringClass = 'ring-2 ring-blue-300'
    } else if (isTargetLot) {
        bgClass = 'bg-purple-100 dark:bg-purple-900/40'
        borderClass = 'border-purple-500'
        ringClass = 'ring-2 ring-purple-300'
    } else if (isOccupied) {
        bgClass = 'bg-amber-50 dark:bg-amber-900/10'
        borderClass = 'border-amber-200 dark:border-amber-800'
    }

    return (
        <div
            style={{
                height: cellHeight > 0 
                    ? `${cellHeight}px` 
                    : (isPrintPage ? '100%' : (isMobile ? '100px' : '125px')),
                minHeight: cellHeight > 0 
                    ? `${cellHeight}px` 
                    : (isPrintPage ? (isSanh ? '60px' : '125px') : (isMobile ? '100px' : '125px')),
                width: cellWidth > 0 ? `${cellWidth}px` : '100%'
            }}
            className={`
                relative ${isAssignmentMode ? 'cursor-pointer' : ''} ${isMobile ? 'p-0.5' : 'p-1'} rounded-lg border-2 transition-all
                flex flex-col justify-between overflow-hidden
                ${bgClass} ${borderClass} ${ringClass}
                ${isAssignmentMode ? 'hover:shadow-lg hover:scale-[1.02] hover:z-10' : ''}
                ${isHighlightBlinking ? 'animate-highlight-blink' : ''}
                ${isPrintPage ? `min-h-${isSanh ? '0' : '[125px]'} h-${isSanh ? 'auto' : '[125px]'} print:overflow-visible` : ''}
            `}
            onClick={() => isAssignmentMode && onPositionSelect?.(ids)}
        >
            {!isAssignmentMode && !isPrintPage && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onPositionSelect?.(ids)
                    }}
                    className={`
                        absolute bottom-1 left-1 z-20 w-4 h-4 rounded
                        border-2 transition-all duration-150
                        flex items-center justify-center
                        ${isSelected
                            ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                            : 'bg-white/90 dark:bg-gray-800/90 border-gray-300 dark:border-gray-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                        }
                    `}
                    title={isSelected ? "Bỏ chọn vị trí" : "Chọn vị trí"}
                >
                    {isSelected && (
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </button>
            )}

            <div className="flex justify-center items-start w-full relative mb-1 shrink-0">
                {!isAssignmentMode && isOccupied && lotDetail && !isPrintPage && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onViewDetails?.(pos.lot_id!)
                        }}
                        className="absolute left-0 top-0 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors z-20"
                        title="Xem chi tiết LOT"
                    >
                        <Eye size={12} />
                    </button>
                )}

                <div className={`font-mono ${isGrouped ? 'text-[8px]' : 'text-[10px]'} flex justify-center items-center text-black dark:text-white font-bold leading-tight w-full text-center ${cellWidth === 0 && !isGrouped ? 'whitespace-nowrap px-1' : 'break-all px-0.5'}`} style={{ minWidth: 0 }}>
                    {pos.code}
                </div>

                {!isAssignmentMode && !isPrintPage && (
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onPositionMenu?.(pos, e)
                        }}
                        className="absolute right-0 top-0 text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 transition-colors z-40 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-bl-lg"
                        title="Tùy chọn"
                    >
                        <MoreHorizontal size={14} />
                    </button>
                )}

                <div className={`flex gap-0.5 absolute ${!isAssignmentMode && !isPrintPage ? 'right-5' : 'right-0'} top-0`}>
                    {isTargetLot && (
                        <div title="Đang chọn" className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    )}
                    {isOccupied && !isTargetLot && !isPrintPage && (
                        <div title="Có hàng">
                            <Package size={10} className="text-amber-500 dark:text-amber-400" />
                        </div>
                    )}
                </div>
            </div>

            {lotDetail && isOccupied ? (
                <div className="flex flex-col items-center w-full flex-1 min-h-0 gap-0.5 mt-0.5">
                    <div className={`${isGrouped ? 'text-[8px]' : 'text-[10px]'} font-bold leading-tight w-full text-center shrink-0 ${isTargetLot ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'} ${isGrouped ? 'break-all' : 'line-clamp-1 text-ellipsis overflow-hidden'}`}>
                        {lotDetail.code}
                    </div>

                    <div className="w-full space-y-1 flex-1 min-h-0">
                        {lotDetail.items?.map((item: any, idx: number) => {
                            const nameObj = displayInternalCode && item.internal_name ? item.internal_name : item.product_name;
                            const codeObj = displayInternalCode && item.internal_code ? item.internal_code : item.sku;
                            return (
                                <div key={idx} className="flex flex-col gap-0.5 w-full text-center border-b border-black/5 dark:border-white/5 last:border-0 pb-0.5 last:pb-0 shrink-0">
                                    {nameObj && (
                                        <div className="text-[9px] text-gray-600 dark:text-gray-300 leading-tight line-clamp-2" title={nameObj}>
                                            {nameObj}
                                        </div>
                                    )}
                                    <div className="text-[9px] font-mono text-blue-600 dark:text-blue-400 font-bold break-words">
                                        {codeObj || '-'} : {item.quantity} {item.unit || '-'}
                                    </div>
                                    {item.tags && item.tags.length > 0 && (
                                        <TagDisplay
                                            tags={item.tags}
                                            variant="compact"
                                            placeholderMap={{ '@': codeObj || '' }}
                                            className="mt-0.5"
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex justify-between items-center w-full px-0.5 pt-0.5 opacity-80 text-[8px] text-gray-500 dark:text-gray-400 mt-auto font-mono">
                        {(() => {
                            const formatDate = (dateStr: string) => {
                                if (!dateStr) return '';
                                const d = new Date(dateStr);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = String(d.getFullYear()).slice(-2);
                                return `${day}/${month}/${year}`;
                            };

                            const peeling = lotDetail.peeling_date ? `B:${formatDate(lotDetail.peeling_date)}` : '';
                            const packaging = lotDetail.packaging_date ? `Đ:${formatDate(lotDetail.packaging_date)}` : '';
                            const inbound = lotDetail.inbound_date && !lotDetail.peeling_date && !lotDetail.packaging_date
                                ? `N:${formatDate(lotDetail.inbound_date)}`
                                : '';

                            if (peeling && packaging) {
                                return (
                                    <>
                                        <span className="shrink-0">{peeling}</span>
                                        <span className="text-gray-300 dark:text-gray-600">|</span>
                                        <span className="shrink-0">{packaging}</span>
                                    </>
                                );
                            }

                            const display = peeling || packaging || inbound;
                            return <span className="w-full text-center">{display}</span>;
                        })()}
                    </div>
                </div>
            ) : (
                <div className={`flex-1 shrink-0 flex items-center justify-center ${isPrintPage ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}>
                    <span className="text-[10px] text-gray-400 font-medium font-mono uppercase">Trống</span>
                </div>
            )}
        </div>
    )
}, (prev, next) => {
    return prev.pos.id === next.pos.id &&
        prev.pos.lot_id === next.pos.lot_id &&
        prev.cellHeight === next.cellHeight &&
        prev.cellWidth === next.cellWidth &&
        prev.isMobile === next.isMobile &&
        prev.isOccupied === next.isOccupied &&
        prev.isSelected === next.isSelected &&
        prev.isTargetLot === next.isTargetLot &&
        prev.lotDetail === next.lotDetail &&
        prev.isAssignmentMode === next.isAssignmentMode &&
        prev.isHighlightBlinking === next.isHighlightBlinking &&
        prev.displayInternalCode === next.displayInternalCode &&
        prev.isGrouped === next.isGrouped &&
        prev.isPrintPage === next.isPrintPage &&
        prev.isSanh === next.isSanh
});

export default PositionCell;

import { MapPin, Layers, Truck, ShieldCheck, Info, ChevronUp, ChevronDown, QrCode as QrIcon, Eye, Edit, Trash2, Tag, Combine, Split, ArrowUpRight, History, Star } from 'lucide-react'
import { useState } from 'react'
import { Lot } from '../_hooks/useLotManagement'
import { useRouter } from 'next/navigation'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { LotMergeHistoryModal } from '@/components/warehouse/lots/LotMergeHistoryModal'

interface LotCardProps {
    lot: Lot
    isModuleEnabled: (moduleId: string) => boolean
    isUtilityEnabled: (utilityId: string) => boolean
    onEdit: (lot: Lot) => void
    onDelete: (id: string) => void
    onView: (lot: Lot) => void
    onQr: (lot: Lot) => void
    onToggleStar: (lot: Lot) => void
    onAssignTag: (lot: Lot) => void
    onMerge?: (lot: Lot) => void
    onSplit?: (lot: Lot) => void
    onExport?: (lot: Lot) => void
}

export function LotCard({ lot, isModuleEnabled, isUtilityEnabled, onEdit, onDelete, onView, onQr, onToggleStar, onAssignTag, onMerge, onSplit, onExport }: LotCardProps) {
    const router = useRouter()
    const [isExpanded, setIsExpanded] = useState(false)
    const [historyData, setHistoryData] = useState<any>(null)

    // Helper to render info items dynamically
    const renderInfoItems = () => {
        const infoItems: Array<{ key: string; icon: React.ReactNode; label: string; colorClass: string }> = [];

        if (lot.batch_code && isModuleEnabled('batch_code')) {
            infoItems.push({
                key: 'batch',
                icon: <Layers size={14} />,
                label: lot.batch_code,
                colorClass: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
            });
        }

        if (lot.suppliers && isModuleEnabled('supplier_info')) {
            infoItems.push({
                key: 'supplier',
                icon: <Truck size={14} />,
                label: lot.suppliers.name,
                colorClass: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            });
        }

        if (lot.qc_info && isModuleEnabled('qc_info')) {
            infoItems.push({
                key: 'qc',
                icon: <ShieldCheck size={14} />,
                label: lot.qc_info.name,
                colorClass: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
            });
        }

        if (isModuleEnabled('extra_info')) {
            const extraInfo = lot.metadata && (lot.metadata as any).extra_info;
            infoItems.push({
                key: 'extra',
                icon: <Info size={14} />,
                label: extraInfo || '',
                colorClass: extraInfo ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
            });
        }

        if (infoItems.length === 0) return null;

        // Split items evenly between left and right columns
        const midpoint = Math.ceil(infoItems.length / 2);
        const leftItems = infoItems.slice(0, midpoint);
        const rightItems = infoItems.slice(midpoint);

        const renderItem = (item: typeof infoItems[0]) => (
            <div key={item.key} className={`flex items-center gap-2 ${!item.label && item.key === 'extra' ? 'opacity-50 select-none' : ''}`} title={item.label}>
                <span className={`${item.colorClass} p-1.5 rounded-lg shrink-0`}>
                    {item.icon}
                </span>
                <span className={`text-xs font-bold uppercase truncate ${!item.label && item.key === 'extra' ? 'text-zinc-400 italic' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {item.label || 'No info'}
                </span>
            </div>
        );

        return (
            <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="flex flex-col gap-2">
                    {leftItems.map(renderItem)}
                </div>
                <div className="flex flex-col gap-2">
                    {rightItems.map(renderItem)}
                </div>
            </div>
        );
    }

    return (
        <div className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-orange-500/30 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            {/* Decorative Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 to-orange-400 z-10 transition-opacity"></div>

            {/* Header - Colored */}
            <div className="px-4 pt-5 pb-4 bg-orange-50/50 dark:bg-orange-900/10 border-b border-orange-100/50 dark:border-orange-900/20">
                <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shadow-sm border border-black/5 dark:border-white/5">
                            LOT: {lot.code}
                        </span>
                    </div>
                    {lot.positions && lot.positions.length > 0 ? (
                        <button
                            onClick={() => router.push(`/warehouses/map?assignLotId=${lot.id}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold border border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors shadow-sm"
                        >
                            <MapPin size={12} />
                            {lot.positions[0].code}
                            {lot.positions.length > 1 && <span className="ml-1 text-[10px] opacity-70">+{lot.positions.length - 1}</span>}
                        </button>
                    ) : (
                        <button
                            onClick={() => router.push(`/warehouses/map?assignLotId=${lot.id}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 text-zinc-400 text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <MapPin size={12} />
                            Chưa gán
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="p-3 flex-1 flex flex-col">
                {/* Dates Grid */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    {isModuleEnabled('inbound_date') && (
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-2 border border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ngày nhập kho</div>
                            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                {lot.inbound_date ? new Date(lot.inbound_date).toLocaleDateString('vi-VN') : '--/--/----'}
                            </div>
                        </div>
                    )}

                    {isModuleEnabled('peeling_date') && (
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-2 border border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ngày bóc múi</div>
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {lot.peeling_date ? new Date(lot.peeling_date).toLocaleDateString('vi-VN') : '--/--/----'}
                            </div>
                        </div>
                    )}

                    {isModuleEnabled('packaging_date') && (
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-2 border border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ngày đóng bao bì</div>
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {lot.packaging_date ? new Date(lot.packaging_date).toLocaleDateString('vi-VN') : '--/--/----'}
                            </div>
                        </div>
                    )}

                    {!isModuleEnabled('packaging_date') && !isModuleEnabled('peeling_date') && !isModuleEnabled('inbound_date') && (
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-2 border border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ngày tạo</div>
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {new Date(lot.created_at).toLocaleDateString('vi-VN')}
                            </div>
                        </div>
                    )}
                </div>

                {renderInfoItems()}

                {/* Product Info */}
                <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Sản phẩm ({lot.lot_items?.length || 0})</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                            {lot.lot_items && lot.lot_items.length > 0 ? (
                                Object.entries(
                                    lot.lot_items.reduce((acc: Record<string, number>, item: any) => {
                                        const unit = (item as any).unit || item.products?.unit || 'Đơn vị';
                                        acc[unit] = (acc[unit] || 0) + (item.quantity || 0);
                                        return acc;
                                    }, {})
                                ).map(([unit, total]) => (
                                    <span key={unit} className="text-orange-600 font-bold text-sm bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                        {total} <span className="text-[10px] font-medium text-orange-500/70">{unit}</span>
                                    </span>
                                ))
                            ) : (
                                <span className="text-zinc-400 text-xs italic">--</span>
                            )}
                        </div>
                    </div>
                    {(() => {
                        const items = lot.lot_items || [];
                        const displayItems = isExpanded ? items : items.slice(0, 2);
                        const hasMore = items.length > 2;

                        return (
                            <>
                                <div className="space-y-0">
                                    {displayItems.length > 0 ? (
                                        displayItems.map((item, index) => {
                                            // 1. Check history from metadata (New)
                                            const itemHistory = (lot.metadata as any)?.system_history?.item_history?.[item.id];
                                            let parsedHistory = itemHistory?.snapshot || null;
                                            let historyType = itemHistory?.type || null; // 'split' | 'merge'
                                            let sourceCode = itemHistory?.source_code || null;

                                            // 2. Check history from tags (Legacy/Compatibility)
                                            const originTag = lot.lot_tags?.find(t => t.lot_item_id === item.id && (t.tag.startsWith('MERGED_') || t.tag.startsWith('SPLIT_')));

                                            if (!parsedHistory && originTag) {
                                                const isMergedData = originTag.tag.startsWith('MERGED_DATA:');
                                                const isSplitData = originTag.tag.startsWith('SPLIT_DATA:');
                                                if (isMergedData || isSplitData) {
                                                    try {
                                                        const prefix = isMergedData ? 'MERGED_DATA:' : 'SPLIT_DATA:';
                                                        parsedHistory = JSON.parse(originTag.tag.replace(prefix, ''));
                                                        historyType = isMergedData ? 'merge' : 'split';
                                                        sourceCode = parsedHistory.code;
                                                    } catch (e) {
                                                        console.error('Error parsing legacy tag history:', e);
                                                    }
                                                }
                                            }

                                            const hasHistory = !!parsedHistory || !!originTag;
                                            const isSplit = historyType === 'split' || (originTag && (originTag.tag.startsWith('SPLIT_') || originTag.tag.startsWith('SPLIT_DATA:')));

                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => {
                                                        if (parsedHistory) setHistoryData(parsedHistory);
                                                        else if (originTag && !parsedHistory) {
                                                            const originInfo = originTag.tag.startsWith('MERGED_FROM:')
                                                                ? `Sản phẩm được gộp từ Lot: ${originTag.tag.replace('MERGED_FROM:', '')}`
                                                                : `Sản phẩm được tách từ Lot: ${originTag.tag.replace('SPLIT_FROM:', '')}`;
                                                            alert(`${originInfo}. (Dữ liệu cũ chi tiết không khả dụng cho Lot này)`);
                                                        }
                                                    }}
                                                    className={`text-sm text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2 py-2 px-2 rounded-lg border-b border-dashed border-slate-100 dark:border-slate-800 last:border-0 ${hasHistory ? 'bg-indigo-50/60 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors' : (index % 2 === 1 ? 'bg-white/60 dark:bg-white/5' : '')}`}
                                                >
                                                    <div className="flex flex-col flex-1 min-w-0 gap-1">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                                <div className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-100 dark:border-indigo-800 font-mono font-bold text-xs shrink-0">
                                                                    {item.products?.sku}
                                                                </div>
                                                                <div className="flex items-center gap-1 font-mono text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-900/30 shrink-0">
                                                                    <span className="font-bold">{item.quantity}</span>
                                                                    <span className="opacity-80">{(item as any).unit || item.products?.unit}</span>
                                                                </div>
                                                                {(parsedHistory || originTag) && (
                                                                    <div
                                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${isSplit ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'}`}
                                                                        title={parsedHistory ? 'Bấm để xem lịch sử' : (originTag?.tag.startsWith('MERGED_FROM:') ? originTag.tag.replace('MERGED_FROM:', 'Gộp từ Lot: ') : originTag?.tag.replace('SPLIT_FROM:', 'Tách từ Lot: '))}
                                                                    >
                                                                        <History size={10} />
                                                                        <span>
                                                                            {parsedHistory
                                                                                ? (isSplit ? `SPLIT_FROM:${sourceCode}` : sourceCode)
                                                                                : (originTag?.tag.includes(':') ? originTag.tag.split(':')[1] : originTag?.tag)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="truncate font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight" title={item.products?.name}>{item.products?.name}</span>
                                                        </div>

                                                        {/* Inline Tags */}
                                                        {lot.lot_tags && (
                                                            <div className="flex flex-wrap gap-1">
                                                                <TagDisplay
                                                                    tags={lot.lot_tags
                                                                        .filter(t =>
                                                                            t.lot_item_id === item.id &&
                                                                            !t.tag.startsWith('MERGED_FROM:') &&
                                                                            !t.tag.startsWith('MERGED_DATA:') &&
                                                                            !t.tag.startsWith('SPLIT_FROM:') &&
                                                                            !t.tag.startsWith('SPLIT_DATA:')
                                                                        )
                                                                        .map(t => t.tag)}
                                                                    placeholderMap={{
                                                                        '@': item.products?.sku || 'SẢN PHẨM'
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onQr(lot);
                                                        }}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-white dark:hover:bg-zinc-800 shadow-sm transition-all border border-transparent hover:border-zinc-200 shrink-0"
                                                        title="Mã QR Item"
                                                    >
                                                        <QrIcon size={14} />
                                                    </button>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="text-sm text-zinc-400 italic">
                                            {lot.products?.name ? (
                                                <div className="text-sm text-zinc-800 dark:text-zinc-200 flex justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="truncate">{lot.products.name}</div>
                                                        {lot.lot_tags && (
                                                            <div className="mt-1">
                                                                <TagDisplay tags={lot.lot_tags.map(t => t.tag)} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-mono text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300 h-fit">
                                                        {lot.quantity} {lot.products.unit}
                                                    </span>
                                                </div>
                                            ) : '---'}
                                        </div>
                                    )}
                                </div>

                                {hasMore && (
                                    <button
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="w-full mt-2 py-1 flex items-center justify-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                    >
                                        {isExpanded ? (
                                            <>
                                                <ChevronUp size={14} />
                                                Thu gọn
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown size={14} />
                                                Xem thêm {items.length - 2} sản phẩm
                                            </>
                                        )}
                                    </button>
                                )}
                            </>
                        );
                    })()}
                </div>

                {/* Tags (Unassigned) */}
                {lot.lot_tags && lot.lot_tags.filter(t => !t.lot_item_id).length > 0 && (
                    <div className="mt-2 text-xs">
                        <TagDisplay
                            tags={lot.lot_tags
                                .filter(t =>
                                    !t.lot_item_id &&
                                    !t.tag.startsWith('SPLIT_TO:') &&
                                    !t.tag.startsWith('MERGED_TO:')
                                )
                                .map(t => t.tag)}
                            placeholderMap={{
                                '@': lot.products?.sku || lot.products?.name || 'SẢN PHẨM'
                            }}
                        />
                    </div>
                )}

                {lot.notes && (
                    <div className="mt-2 bg-amber-50 dark:bg-amber-900/10 p-1.5 rounded-lg border border-amber-100 dark:border-amber-900/20">
                        <p className="text-xs text-amber-800 dark:text-amber-300 line-clamp-2">
                            <span className="font-bold mr-1">Ghi chú:</span>
                            {lot.notes}
                        </p>
                    </div>
                )}
            </div>

            {/* Actions Footer - Colored */}
            <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
                <div className="flex gap-2">
                    <button
                        onClick={() => onToggleStar(lot)}
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all border border-transparent ${lot.metadata?.is_starred
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30'
                            : 'text-zinc-400 hover:text-zinc-800 hover:bg-white dark:hover:bg-zinc-800 shadow-sm hover:border-zinc-200'
                            }`}
                        title={lot.metadata?.is_starred ? "Bỏ đánh dấu" : "Đánh dấu sao"}
                    >
                        <Star size={16} fill={lot.metadata?.is_starred ? "currentColor" : "none"} />
                    </button>
                    <button
                        onClick={() => onAssignTag?.(lot)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-zinc-800 transition-all border border-transparent"
                        title="Gắn mã phụ"
                    >
                        <Tag size={16} />
                    </button>

                    <button
                        onClick={() => onExport?.(lot)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all border border-transparent"
                        title="Xuất Lot"
                    >
                        <ArrowUpRight size={16} />
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => onView(lot)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Xem chi tiết"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => onEdit(lot)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                        title="Sửa"
                    >
                        <Edit size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(lot.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Xóa"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            {historyData && (
                <LotMergeHistoryModal
                    data={historyData}
                    onClose={() => setHistoryData(null)}
                />
            )}
        </div>
    )
}

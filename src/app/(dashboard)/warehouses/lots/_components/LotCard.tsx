import { MapPin, Layers, Truck, ShieldCheck, Info, ChevronUp, ChevronDown, QrCode as QrIcon, Eye, Edit, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Lot } from '../_hooks/useLotManagement'
import { useRouter } from 'next/navigation'

interface LotCardProps {
    lot: Lot
    isModuleEnabled: (moduleId: string) => boolean
    onEdit: (lot: Lot) => void
    onDelete: (id: string) => void
    onView: (lot: Lot) => void
    onQr: (lot: Lot) => void
}

export function LotCard({ lot, isModuleEnabled, onEdit, onDelete, onView, onQr }: LotCardProps) {
    const router = useRouter()
    const [isExpanded, setIsExpanded] = useState(false)

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
        <div className="group bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            {/* Decorative Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-400 z-10 transition-opacity"></div>

            {/* Header - Colored */}
            <div className="px-4 pt-5 pb-4 bg-emerald-50/50 dark:bg-emerald-900/10 border-b border-emerald-100/50 dark:border-emerald-900/20">
                <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shadow-sm border border-black/5 dark:border-white/5">
                            LOT: {lot.code}
                        </span>
                    </div>
                    {lot.positions && lot.positions.length > 0 ? (
                        <button
                            onClick={() => router.push(`/warehouses/map?assignLotId=${lot.id}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors shadow-sm"
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
                        <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-2 border border-zinc-100 dark:border-zinc-800">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Ngày nhập kho</div>
                            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                {lot.inbound_date ? new Date(lot.inbound_date).toLocaleDateString('vi-VN') : '--/--/----'}
                            </div>
                        </div>
                    )}

                    {isModuleEnabled('packaging_date') && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-2 border border-zinc-100 dark:border-zinc-800">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Ngày đóng bao bì</div>
                            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                {lot.packaging_date ? new Date(lot.packaging_date).toLocaleDateString('vi-VN') : '--/--/----'}
                            </div>
                        </div>
                    )}

                    {isModuleEnabled('peeling_date') && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-2 border border-zinc-100 dark:border-zinc-800">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Ngày bóc múi</div>
                            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                {lot.peeling_date ? new Date(lot.peeling_date).toLocaleDateString('vi-VN') : '--/--/----'}
                            </div>
                        </div>
                    )}

                    {!isModuleEnabled('packaging_date') && !isModuleEnabled('peeling_date') && !isModuleEnabled('inbound_date') && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-2 border border-zinc-100 dark:border-zinc-800">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Ngày tạo</div>
                            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                {new Date(lot.created_at).toLocaleDateString('vi-VN')}
                            </div>
                        </div>
                    )}
                </div>

                {renderInfoItems()}

                {/* Product Info */}
                <div className="mt-2 p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase">Sản phẩm ({lot.lot_items?.length || 0})</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                            {lot.lot_items && lot.lot_items.length > 0 ? (
                                Object.entries(
                                    lot.lot_items.reduce((acc: Record<string, number>, item: any) => {
                                        const unit = (item as any).unit || item.products?.unit || 'Đơn vị';
                                        acc[unit] = (acc[unit] || 0) + (item.quantity || 0);
                                        return acc;
                                    }, {})
                                ).map(([unit, total]) => (
                                    <span key={unit} className="text-emerald-600 font-bold text-sm bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                        {total} <span className="text-[10px] font-medium text-emerald-500/70">{unit}</span>
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
                                        displayItems.map((item, index) => (
                                            <div key={item.id} className={`text-sm text-zinc-800 dark:text-zinc-200 flex justify-between items-center gap-2 py-2 px-2 rounded-lg border-b border-dashed border-zinc-100 dark:border-zinc-800 last:border-0 ${index % 2 === 1 ? 'bg-white/60 dark:bg-white/5' : ''}`}>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 leading-none mb-0.5">{item.products?.sku}</span>
                                                    <span className="truncate font-medium leading-tight" title={item.products?.name}>{item.products?.name}</span>
                                                </div>
                                                <span className="font-mono text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                                                    {item.quantity} {(item as any).unit || item.products?.unit}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-zinc-400 italic">
                                            {lot.products?.name ? (
                                                <div className="text-sm text-zinc-800 dark:text-zinc-200 flex justify-between gap-2">
                                                    <span className="truncate flex-1">{lot.products.name}</span>
                                                    <span className="font-mono text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
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
            <div className="px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between mt-auto">
                <div className="flex gap-2">
                    <button
                        onClick={() => onQr(lot)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-white dark:hover:bg-zinc-800 shadow-sm transition-all border border-transparent hover:border-zinc-200"
                        title="Mã QR"
                    >
                        <QrIcon size={16} />
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
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
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
        </div>
    )
}

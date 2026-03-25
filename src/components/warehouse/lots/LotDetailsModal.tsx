'use client'

import React, { useState } from 'react'
import { Boxes, X, Calendar, Package, Factory, MapPin, Truck, ShieldCheck, Layers, Info, Maximize2, QrCode as QrIcon, History, Trash2, Edit, Hash } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { LotMergeHistoryModal } from './LotMergeHistoryModal'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import Protected from '@/components/auth/Protected'
import { useUser } from '@/contexts/UserContext'
import { getProductColorStyle } from '@/lib/warehouseUtils'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'
import { formatQuantityFull } from '@/lib/numberUtils'


interface LotDetailsModalProps {
    lot: Lot | null
    onClose: () => void
    onOpenQr: (lot: Lot) => void
    onDelete?: (id: string) => void
    isModuleEnabled: (moduleId: string) => boolean
    managePermission?: string
}

export const LotDetailsModal: React.FC<LotDetailsModalProps> = ({ lot, onClose, onOpenQr, onDelete, isModuleEnabled, managePermission }) => {
    const router = useRouter()
    const pathname = usePathname()
    const { profile } = useUser() // Assuming useUser provides a profile
    const isSanxuat = pathname?.startsWith('/sanxuat') || false

    const [historyData, setHistoryData] = React.useState<any>(null)
    const [isHighlighting, setIsHighlighting] = React.useState(false)
    const [isEditing, setIsEditing] = useState(false) // Added from diff
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null)

    // Trigger highlight when positions change
    const positionsHash = JSON.stringify(lot?.positions || [])
    const [lastPositionsHash, setLastPositionsHash] = React.useState(positionsHash)

    React.useEffect(() => {
        if (lot && positionsHash !== lastPositionsHash) {
            setLastPositionsHash(positionsHash)
            setIsHighlighting(true)
            const timer = setTimeout(() => setIsHighlighting(false), 1500)
            return () => clearTimeout(timer)
        }
    }, [positionsHash, lot, lastPositionsHash])

    const { units, conversionMap } = useUnitConversion()

    const formatUnitWithWeight = React.useCallback((productId: string | null, unitName: string | null) => {
        if (!unitName) return ''
        if (unitName.includes('(')) return unitName
        const normU = normalizeUnit(unitName)
        
        // Find base weight for this specific product from the lot object
        let baseWeight = 0
        let baseUnitName = ''
        if (lot.products) {
            baseWeight = (lot.products as any).weight_kg || 0
            baseUnitName = lot.products.unit || ''
        } else if (lot.lot_items) {
            const item = lot.lot_items.find((i: any) => i.product_id === productId)
            if (item?.products) {
                baseWeight = (item.products as any).weight_kg || 0
                baseUnitName = item.products.unit || ''
            }
        }

        // Fallback: If base unit is Kg and weight is not set, assume 1kg
        const nb = normalizeUnit(baseUnitName)
        if (baseWeight <= 0 && (nb === 'kg' || nb === 'kilogram')) {
            baseWeight = 1
        }

        const productRates = productId ? conversionMap.get(productId) : null
        let rate = 1
        if (productRates) {
            const matchingUnit = units.find(u => {
                const n = normalizeUnit(u.name)
                return (n === normU || n.replace(/\s*\([^)]*\)/, '').trim() === normU) && productRates.has(u.id)
            })
            if (matchingUnit) rate = productRates.get(matchingUnit.id) || 1
        }

        const totalWeight = rate * baseWeight
        return formatUnitWeight(unitName, totalWeight)
    }, [units, conversionMap, lot])

    if (!lot) return null

    const handleDelete = () => {
        if (lot?.id && onDelete) {
            onDelete(lot.id);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 flex flex-col relative">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <Boxes size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">Chi tiết Lô hàng</h3>
                            <p className="text-xs text-orange-600 dark:text-orange-400 font-mono mt-1 font-bold">{lot.code}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-6">
                        {/* Top Grid: Dates & Location */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {isModuleEnabled('inbound_date') && (
                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                        <Calendar size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Ngày nhập</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {lot.inbound_date ? new Date(lot.inbound_date).toLocaleDateString('vi-VN') : '--/--/----'}
                                    </p>
                                </div>
                            )}
                            {isModuleEnabled('peeling_date') && (
                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                        <Factory size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Bóc múi</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {lot.peeling_date ? new Date(lot.peeling_date).toLocaleDateString('vi-VN') : '--/--/----'}
                                    </p>
                                </div>
                            )}
                            {isModuleEnabled('packaging_date') && (
                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                        <Package size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Đóng bao bì</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {lot.packaging_date ? new Date(lot.packaging_date).toLocaleDateString('vi-VN') : '--/--/----'}
                                    </p>
                                </div>
                            )}

                            {/* Fallback for created_at if no date modules are enabled */}
                            {!isModuleEnabled('packaging_date') && !isModuleEnabled('peeling_date') && !isModuleEnabled('inbound_date') && (
                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                        <Calendar size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Ngày tạo</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {lot.created_at ? new Date(lot.created_at).toLocaleDateString('vi-VN') : '--/--/----'}
                                    </p>
                                </div>
                            )}

                            <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1 transition-all duration-300 ${isHighlighting ? 'animate-highlight-blink' : ''}`}>
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                    <MapPin size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Vị trí</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {lot.positions && lot.positions.length > 0 ? (
                                        lot.positions.map((p: any) => (
                                            <span key={p.code} className="text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-lg border border-orange-100 dark:border-orange-900/10">
                                                {p.code}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-sm font-medium text-slate-400 italic">Chưa gán</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Main Info List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {isModuleEnabled('supplier_info') && (
                                <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                        <Truck size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Nhà cung cấp</p>
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{lot.suppliers?.name || '---'}</p>
                                    </div>
                                </div>
                            )}
                            {isModuleEnabled('qc_info') && (
                                <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nhân viên QC</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{lot.qc_info?.name || '---'}</p>
                                    </div>
                                </div>
                            )}
                            {isModuleEnabled('raw_material_date') && (
                                <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                                        <Calendar size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Ngày nhập nguyên liệu</p>
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                            {lot.raw_material_date ? new Date(lot.raw_material_date).toLocaleDateString('vi-VN') : '---'}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {isModuleEnabled('production_code') && (
                                <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                        <Hash size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Mã sản xuất</p>
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{lot.production_code || '---'}</p>
                                    </div>
                                </div>
                            )}
                            {isModuleEnabled('batch_code') && (
                                <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                        <Layers size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Số Batch/Lô</p>
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{lot.batch_code || '---'}</p>
                                    </div>
                                </div>
                            )}
                            {isModuleEnabled('extra_info') && (
                                <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                                        <Info size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Thông tin thêm</p>
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                            {lot.metadata && (lot.metadata as any).extra_info || '---'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notes Section */}
                        {lot.notes && (
                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                                    <Info size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Ghi chú</span>
                                </div>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{lot.notes}</p>
                            </div>
                        )}

                        {/* Image Gallery Section */}
                        {((lot.images && lot.images.length > 0) || (lot.metadata?.images && (lot.metadata.images as string[]).length > 0)) && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Package size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Hình ảnh ({lot.images ? lot.images.length : (lot.metadata?.images as string[]).length})</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {(lot.images || lot.metadata?.images as string[]).map((img: string, idx: number) => (
                                        <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 group relative">
                                            <img src={img} alt={`Lot image ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    onClick={() => setSelectedImage(img)}
                                                    className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40"
                                                >
                                                    <Maximize2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Product List Section */}
                        <div className="space-y-3 mt-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Boxes size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Danh sách sản phẩm</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {(() => {
                                        const items = lot.lot_items || [];
                                        const summary = items.reduce((acc: Record<string, number>, item: any) => {
                                            const unit = formatUnitWithWeight(item.product_id, (item as any).unit || item.products?.unit || 'Đơn vị');
                                            acc[unit] = (acc[unit] || 0) + (item.quantity || 0);
                                            return acc;
                                        }, {});
                                        return Object.entries(summary).map(([unit, total]) => (
                                            <span key={unit} className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-lg border border-orange-100 dark:border-orange-900/10">
                                                {formatQuantityFull(total as number)} {unit}
                                            </span>
                                        ));
                                    })()}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/50">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {lot.lot_items?.map((item: any, idx: number) => (
                                        <div
                                            key={item.id}
                                            className={`p-3 flex items-start justify-between gap-3 ${idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/5' : ''}`}
                                        >
                                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-12">Gốc:</span>
                                                                <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 shrink-0">
                                                                    <div 
                                                                        className="w-2.5 h-2.5 rounded-full border border-black/10 shadow-sm" 
                                                                        style={getProductColorStyle((item.products as any)?.color)}
                                                                    />
                                                                    <span className="text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                                                        {item.products?.sku}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {item.products?.internal_code && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest w-12">Nội bộ:</span>
                                                                    <div className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-800 shrink-0">
                                                                        {item.products.internal_code}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg border border-orange-100 dark:border-orange-900/30 shrink-0 self-start">
                                                            <span className="text-xs font-bold">{formatQuantityFull(item.quantity)}</span>
                                                            <span className="text-[10px] font-medium opacity-80">{formatUnitWithWeight(item.product_id, (item as any).unit || item.products?.unit)}</span>
                                                        </div>

                                                    {/* QR Button for Product */}
                                                    <button
                                                        onClick={() => {
                                                            const itemLot = {
                                                                ...lot,
                                                                lot_items: [item]
                                                            }
                                                            onOpenQr(itemLot as any)
                                                        }}
                                                        className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-white dark:hover:bg-zinc-800 shadow-sm transition-all border border-transparent hover:border-zinc-200 shrink-0 ml-auto self-start"
                                                        title="In mã QR sản phẩm này"
                                                    >
                                                        <QrIcon size={18} />
                                                    </button>
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight" title={item.products?.name}>
                                                        {item.products?.name}
                                                    </h4>
                                                    {item.products?.internal_name && item.products.internal_name !== item.products.name && (
                                                        <p className="text-xs font-bold text-violet-600 dark:text-violet-400 italic">
                                                            {item.products.internal_name}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Tags & History */}
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {lot.lot_tags && (
                                                        <TagDisplay
                                                            tags={lot.lot_tags
                                                                .filter((t: any) =>
                                                                    t.lot_item_id === item.id &&
                                                                    !t.tag.startsWith('MERGED_FROM:') &&
                                                                    !t.tag.startsWith('MERGED_DATA:')
                                                                )
                                                                .map((t: any) => t.tag)}
                                                            placeholderMap={{ '@': (isModuleEnabled('internal_products') && item.products?.internal_code ? item.products.internal_code : item.products?.sku) || '' }}
                                                        />
                                                    )}

                                                    {(() => {
                                                        const mergedTag = lot.lot_tags?.find((t: any) => t.lot_item_id === item.id && (t.tag.startsWith('MERGED_FROM:') || t.tag.startsWith('MERGED_DATA:')));
                                                        if (!mergedTag) return null;
                                                        const isMergedData = mergedTag.tag.startsWith('MERGED_DATA:');
                                                        let history = null;
                                                        if (isMergedData) {
                                                            try { history = JSON.parse(mergedTag.tag.replace('MERGED_DATA:', '')); } catch (e) { }
                                                        }

                                                        return (
                                                            <button
                                                                onClick={() => {
                                                                    if (history) setHistoryData(history);
                                                                    else alert(`Sản phẩm gộp từ Lot: ${mergedTag.tag.replace('MERGED_FROM:', '')}`);
                                                                }}
                                                                className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800 text-[10px] font-bold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                                            >
                                                                <History size={10} />
                                                                <span>Gộp từ: {isMergedData ? history?.code : mergedTag.tag.replace('MERGED_FROM:', '')}</span>
                                                            </button>
                                                        )
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!lot.lot_items || lot.lot_items.length === 0) && (
                                        <div className="p-8 text-center">
                                            <p className="text-sm text-slate-400 italic">Không có sản phẩm trong lô hàng</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center gap-3">
                    <div className="flex gap-2">
                        {onDelete && (
                            <Protected permission={managePermission || "lot.manage"}>
                                <button
                                    onClick={() => lot?.id && onDelete(lot.id)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <Trash2 size={18} />
                                    <span>Xóa LOT</span>
                                </button>
                            </Protected>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
            {historyData && (
                <LotMergeHistoryModal
                    data={historyData}
                    onClose={() => setHistoryData(null)}
                />
            )}

            {/* Fullscreen Image Viewer Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-all"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Zoomed"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    )
}

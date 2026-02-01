'use client'

import React, { useState, useMemo } from 'react'
import { X, Search, ChevronDown, ChevronUp, MapPin, Boxes, Check, AlertCircle, Inbox, PackageSearch, Star } from 'lucide-react'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { supabase } from '@/lib/supabaseClient'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { parseQuantity, formatQuantityFull } from '@/lib/numberUtils'
import { QuantityInput } from '@/components/ui/QuantityInput'

interface LotMergeModalProps {
    targetLot: Lot
    lots: Lot[] // All available lots in the system
    onClose: () => void
    onSuccess: () => void
}

export const LotMergeModal: React.FC<LotMergeModalProps> = ({ targetLot, lots, onClose, onSuccess }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterTab, setFilterTab] = useState<'all' | 'unplaced' | 'placed' | 'starred'>('unplaced')
    const [expandedLots, setExpandedLots] = useState<Record<string, boolean>>({})
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({}) // itemId -> quantity to merge
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Confirm Dialog State
    const [showConfirm, setShowConfirm] = useState(false)
    const [confirmData, setConfirmData] = useState<{ lotIds: string[] } | null>(null)

    // 1. Filter Source Lots (exclude target lot)
    const sourceLots = useMemo(() => {
        let filtered = lots.filter(l => l.id !== targetLot.id)

        // Tab Filter
        if (filterTab === 'unplaced') {
            filtered = filtered.filter(l => !l.positions || l.positions.length === 0)
        } else if (filterTab === 'placed') {
            filtered = filtered.filter(l => l.positions && l.positions.length > 0)
        } else if (filterTab === 'starred') {
            filtered = filtered.filter(l => l.metadata?.is_starred)
        }

        // Search Filter
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase()
            filtered = filtered.filter(l =>
                l.code.toLowerCase().includes(lowerSearch) ||
                l.lot_items?.some(item =>
                    item.products?.name.toLowerCase().includes(lowerSearch) ||
                    item.products?.sku.toLowerCase().includes(lowerSearch)
                )
            )
        }

        return filtered
    }, [lots, targetLot.id, filterTab, searchTerm])

    // Stats for Tabs
    const stats = useMemo(() => {
        const others = lots.filter(l => l.id !== targetLot.id)
        return {
            unplaced: others.filter(l => !l.positions || l.positions.length === 0).length,
            placed: others.filter(l => l.positions && l.positions.length > 0).length,
            starred: others.filter(l => l.metadata?.is_starred).length
        }
    }, [lots, targetLot.id])

    const toggleExpand = (lotId: string) => {
        setExpandedLots(prev => ({ ...prev, [lotId]: !prev[lotId] }))
    }

    const handleQuantityChange = (itemId: string, maxQty: number, value: number) => {
        const qty = value
        if (qty < 0) return

        if (qty === 0) {
            const newSelected = { ...selectedItems }
            delete newSelected[itemId]
            setSelectedItems(newSelected)
        } else {
            setSelectedItems(prev => ({
                ...prev,
                [itemId]: Math.min(qty, maxQty)
            }))
        }
    }

    const toggleSelectLot = (lot: Lot) => {
        if (!lot.lot_items) return

        const allSelected = lot.lot_items.every(item => selectedItems[item.id] === item.quantity)
        const newSelected = { ...selectedItems }

        if (allSelected) {
            lot.lot_items.forEach(item => delete newSelected[item.id])
        } else {
            lot.lot_items.forEach(item => {
                newSelected[item.id] = item.quantity
            })
        }
        setSelectedItems(newSelected)
    }

    const handlePreSubmit = () => {
        const itemIds = Object.keys(selectedItems)
        if (itemIds.length === 0) {
            setError('Vui lòng chọn ít nhất 1 sản phẩm để gộp')
            return
        }

        // Group selected items by lot to check for empty lots
        const lotMap: Record<string, string[]> = {}
        lots.forEach(l => {
            if (!l.lot_items) return
            const selectedInLot = l.lot_items.filter(item => selectedItems[item.id] === item.quantity)
            if (selectedInLot.length === l.lot_items.length && selectedInLot.length > 0) {
                lotMap[l.id] = l.positions?.map(p => p.code) || []
            }
        })

        const emptyLotsWithPos = Object.entries(lotMap).filter(([id, pos]) => pos.length > 0)

        if (emptyLotsWithPos.length > 0) {
            setConfirmData({ lotIds: emptyLotsWithPos.map(([id]) => id) })
            setShowConfirm(true)
        } else {
            executeMerge()
        }
    }

    const executeMerge = async () => {
        setLoading(true)
        setError(null)
        setShowConfirm(false)

        try {
            const itemsToMerge = Object.entries(selectedItems).map(([itemId, qty]) => ({ itemId, qty }));
            const newItemHistories: Record<string, any> = {}

            for (const entry of itemsToMerge) {
                // Find source item and its lot
                const sourceLot = lots.find(l => l.lot_items?.some(i => i.id === entry.itemId));
                if (!sourceLot) continue;

                const sourceItem = sourceLot.lot_items?.find(i => i.id === entry.itemId);
                if (!sourceItem) continue;

                // Prepare snapshot
                const snapshot = {
                    code: sourceLot.code,
                    inbound_date: sourceLot.inbound_date,
                    peeling_date: sourceLot.peeling_date,
                    packaging_date: sourceLot.packaging_date,
                    suppliers: sourceLot.suppliers,
                    qc_info: sourceLot.qc_info,
                    batch_code: sourceLot.batch_code,
                    warehouse_name: sourceLot.warehouse_name,
                    metadata: sourceLot.metadata,
                    positions: sourceLot.positions,
                    notes: sourceLot.notes,
                    merge_date: new Date().toISOString()
                };

                // 1. Decrement Source
                const sourceQty = sourceItem.quantity || 0;
                if (entry.qty >= sourceQty) {
                    await supabase.from('lot_items').delete().eq('id', sourceItem.id);
                } else {
                    await supabase.from('lot_items').update({ quantity: sourceQty - entry.qty }).eq('id', sourceItem.id);
                }

                // 2. Insert into Target
                const { data: newItem, error: insertError } = await (supabase.from('lot_items') as any).insert({
                    lot_id: targetLot.id,
                    product_id: sourceItem.product_id as string,
                    quantity: entry.qty,
                    unit: sourceItem.unit || sourceItem.products?.unit
                }).select().single();

                if (insertError) throw new Error('Lỗi khi gộp: ' + insertError.message);

                // Save history in item-level metadata map
                newItemHistories[newItem.id] = {
                    type: 'merge',
                    source_code: sourceLot.code,
                    snapshot: snapshot
                }
            }

            // 3. Update Target LOT metadata with all new item histories
            const targetMetadata = targetLot.metadata ? { ...targetLot.metadata as any } : {}
            if (!targetMetadata.system_history) targetMetadata.system_history = {}
            if (!targetMetadata.system_history.item_history) targetMetadata.system_history.item_history = {}

            Object.assign(targetMetadata.system_history.item_history, newItemHistories)

            await supabase.from('lots').update({ metadata: targetMetadata }).eq('id', targetLot.id)

            // Clean up positions for lots that became empty
            const sourceLotIdsAffected = Array.from(new Set(lots.filter(l => l.lot_items?.some(i => selectedItems[i.id])).map(l => l.id)));

            for (const lid of sourceLotIdsAffected) {
                const { count } = await supabase
                    .from('lot_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('lot_id', lid)

                if (count === 0) {
                    await supabase.from('positions').update({ lot_id: null }).eq('lot_id', lid)

                    // Add MERGED_TO reference to the source lot metadata
                    const { data: sLot } = await supabase.from('lots').select('metadata').eq('id', lid).single();
                    if (sLot) {
                        const sMeta = sLot.metadata ? { ...sLot.metadata as any } : {}
                        if (!sMeta.system_history) sMeta.system_history = {}
                        sMeta.system_history.merged_to = targetLot.code
                        await supabase.from('lots').update({
                            metadata: sMeta,
                            status: 'exported',
                            quantity: 0
                        }).eq('id', lid)
                    }
                }
            }

            onSuccess()
        } catch (e: any) {
            console.error(e)
            setError(e.message || 'Có lỗi xảy ra khi gộp')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Boxes size={20} className="text-emerald-500" />
                                Gộp vào LOT đích: <span className="text-emerald-600 dark:text-emerald-400">{targetLot.code}</span>
                            </h3>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium ml-7">Chọn LOT nguồn (hoặc dòng sản phẩm) để gộp</p>
                    </div>

                    {/* Search & Tabs */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm mã LOT, SKU, tên sản phẩm..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl gap-1">
                            <button
                                onClick={() => setFilterTab('unplaced')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${filterTab === 'unplaced' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <Inbox size={14} />
                                Lẻ / Chưa vị trí ({stats.unplaced})
                            </button>
                            <button
                                onClick={() => setFilterTab('placed')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${filterTab === 'placed' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <MapPin size={14} />
                                Đã có vị trí ({stats.placed})
                            </button>
                            <button
                                onClick={() => setFilterTab('starred')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${filterTab === 'starred' ? 'bg-white dark:bg-slate-700 text-amber-500 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <Star size={14} fill={filterTab === 'starred' ? 'currentColor' : 'none'} />
                                Quan trọng ({stats.starred})
                            </button>
                        </div>
                    </div>

                    {/* Source Lot List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {sourceLots.length > 0 ? (
                            sourceLots.map(lot => {
                                const isExpanded = expandedLots[lot.id]
                                const isAnySelected = lot.lot_items?.some(item => selectedItems[item.id] !== undefined)
                                const isAllSelected = lot.lot_items?.every(item => selectedItems[item.id] === item.quantity)

                                return (
                                    <div key={lot.id} className={`rounded-2xl border transition-all ${isAnySelected ? 'border-emerald-500 ring-1 ring-emerald-500/10' : 'border-slate-100 dark:border-slate-800'} overflow-hidden`}>
                                        <div
                                            className="p-4 bg-white dark:bg-slate-900 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            onClick={() => toggleExpand(lot.id)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{lot.code}</span>
                                                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                                </div>
                                                <div className="space-y-1">
                                                    {lot.lot_items?.slice(0, 2).map(item => (
                                                        <div key={item.id} className="flex items-center gap-2 text-xs text-slate-500">
                                                            <Boxes size={12} className="shrink-0" />
                                                            <span className="truncate">{item.products?.name}</span>
                                                        </div>
                                                    ))}
                                                    {(lot.lot_items?.length || 0) > 2 && <span className="text-[10px] text-slate-400 italic">+{lot.lot_items!.length - 2} sản phẩm khác</span>}
                                                </div>
                                                <div className="mt-3 flex items-center justify-between">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(() => {
                                                            const items = lot.lot_items || [];
                                                            const summary = items.reduce((acc: Record<string, number>, item: any) => {
                                                                const unit = (item as any).unit || item.products?.unit || 'Đơn vị';
                                                                acc[unit] = (acc[unit] || 0) + (item.quantity || 0);
                                                                return acc;
                                                            }, {});
                                                            return Object.entries(summary).map(([unit, total]) => (
                                                                <span key={unit} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                                                    TỔNG SL: {formatQuantityFull(total as number)} {unit}
                                                                </span>
                                                            ));
                                                        })()}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {lot.warehouse_name || 'Chi nhánh mặc định'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                                <div className="flex items-center justify-between px-1 mb-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Chi tiết sản phẩm</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleSelectLot(lot); }}
                                                        className={`text-[10px] font-bold uppercase transition-colors ${isAllSelected ? 'text-rose-500' : 'text-emerald-600'}`}
                                                    >
                                                        {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                                    </button>
                                                </div>
                                                {lot.lot_items?.map(item => (
                                                    <div key={item.id} className={`p-2 rounded-xl border transition-all flex items-center gap-3 ${selectedItems[item.id] !== undefined ? 'bg-white dark:bg-slate-800 border-emerald-200' : 'bg-transparent border-slate-200/50'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems[item.id] !== undefined}
                                                            onChange={(e) => {
                                                                if (e.target.checked) handleQuantityChange(item.id, item.quantity || 0, (item.quantity || 0))
                                                                else handleQuantityChange(item.id, item.quantity || 0, 0)
                                                            }}
                                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-bold truncate text-slate-700 dark:text-slate-300">{item.products?.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{item.products?.sku}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {selectedItems[item.id] !== undefined ? (
                                                                <QuantityInput
                                                                    value={selectedItems[item.id]}
                                                                    onChange={(val) => handleQuantityChange(item.id, item.quantity || 0, val)}
                                                                    className="w-20 p-1 text-xs font-bold text-center border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white"
                                                                />
                                                            ) : (
                                                                <span className="text-xs font-bold text-slate-400">{formatQuantityFull(item.quantity)}</span>
                                                            )}
                                                            <span className="text-[10px] font-bold text-slate-400">/{formatQuantityFull(item.quantity)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <PackageSearch size={48} className="mb-2 opacity-20" />
                                <p className="text-sm font-medium">Không tìm thấy Lot phù hợp</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="text-xs font-medium text-slate-500">
                            {Object.keys(selectedItems).length > 0 ? (
                                <span>Đã chọn <span className="text-emerald-600 font-bold">{Object.keys(selectedItems).length}</span> sản phẩm</span>
                            ) : (
                                <span>Chưa chọn LOT nguồn</span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">Hủy</button>
                            <button
                                onClick={handlePreSubmit}
                                disabled={loading || Object.keys(selectedItems).length === 0}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 transition-all active:scale-95"
                            >
                                {loading ? 'Đang gộp...' : (
                                    <>
                                        <Check size={18} />
                                        Gộp toàn bộ
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={showConfirm}
                title="Cảnh báo giải phóng vị trí"
                message="Có một hoặc nhiều Lot nguồn sẽ trống sau khi gộp. Các vị trí hiện tại của những Lot này sẽ được giải phóng. Bạn có chắc chắn muốn tiếp tục?"
                onConfirm={executeMerge}
                onCancel={() => setShowConfirm(false)}
                variant="warning"
            />

            {error && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] p-4 bg-red-600 text-white rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={16} /></button>
                </div>
            )}
        </>
    )
}

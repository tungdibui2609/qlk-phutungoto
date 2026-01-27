'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2, Warehouse, User, FileText, ArrowUpRight } from 'lucide-react'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { Unit, ProductUnit } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { lotService } from '@/services/warehouse/lotService'
import { parseQuantity, formatQuantityFull } from '@/lib/numberUtils'
import { QuantityInput } from '@/components/ui/QuantityInput'

interface LotExportModalProps {
    lot: Lot
    onClose: () => void
    onSuccess: () => void
    units: Unit[]
    productUnits: ProductUnit[]
}

export const LotExportModal: React.FC<LotExportModalProps> = ({ lot, onClose, onSuccess, units, productUnits }) => {
    const { systemType, currentSystem } = useSystem()
    const { showToast } = useToast()
    const { toBaseAmount, unitNameMap, conversionMap } = useUnitConversion()
    const [exportQuantities, setExportQuantities] = useState<Record<string, number>>({})
    const [exportUnits, setExportUnits] = useState<Record<string, string>>({})
    const [customerName, setCustomerName] = useState('')
    const [customers, setCustomers] = useState<any[]>([])
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // New state for selected item
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

    useEffect(() => {
        // Initialize with 0 quantities but correct units
        const initialQuantities: Record<string, number> = {}
        const initialUnits: Record<string, string> = {}

        lot.lot_items?.forEach(item => {
            initialQuantities[item.id] = 0 // Start with 0
            initialUnits[item.id] = item.unit || item.products?.unit || ''
        })

        setExportQuantities(initialQuantities)
        setExportUnits(initialUnits)

        // Auto-select if only one item
        if (lot.lot_items && lot.lot_items.length === 1) {
            setSelectedItemId(lot.lot_items[0].id)
        }

        fetchCustomers()
    }, [lot, systemType])

    async function fetchCustomers() {
        if (!systemType) return
        const { data } = await supabase
            .from('customers')
            .select('id, name, address, phone')
            .eq('system_code', systemType)
            .order('name')

        if (data) setCustomers(data)
    }

    const handleCustomerChange = (val: string) => {
        setCustomerName(val)
        // Filter always
        const filtered = customers.filter(c =>
            c.name.toLowerCase().includes(val.toLowerCase())
        )
        setSuggestions(filtered)
        setShowSuggestions(true)
    }

    const handleCustomerFocus = () => {
        // Show all if empty, or filter if has value
        if (!customerName.trim()) {
            setSuggestions(customers)
        } else {
            const filtered = customers.filter(c =>
                c.name.toLowerCase().includes(customerName.toLowerCase())
            )
            setSuggestions(filtered)
        }
        setShowSuggestions(true)
    }

    const selectCustomer = (customer: any) => {
        setCustomerName(customer.name)
        setShowSuggestions(false)
    }

    const getConsumedOriginalQty = (itemId: string, selectedQty: number, selectedUnit: string) => {
        const item = lot.lot_items?.find(i => i.id === itemId)
        if (!item || !item.product_id) return selectedQty

        const baseUnit = item.products?.unit || ''
        const originalUnit = item.unit || baseUnit

        const baseQty = toBaseAmount(item.product_id, selectedUnit, selectedQty, baseUnit)

        const originalUnitId = unitNameMap.get(originalUnit.toLowerCase())
        if (!originalUnitId) return baseQty

        const productRates = conversionMap.get(item.product_id)
        const rate = productRates?.get(originalUnitId)
        if (!rate) return baseQty

        return baseQty / rate
    }

    const handleQuantityChange = (itemId: string, value: number) => {
        setExportQuantities(prev => ({
            ...prev,
            [itemId]: value
        }))
    }

    const handleUnitChange = (itemId: string, unitName: string) => {
        setExportUnits(prev => ({ ...prev, [itemId]: unitName }))
    }

    const handleExport = async () => {
        const itemsToExport = Object.entries(exportQuantities).filter(([_, qty]) => qty > 0)
        if (itemsToExport.length === 0) {
            setError('Vui lòng nhập số lượng muốn xuất cho ít nhất 1 sản phẩm')
            return
        }
        // Customer name is optional now
        /* if (!customerName.trim()) {
            setError('Vui lòng nhập tên khách hàng')
            return
        } */

        setLoading(true)
        setError(null)

        try {
            // Process Items & Update LOT
            const exportItemsData: Record<string, any> = {}

            for (const item of lot.lot_items || []) {
                const selectedQty = exportQuantities[item.id] || 0
                const selectedUnit = exportUnits[item.id] || item.unit || item.products?.unit || ''

                const consumedQty = getConsumedOriginalQty(item.id, selectedQty, selectedUnit)
                // const remainingQty = (item.quantity || 0) - consumedQty // Not used locally

                if (selectedQty > 0) {
                    // 1. Track for history buffer
                    exportItemsData[item.id] = {
                        product_id: item.product_id,
                        product_sku: item.products?.sku,
                        product_name: item.products?.name,
                        exported_quantity: selectedQty,
                        unit: selectedUnit,
                        cost_price: item.products?.cost_price || 0
                    }

                    // 2. Process Auto-Split logic via lotService
                    await lotService.processItemAutoSplit({
                        supabase,
                        lotId: lot.id,
                        item,
                        consumedOriginalQty: consumedQty,
                        unitNameMap,
                        conversionMap,
                        preferredUnit: selectedUnit // Pass the unit user selected
                    })
                }
            }

            // 3. Calculate Final Total Remaining Qty from DB to be 100% accurate
            const totalRemainingLotQty = await lotService.calculateTotalBaseQty({
                supabase,
                lotId: lot.id,
                unitNameMap,
                conversionMap
            })

            // 4. Update Metadata & Final Lot Status
            const newMetadata = await lotService.addExportToHistory({
                supabase,
                lotId: lot.id,
                originalMetadata: lot.metadata,
                exportData: {
                    id: crypto.randomUUID(),
                    customer: customerName || 'Khách lẻ', // Default if empty
                    description: description,
                    location_code: lot.positions?.[0]?.code || null,
                    items: exportItemsData
                }
            })

            // Final Update to LOT
            await supabase.from('lots').update({
                quantity: totalRemainingLotQty,
                metadata: newMetadata,
                status: totalRemainingLotQty <= 0.000001 ? 'exported' : lot.status
            }).eq('id', lot.id)

            // Map Cleanup: If lot is empty, clear from positions
            if (totalRemainingLotQty === 0) {
                await supabase.from('positions').update({ lot_id: null }).eq('lot_id', lot.id)
            }

            showToast('Đã thêm vào hàng chờ xuất kho', 'success')
            onSuccess()
        } catch (e: any) {
            console.error('Export error:', e)
            setError(e.message || 'Có lỗi xảy ra khi xuất LOT')
        } finally {
            setLoading(false)
        }
    }

    const selectedItem = lot.lot_items?.find(i => i.id === selectedItemId)
    const isMultiProduct = (lot.lot_items?.length || 0) > 1

    const NOTE_SUGGESTIONS = ['Bán hàng', 'Xuất sản xuất', 'Phân loại', 'Xuất hủy', 'Điều chuyển']

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-start justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <ArrowUpRight size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Xuất LOT
                            </h3>
                            <p className="text-sm font-medium mt-1">
                                Mã LOT: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{lot.code}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                <div className="px-6 py-2 border-t border-slate-100 dark:border-slate-800 flex-1 overflow-y-auto custom-scrollbar">
                    {/* Customer & Info */}
                    <div className="mt-4 space-y-4 mb-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                <User size={12} />
                                Khách hàng / Nơi nhận
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => handleCustomerChange(e.target.value)}
                                    onClick={handleCustomerFocus}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    onFocus={handleCustomerFocus}
                                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium"
                                    placeholder="Nhập tên khách hàng hoặc bộ phận nhận..."
                                />

                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-2">
                                            {suggestions.map((customer) => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    onClick={() => selectCustomer(customer)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                        <User size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-slate-100">{customer.name}</div>
                                                        {customer.phone && <div className="text-[10px] text-slate-500">{customer.phone}</div>}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                <FileText size={12} />
                                Ghi chú xuất kho
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium min-h-[60px] resize-none"
                                placeholder="Lý do xuất, ghi chú vận chuyển..."
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                                {NOTE_SUGGESTIONS.map(note => (
                                    <button
                                        key={note}
                                        onClick={() => setDescription(note)}
                                        className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                                    >
                                        {note}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product Selection for Multi-Product Lots */}
                    {isMultiProduct && (
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-2 block">
                                Chọn sản phẩm cần xuất
                            </label>
                            <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar p-1">
                                {lot.lot_items?.map(item => {
                                    const isSelected = selectedItemId === item.id
                                    const qty = exportQuantities[item.id] || 0

                                    // Get tags for this item
                                    const itemTags = lot.lot_tags?.filter(t => t.lot_item_id === item.id) || []

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedItemId(item.id)}
                                            className={`
                                                p-3 rounded-xl border cursor-pointer transition-all gap-3 relative
                                                ${isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500'
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                                                }
                                            `}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                                            {item.products?.sku}
                                                        </span>
                                                        {itemTags.length > 0 && (
                                                            <div className="flex items-center gap-1">
                                                                {itemTags.map((t, idx) => (
                                                                    <span key={idx} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                                        {t.tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                                        {item.products?.name}
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                        {formatQuantityFull(item.quantity)}
                                                        <span className="text-[10px] font-normal text-slate-500 ml-1">{(item as any).unit || item.products?.unit}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {qty > 0 && (
                                                <div className="mt-2 pt-2 border-t border-dashed border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Đang xuất:</span>
                                                    <div className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                                        {formatQuantityFull(qty)} {exportUnits[item.id]}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Quantity Input Section - Only visible if item selected */}
                    {selectedItem ? (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-slate-400 font-bold uppercase mb-1">Sản phẩm đang chọn</div>
                                    <div className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                                        {selectedItem.products?.sku}
                                    </div>
                                    <div className="text-sm text-slate-500 line-clamp-2">
                                        {selectedItem.products?.name}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xs text-slate-400 font-bold uppercase mb-1">Hiện có</div>
                                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatQuantityFull(selectedItem.quantity)}
                                        <span className="text-sm ml-1 text-slate-500">{(selectedItem as any).unit || selectedItem.products?.unit}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                    Nhập số lượng xuất
                                </label>
                                <div className="flex items-center gap-3">
                                    <QuantityInput
                                        value={exportQuantities[selectedItem.id] || ''}
                                        onChange={(val) => handleQuantityChange(selectedItem.id, val)}
                                        className="flex-1 p-3 text-lg font-bold text-center border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white dark:bg-slate-900 transition-all font-mono"
                                        placeholder="0"
                                        autoFocus
                                    />
                                    <select
                                        value={exportUnits[selectedItem.id] || ''}
                                        onChange={(e) => handleUnitChange(selectedItem.id, e.target.value)}
                                        className="w-24 p-3 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white dark:bg-slate-900 transition-all cursor-pointer"
                                    >
                                        {[
                                            selectedItem.products?.unit,
                                            ...productUnits
                                                .filter(pu => pu.product_id === selectedItem.product_id)
                                                .map(pu => units.find(u => u.id === pu.unit_id)?.name)
                                        ]
                                            .filter(Boolean)
                                            .filter((v, i, a) => a.indexOf(v) === i)
                                            .map(uName => (
                                                <option key={uName} value={uName!}>{uName}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                {/* Preview & Validation Section */}
                                {(() => {
                                    const selectedQty = exportQuantities[selectedItem.id] || 0
                                    if (selectedQty <= 0) return null

                                    const consumed = getConsumedOriginalQty(selectedItem.id, selectedQty, exportUnits[selectedItem.id] || '')
                                    const isOver = consumed > (selectedItem.quantity || 0) + 0.000001

                                    const splitResult = lotService.calculateSplitResult({
                                        item: selectedItem,
                                        consumedOriginalQty: consumed,
                                        unitNameMap,
                                        conversionMap,
                                        preferredUnit: exportUnits[selectedItem.id]
                                    })

                                    return (
                                        <div className="mt-3 flex flex-col items-end gap-1.5 px-1 animate-in fade-in slide-in-from-top-1">
                                            {consumed > 0 && Math.abs(consumed - selectedQty) > 0.000001 && (
                                                <div className={`text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 ${isOver ? 'text-red-500' : 'text-slate-500'}`}>
                                                    {isOver ? (
                                                        <>
                                                            <AlertCircle size={14} />
                                                            <span>Vượt quá tồn kho! (~ {formatQuantityFull(consumed)} {selectedItem.unit || selectedItem.products?.unit} gốc)</span>
                                                        </>
                                                    ) : (
                                                        <span>Tương đương: {formatQuantityFull(consumed)} {selectedItem.unit || selectedItem.products?.unit} (gốc)</span>
                                                    )}
                                                </div>
                                            )}
                                            {splitResult && !isOver && (
                                                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                                                    Còn lại dự kiến: <span className="text-emerald-700 dark:text-emerald-300 underline underline-offset-2 decoration-emerald-500/30">{splitResult.displayLabel}</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <ArrowUpRight size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium">Vui lòng chọn sản phẩm để nhập số lượng</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 flex items-center justify-end gap-3 mt-auto bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={loading || Object.values(exportQuantities).every(v => v === 0)}
                        className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Xác nhận xuất LOT
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] p-4 bg-red-600 text-white rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={16} /></button>
                </div>
            )}
        </div>
    )
}

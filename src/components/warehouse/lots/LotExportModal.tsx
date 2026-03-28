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
    isUtilityEnabled?: (utilityId: string) => boolean
}

export const LotExportModal: React.FC<LotExportModalProps> = ({ lot, onClose, onSuccess, units, productUnits, isUtilityEnabled }) => {
    const { systemType, currentSystem, hasModule } = useSystem()
    const showInternal = hasModule('internal_products')
    const { showToast } = useToast()
    const { getBaseAmount: toBaseAmount, unitNameMap, conversionMap } = useUnitConversion()
    const [exportQuantities, setExportQuantities] = useState<Record<string, number>>({})
    const [exportUnits, setExportUnits] = useState<Record<string, string>>({})
    const [customerName, setCustomerName] = useState('')
    const [customers, setCustomers] = useState<any[]>([])
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [productionOrders, setProductionOrders] = useState<any[]>([])
    const [selectedProductionId, setSelectedProductionId] = useState<string | null>(null)
    const [productionSearch, setProductionSearch] = useState('')
    const [showProductionSuggestions, setShowProductionSuggestions] = useState(false)
    const [exportAll, setExportAll] = useState<Record<string, boolean>>({})
    const [autoExportAll, setAutoExportAll] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('lot_auto_export_all') === 'true'
        }
        return false
    })

    useEffect(() => {
        // Initialize with 0 quantities but correct units
        const initialQuantities: Record<string, number> = {}
        const initialUnits: Record<string, string> = {}

        lot.lot_items?.forEach((item: any) => {
            initialQuantities[item.id] = 0 // Start with 0
            
            // Logic: Pick "Thùng" unit defined for product if it exists
            const baseUnit = item.unit || item.products?.unit || ''
            const availableUnits = [
                baseUnit,
                ...productUnits
                    .filter((pu: any) => pu.product_id === item.product_id)
                    .map((pu: any) => units.find((u: any) => u.id === pu.unit_id)?.name)
            ].filter(Boolean) as string[]

            const thungUnit = availableUnits
                .sort((a, b) => {
                    const aHasExtra = a.includes('(') ? 1 : 0
                    const bHasExtra = b.includes('(') ? 1 : 0
                    return bHasExtra - aHasExtra // Prioritize unit with (
                })
                .find((u: any) => 
                    u.toLowerCase().normalize('NFC').includes('thùng')
                )

            initialUnits[item.id] = thungUnit || baseUnit
        })

        setExportQuantities(initialQuantities)
        setExportUnits(initialUnits)

        // Auto export all if enabled
        if (autoExportAll) {
            const allExportAll: Record<string, boolean> = {}
            const maxQuantities: Record<string, number> = {}
            lot.lot_items?.forEach((item: any) => {
                allExportAll[item.id] = true
                maxQuantities[item.id] = item.quantity || 0
            })
            setExportAll(allExportAll)
            setExportQuantities(maxQuantities)
        }
        fetchCustomers()
        fetchProductions()
    }, [lot, systemType, units, productUnits])

    async function fetchProductions() {
        if (!currentSystem) return
        const { data } = await supabase
            .from('productions')
            .select('id, code, name')
            .eq('target_system_code', currentSystem?.code)
            .in('status', ['IN_PROGRESS', 'PLANNED'])
            .order('created_at', { ascending: false })
        if (data) setProductionOrders(data)
    }

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
        const item = lot.lot_items?.find((i: any) => i.id === itemId)
        if (!item || !item.product_id) return selectedQty

        const baseUnit = item.products?.unit || ''
        const originalUnit = item.unit || baseUnit

        // PRIORITY 1: Parse from names
        const pRateSelected = lotService.parseRateFromName(selectedUnit)
        const pRateOriginal = lotService.parseRateFromName(originalUnit)

        if (pRateSelected !== null && pRateOriginal !== null) {
            return (selectedQty * pRateSelected) / pRateOriginal
        }

        // PRIORITY 2: Use toBaseAmount logic
        const baseQty = toBaseAmount(item.product_id, selectedUnit, selectedQty, baseUnit)

        let originalRate = 1
        const pRateOrigFallback = lotService.parseRateFromName(originalUnit)

        if (pRateOrigFallback !== null) {
            originalRate = pRateOrigFallback
        } else {
            const originalUnitId = unitNameMap.get(originalUnit.toLowerCase())
            if (originalUnitId) {
                const productRates = conversionMap.get(item.product_id)
                originalRate = productRates?.get(originalUnitId) || 1
            }
        }

        return baseQty / originalRate
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

        setLoading(true)
        setError(null)

        try {
            // Process Items & Update LOT
            const exportItemsData: Record<string, any> = {}
            const productionInputs: any[] = []

            for (const item of lot.lot_items || []) {
                const selectedQty = exportQuantities[item.id] || 0
                const selectedUnit = exportUnits[item.id] || item.unit || item.products?.unit || ''

                const consumedQty = getConsumedOriginalQty(item.id, selectedQty, selectedUnit)
                
                // Calculate Weight in KG for production analysis
                const baseUnit = item.products?.unit || ''
                const weightKg = toBaseAmount(item.product_id, selectedUnit, selectedQty, baseUnit)

                if (selectedQty > 0) {
                    // 1. Track for history buffer
                    exportItemsData[item.id] = {
                        product_id: item.product_id,
                        product_sku: item.products?.sku,
                        product_name: item.products?.name,
                        exported_quantity: selectedQty,
                        unit: selectedUnit,
                        cost_price: item.products?.cost_price || 0,
                        production_id: selectedProductionId
                    }

                    // 2. Prepare Production Inputs if linked
                    if (selectedProductionId) {
                        productionInputs.push({
                            production_id: selectedProductionId,
                            lot_id: lot.id,
                            lot_item_id: item.id,
                            product_id: item.product_id,
                            quantity: selectedQty,
                            unit: selectedUnit,
                            weight_kg: weightKg,
                            system_code: currentSystem
                        })
                    }

                    // 3. Process Auto-Split logic via lotService
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

            // Save Production Inputs
            if (productionInputs.length > 0) {
                const { error: piError } = await (supabase as any).from('production_inputs').insert(productionInputs)
                if (piError) throw piError
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
            await (supabase.from('lots') as any).update({
                quantity: totalRemainingLotQty,
                metadata: newMetadata,
                status: totalRemainingLotQty <= 0.000001 ? 'exported' : lot.status
            }).eq('id', lot.id)

            // Map Cleanup: If lot is empty, clear from positions
            if (totalRemainingLotQty <= 0.000001) {
                await (supabase.from('positions') as any).update({ lot_id: null }).eq('lot_id', lot.id)
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
                    {/* Product Selection - Same design as Split Modal */}
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Chọn dòng sản phẩm muốn xuất
                            </h4>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={autoExportAll}
                                    onChange={(e) => {
                                        const checked = e.target.checked
                                        setAutoExportAll(checked)
                                        localStorage.setItem('lot_auto_export_all', checked ? 'true' : 'false')
                                        if (checked) {
                                            // Apply immediately
                                            const allExportAll: Record<string, boolean> = {}
                                            const maxQuantities: Record<string, number> = {}
                                            lot.lot_items?.forEach((item: any) => {
                                                allExportAll[item.id] = true
                                                maxQuantities[item.id] = item.quantity || 0
                                            })
                                            setExportAll(allExportAll)
                                            setExportQuantities(maxQuantities)
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/20"
                                />
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
                                    Tự động xuất hết<br /><span className="text-[10px] opacity-70">(cho lần sau)</span>
                                </span>
                            </label>
                        </div>

                        <div className="space-y-3">
                            {lot.lot_items?.map((item: any) => (
                                <div key={item.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-emerald-500/50 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                                {showInternal && item.products?.internal_code ? item.products.internal_code : item.products?.sku}
                                            </div>
                                            <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                                {showInternal && item.products?.internal_name ? item.products.internal_name : item.products?.name}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                {formatQuantityFull(item.quantity)} {(item as any).unit || item.products?.unit}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Xuất:</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const isCurrentlyAll = exportAll[item.id]
                                                    if (isCurrentlyAll) {
                                                        // Turn off - reset to 0
                                                        setExportAll(prev => ({ ...prev, [item.id]: false }))
                                                        handleQuantityChange(item.id, 0)
                                                    } else {
                                                        // Turn on - set to max
                                                        setExportAll(prev => ({ ...prev, [item.id]: true }))
                                                        handleQuantityChange(item.id, item.quantity || 0)
                                                    }
                                                }}
                                                className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors ${exportAll[item.id]
                                                    ? 'text-white bg-emerald-500 border-emerald-500 hover:bg-emerald-600'
                                                    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800'
                                                    }`}
                                            >
                                                {exportAll[item.id] ? '✓ Xuất hết' : 'Xuất hết'}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <QuantityInput
                                                value={exportQuantities[item.id] || ''}
                                                onChange={(val) => handleQuantityChange(item.id, val)}
                                                className="w-24 p-2 text-sm font-bold text-center border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-900 transition-all font-mono"
                                                placeholder="0"
                                            />
                                            {isUtilityEnabled?.('auto_unbundle_lot') ? (
                                                <select
                                                    value={exportUnits[item.id] || ''}
                                                    onChange={(e) => handleUnitChange(item.id, e.target.value)}
                                                    className="p-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-900 transition-all cursor-pointer"
                                                >
                                                    {(() => {
                                                        const rawUnits = [
                                                            item.products?.unit,
                                                            (item as any).unit,
                                                            exportUnits[item.id],
                                                            ...productUnits
                                                                .filter(pu => pu.product_id === item.product_id)
                                                                .map(pu => units.find(u => u.id === pu.unit_id)?.name)
                                                        ].filter(Boolean) as string[]

                                                        const uniqueUnits = Array.from(new Set(rawUnits))
                                                        
                                                        // Filter Logic: If has "Thùng (...", remove plain "Thùng"
                                                        const hasSpecificThung = uniqueUnits.some(u => u.toLowerCase().includes('thùng ('))
                                                        
                                                        return uniqueUnits
                                                            .filter(u => {
                                                                if (hasSpecificThung && u.toLowerCase().trim() === 'thùng') return false
                                                                return true
                                                            })
                                                            .map(uName => (
                                                                <option key={uName} value={uName}>{uName}</option>
                                                            ))
                                                    })()}
                                                </select>
                                            ) : (
                                                <span className="p-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500">
                                                    {(item as any).unit || item.products?.unit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {(() => {
                                        const selectedQty = exportQuantities[item.id] || 0
                                        if (selectedQty <= 0) return null

                                        const consumed = getConsumedOriginalQty(item.id, selectedQty, exportUnits[item.id] || '')
                                        const isOver = consumed > (item.quantity || 0) + 0.000001

                                        const splitResult = lotService.calculateSplitResult({
                                            item,
                                            consumedOriginalQty: consumed,
                                            unitNameMap,
                                            conversionMap,
                                            preferredUnit: exportUnits[item.id]
                                        })

                                        return (
                                            <div className="mt-2 flex flex-col items-end gap-1.5 px-1">
                                                {consumed > 0 && Math.abs(consumed - selectedQty) > 0.000001 && (
                                                    <div className={`text-[10px] font-bold ${isOver ? 'text-red-500' : 'text-slate-400'}`}>
                                                        {isOver ? (
                                                            <span>Vượt quá tồn kho! (~ {formatQuantityFull(consumed)} {item.unit || item.products?.unit} gốc)</span>
                                                        ) : (
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span>Tương đương: {formatQuantityFull(consumed)} {item.unit || item.products?.unit} (gốc)</span>
                                                                {!unitNameMap.has((item.unit || item.products?.unit || '').toLowerCase()) && (
                                                                    <span className="text-orange-500 flex items-center gap-1">
                                                                        <AlertCircle size={10} />
                                                                        Đơn vị "{item.unit || item.products?.unit}" cũ, tự động khớp mờ
                                                                    </span>
                                                                )}
                                                                {!unitNameMap.has((exportUnits[item.id] || '').toLowerCase()) && (
                                                                    <span className="text-orange-500 flex items-center gap-1">
                                                                        <AlertCircle size={10} />
                                                                        Đơn vị xuất "{exportUnits[item.id]}" tự động khớp mờ
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {splitResult && !isOver && (
                                                    <div className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                        Còn lại dự kiến: <span className="text-emerald-700 dark:text-emerald-300 underline underline-offset-2 decoration-emerald-500/30">{splitResult.displayLabel}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 px-1 flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                            {(() => {
                                const items = lot.lot_items || [];
                                const summary = items.reduce((acc: Record<string, number>, item: any) => {
                                    const unit = (item as any).unit || item.products?.unit || 'Đơn vị';
                                    acc[unit] = (acc[unit] || 0) + (item.quantity || 0);
                                    return acc;
                                }, {});
                                return Object.entries(summary).map(([unit, total]) => (
                                    <span key={unit} className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-lg border border-orange-100 dark:border-orange-900/10">
                                        TỔNG SL GỐC: {formatQuantityFull(total as number)} {unit}
                                    </span>
                                ));
                            })()}
                        </div>
                        {Object.values(exportQuantities).some(v => v > 0) && (
                            <div className="flex flex-wrap gap-1 justify-end">
                                {(() => {
                                    const items = lot.lot_items || [];
                                    const summary = items.reduce((acc: Record<string, number>, item: any) => {
                                        const qty = exportQuantities[item.id] || 0
                                        if (qty === 0) return acc
                                        const unit = exportUnits[item.id] || (item as any).unit || item.products?.unit || 'Đơn vị';
                                        acc[unit] = (acc[unit] || 0) + qty;
                                        return acc;
                                    }, {});
                                    return Object.entries(summary).map(([unit, total]) => (
                                        <span key={unit} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                            XUẤT RA: {formatQuantityFull(total as number)} {unit}
                                        </span>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Customer & Info - Moved below product selection */}
                    <div className="mt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                    <ArrowUpRight size={12} className="text-orange-500" />
                                    Lệnh sản xuất liên kết
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={productionSearch}
                                        onChange={(e) => {
                                            setProductionSearch(e.target.value)
                                            setShowProductionSuggestions(true)
                                            if (!e.target.value) setSelectedProductionId(null)
                                        }}
                                        onFocus={() => setShowProductionSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowProductionSuggestions(false), 200)}
                                        className="w-full p-3 rounded-2xl bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200/50 dark:border-orange-800/30 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-medium text-sm placeholder:text-orange-900/30 dark:placeholder:text-orange-400/30"
                                        placeholder="Chọn lệnh sản xuất (nếu có)..."
                                    />
                                    {showProductionSuggestions && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto w-[120%] -left-[10%] backdrop-blur-xl">
                                            <div className="p-2">
                                                {productionOrders.filter(p => 
                                                    p.code.toLowerCase().includes(productionSearch.toLowerCase()) || 
                                                    p.name.toLowerCase().includes(productionSearch.toLowerCase())
                                                ).map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedProductionId(p.id)
                                                            setProductionSearch(`${p.code} - ${p.name}`)
                                                            setShowProductionSuggestions(false)
                                                            // Optional: Set description to "Xuất sản xuất"
                                                            if (!description) setDescription('Xuất sản xuất')
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors group ${selectedProductionId === p.id ? 'bg-orange-500 text-white' : 'hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedProductionId === p.id ? 'bg-white/20' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'}`}>
                                                            <FileText size={16} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`font-bold truncate ${selectedProductionId === p.id ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{p.code}</div>
                                                            <div className={`text-[10px] truncate ${selectedProductionId === p.id ? 'text-orange-100' : 'text-slate-500'}`}>{p.name}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                                {productionOrders.length === 0 && (
                                                    <div className="p-4 text-center text-xs text-slate-400">Không có lệnh sản xuất nào đang chạy</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

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
                                        className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-sm"
                                        placeholder="Nhập tên khách hàng..."
                                    />

                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto backdrop-blur-xl">
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
                </div>

                {/* Footer */}
                {(() => {
                    const isAnyOverLimit = (lot.lot_items || []).some((item: any) => {
                        const selectedQty = exportQuantities[item.id] || 0
                        if (selectedQty <= 0) return false
                        const consumed = getConsumedOriginalQty(item.id, selectedQty, exportUnits[item.id] || '')
                        return consumed > (item.quantity || 0) + 0.000001
                    })

                    return (
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
                                disabled={loading || Object.values(exportQuantities).every(v => v === 0) || isAnyOverLimit}
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
                    )
                })()}
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

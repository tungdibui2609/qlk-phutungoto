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

    useEffect(() => {
        // Initialize with full quantities and current units
        const initialQuantities: Record<string, number> = {}
        const initialUnits: Record<string, string> = {}
        lot.lot_items?.forEach(item => {
            initialQuantities[item.id] = item.quantity || 0
            initialUnits[item.id] = item.unit || item.products?.unit || ''
        })
        setExportQuantities(initialQuantities)
        setExportUnits(initialUnits)
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
        if (val.trim()) {
            const filtered = customers.filter(c =>
                c.name.toLowerCase().includes(val.toLowerCase())
            )
            setSuggestions(filtered)
            setShowSuggestions(true)
        } else {
            setSuggestions([])
            setShowSuggestions(false)
        }
    }

    const selectCustomer = (customer: any) => {
        setCustomerName(customer.name)
        setShowSuggestions(false)
        // You could also auto-fill description if needed, or other fields
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

    const handleExportAll = () => {
        const fullQuantities: Record<string, number> = {}
        lot.lot_items?.forEach(item => {
            fullQuantities[item.id] = item.quantity || 0
        })
        setExportQuantities(fullQuantities)
    }

    const generateOrderCode = async () => {
        const today = new Date()
        const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`

        // Get initials from system name
        let prefix = 'PXK'
        if (currentSystem?.name) {
            const cleanName = currentSystem.name.replace(/^Kho\s+/i, '').trim()
            prefix = cleanName.split(/\s+/).map(word => word[0]).join('').toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
            prefix = `${prefix}-PXK`
        }

        const { data } = await supabase
            .from('outbound_orders')
            .select('code')
            .ilike('code', `${prefix}-${dateStr}-%`)
            .order('code', { ascending: false })
            .limit(1)

        let sequence = 1
        if (data && data.length > 0) {
            const lastCode = data[0].code
            const lastSeq = parseInt(lastCode.split('-').pop() || '0')
            if (!isNaN(lastSeq)) sequence = lastSeq + 1
        }

        return `${prefix}-${dateStr}-${String(sequence).padStart(3, '0')}`
    }

    const handleExport = async () => {
        const itemsToExport = Object.entries(exportQuantities).filter(([_, qty]) => qty > 0)
        if (itemsToExport.length === 0) {
            setError('Vui lòng nhập số lượng muốn xuất cho ít nhất 1 sản phẩm')
            return
        }
        if (!customerName.trim()) {
            setError('Vui lòng nhập tên khách hàng')
            return
        }

        setLoading(true)
        setError(null)

        try {
            // Process Items & Update LOT
            const exportItemsData: Record<string, any> = {}

            for (const item of lot.lot_items || []) {
                const selectedQty = exportQuantities[item.id] || 0
                const selectedUnit = exportUnits[item.id] || item.unit || item.products?.unit || ''

                const consumedQty = getConsumedOriginalQty(item.id, selectedQty, selectedUnit)
                const remainingQty = (item.quantity || 0) - consumedQty

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
                        conversionMap
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
                    customer: customerName,
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-start justify-between">
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
                    <div className="mt-4 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                <User size={12} />
                                Khách hàng / Nơi nhận <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => handleCustomerChange(e.target.value)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    onFocus={() => customerName.trim() && setShowSuggestions(true)}
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
                                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium min-h-[80px] resize-none"
                                placeholder="Lý do xuất, ghi chú vận chuyển..."
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Chi tiết sản phẩm xuất
                            </h4>
                            <button
                                onClick={handleExportAll}
                                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                            >
                                XUẤT TẤT CẢ
                            </button>
                        </div>

                        <div className="space-y-3">
                            {lot.lot_items?.map(item => (
                                <div key={item.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-emerald-500/50 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                                {item.products?.sku}
                                            </div>
                                            <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                                {item.products?.name}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs text-slate-400 font-bold uppercase mb-1">Hiện có</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                {formatQuantityFull(item.quantity)} {(item as any).unit || item.products?.unit}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Số lượng xuất:</span>
                                        <div className="flex items-center gap-2">
                                            <QuantityInput
                                                value={exportQuantities[item.id] || ''}
                                                onChange={(val) => handleQuantityChange(item.id, val)}
                                                className="w-24 p-2 text-sm font-bold text-center border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-900 transition-all font-mono"
                                                placeholder="0"
                                            />
                                            <select
                                                value={exportUnits[item.id] || ''}
                                                onChange={(e) => handleUnitChange(item.id, e.target.value)}
                                                className="p-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-900 transition-all cursor-pointer"
                                            >
                                                {[
                                                    item.products?.unit,
                                                    ...productUnits
                                                        .filter(pu => pu.product_id === item.product_id)
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
                                    </div>
                                    {(() => {
                                        const selectedQty = exportQuantities[item.id] || 0
                                        const consumed = getConsumedOriginalQty(item.id, selectedQty, exportUnits[item.id] || '')
                                        const isOver = consumed > (item.quantity || 0) + 0.000001
                                        if (consumed > 0 && Math.abs(consumed - selectedQty) > 0.0001) {
                                            return (
                                                <div className={`mt-2 text-[10px] font-bold text-right ${isOver ? 'text-red-500' : 'text-slate-400'}`}>
                                                    ~ {formatQuantityFull(consumed)} {(item as any).unit || item.products?.unit} (gốc)
                                                    {isOver && ' - Vượt quá tồn kho!'}
                                                </div>
                                            )
                                        }
                                        return null
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            <span className="font-bold">Lưu ý:</span> Khi xác nhận xuất kho:
                        </p>
                        <ul className="mt-2 space-y-1 list-disc pl-5 text-[11px] text-blue-600 dark:text-blue-400">
                            <li>Hệ thống sẽ tạo **Phiếu Xuất Kho** tự động để ghi nhận tồn kho tổng.</li>
                            <li>Ghi lại lịch sử xuất trong nhật ký LOT.</li>
                            <li>Nếu xuất hết, LOT sẽ được gỡ khỏi vị trí trên **Sơ đồ kho**.</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 flex items-center justify-end gap-3 mt-auto">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={loading || Object.values(exportQuantities).every(v => v === 0) || !customerName.trim()}
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

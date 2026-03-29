'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2, User, FileText, PackageMinus } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { lotService } from '@/services/warehouse/lotService'
import { formatQuantityFull } from '@/lib/numberUtils'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { logActivity } from '@/lib/audit'

interface QuickBulkExportModalProps {
    lotIds: string[]
    lotInfo: Record<string, {
        code: string,
        items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>,
        positions?: { code: string }[]
    }>
    onClose: () => void
    onSuccess: () => void
}

export const QuickBulkExportModal: React.FC<QuickBulkExportModalProps> = ({ lotIds, lotInfo, onClose, onSuccess }) => {
    const { systemType, currentSystem } = useSystem()
    const { showToast } = useToast()
    const { getBaseAmount: toBaseAmount, unitNameMap, conversionMap } = useUnitConversion()

    const [customerName, setCustomerName] = useState('')
    const [customers, setCustomers] = useState<any[]>([])
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [description, setDescription] = useState('Xuất kho nhanh (Sơ đồ)')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [productionOrders, setProductionOrders] = useState<any[]>([])
    const [selectedProductionId, setSelectedProductionId] = useState<string | null>(null)
    const [productionSearch, setProductionSearch] = useState('')
    const [showProductionSuggestions, setShowProductionSuggestions] = useState(false)

    // Aggregate items for display
    const aggregatedDisplayItems = React.useMemo(() => {
        const groups: Record<string, { sku: string, name: string, unit: string, totalQty: number }> = {}
        lotIds.forEach(id => {
            const info = lotInfo[id]
            if (!info) return
            info.items.forEach(item => {
                const key = `${item.sku}|${item.product_name}|${item.unit}`
                if (!groups[key]) {
                    groups[key] = { sku: item.sku, name: item.product_name, unit: item.unit, totalQty: 0 }
                }
                groups[key].totalQty += item.quantity
            })
        })
        return Object.values(groups)
    }, [lotIds, lotInfo])

    useEffect(() => {
        if (systemType) {
            fetchCustomers()
        }
    }, [systemType])

    useEffect(() => {
        if (currentSystem) {
            fetchProductions()
        }
    }, [currentSystem])

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

    const handleBulkExport = async () => {
        setLoading(true)
        setError(null)

        try {
            const allProductionInputs: any[] = []

            // Process each LOT one by one
            for (const lotId of lotIds) {
                // 1. Fetch current LOT state to ensure we have latest data (in case of concurrent changes)
                const { data: lotData, error: fetchError } = await supabase
                    .from('lots')
                    .select('*, lot_items(*, products(sku, name, unit, cost_price)), positions!positions_lot_id_fkey(code)')
                    .eq('id', lotId)
                    .single()

                if (fetchError || !lotData) throw new Error(`Không thấy dữ liệu cho LOT ${lotId}`)
                
                // Assert type to any to avoid "never" type errors in this specific context
                const lot = lotData as any;

                const exportItemsData: Record<string, any> = {}
                const lotItems = lot.lot_items || []

                // 2. Prepare export history data & Production inputs
                lotItems.forEach((item: any) => {
                    const baseUnit = item.products?.unit || ''
                    const selectedUnit = item.unit || baseUnit
                    const weightKg = toBaseAmount(item.product_id, selectedUnit, item.quantity, baseUnit)

                    exportItemsData[item.id] = {
                        product_id: item.product_id,
                        product_sku: item.products?.sku,
                        product_name: item.products?.name,
                        exported_quantity: item.quantity,
                        unit: selectedUnit,
                        cost_price: item.products?.cost_price || 0,
                        production_id: selectedProductionId
                    }

                    if (selectedProductionId) {
                        allProductionInputs.push({
                            production_id: selectedProductionId,
                            lot_id: lot.id,
                            lot_item_id: item.id,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            unit: selectedUnit,
                            weight_kg: weightKg,
                            system_code: currentSystem?.code
                        })
                    }
                })

                // 3. Update metadata with history
                const newMetadata = await lotService.addExportToHistory({
                    supabase,
                    lotId: lot.id,
                    originalMetadata: lot.metadata,
                    exportData: {
                        id: crypto.randomUUID(),
                        customer: customerName || 'Khách lẻ',
                        description: description,
                        location_code: lot.positions?.[0]?.code || null,
                        items: exportItemsData
                    }
                })

                // 4. Perform full export updates in database
                // Update LOT status and quantity
                const { error: lotUpdError } = await (supabase.from('lots') as any).update({
                    quantity: 0,
                    metadata: newMetadata,
                    status: 'exported',
                    system_code: lot.system_code // Explicitly preserve system_code
                }).eq('id', lot.id)
                if (lotUpdError) throw lotUpdError

                // Delete lot_items (as we are exporting everything)
                const { error: itemsDelError } = await (supabase.from('lot_items') as any).delete().eq('lot_id', lot.id)
                if (itemsDelError) throw itemsDelError

                // Clear positions
                const { error: posUpdError } = await (supabase.from('positions') as any).update({ lot_id: null }).eq('lot_id', lot.id)
                if (posUpdError) throw posUpdError

                // Audit log export action on lot
                await logActivity({
                    supabase,
                    tableName: 'lots',
                    recordId: lot.id,
                    action: 'UPDATE',
                    oldData: { quantity: lot.quantity, status: lot.status },
                    newData: { quantity: 0, status: 'exported' },
                    systemCode: lot.system_code
                })
            }

            // Save Production Inputs
            if (allProductionInputs.length > 0) {
                const { error: piError } = await (supabase as any).from('production_inputs').insert(allProductionInputs)
                if (piError) throw piError
            }

            showToast(`Đã xuất thành công ${lotIds.length} lô hàng`, 'success')
            onSuccess()
        } catch (e: any) {
            console.error('Bulk export error:', e)
            setError(e.message || 'Có lỗi xảy ra khi xuất hàng loạt')
        } finally {
            setLoading(false)
        }
    }

    const NOTE_SUGGESTIONS = ['Bán hàng', 'Xuất sản xuất', 'Phân loại', 'Xuất hủy', 'Điều chuyển']

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-start justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                            <PackageMinus size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Xuất hàng loạt
                            </h3>
                            <p className="text-sm font-medium mt-1 text-slate-500">
                                Đang chọn <span className="text-rose-600 dark:text-rose-400 font-bold">{lotIds.length} LOT</span> để xuất toàn bộ
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                <div className="px-6 py-2 border-t border-slate-100 dark:border-slate-800 flex-1 overflow-y-auto custom-scrollbar">
                    {/* Items Summary */}
                    <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 px-1">Danh sách hàng xuất</h4>
                        <div className="space-y-2">
                            {aggregatedDisplayItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold font-mono shrink-0">
                                            {item.sku}
                                        </span>
                                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                                            {item.name}
                                        </span>
                                    </div>
                                    <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0 ml-4">
                                        {formatQuantityFull(item.totalQty)} {item.unit}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="mt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 text-left">
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                    <FileText size={12} className="text-orange-500" />
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
                                        <div className="absolute z-[110] left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto w-[120%] -left-[10%] backdrop-blur-xl">
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
                                                            if (!description || description === 'Xuất kho nhanh (Sơ đồ)') setDescription('Xuất sản xuất')
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

                            <div className="space-y-1.5 text-left">
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                    <User size={12} />
                                    Người nhận / Khách hàng
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => {
                                            setCustomerName(e.target.value)
                                            const filtered = customers.filter(c => c.name.toLowerCase().includes(e.target.value.toLowerCase()))
                                            setSuggestions(filtered)
                                            setShowSuggestions(true)
                                        }}
                                        onFocus={() => {
                                            setSuggestions(customers)
                                            setShowSuggestions(true)
                                        }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all font-medium text-sm"
                                        placeholder="Nhập tên khách hoặc bộ phận..."
                                    />
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="absolute z-[110] left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-48 overflow-y-auto w-full">
                                            {suggestions.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomerName(c.name)
                                                        setShowSuggestions(false)
                                                    }}
                                                    className="w-full text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm font-medium transition-colors"
                                                >
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 space-y-1.5 text-left pb-4">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                <FileText size={12} />
                                Ghi chú hàng loạt
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all font-medium min-h-[80px] resize-none"
                                placeholder="Nhập lý do xuất..."
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                                {NOTE_SUGGESTIONS.map(note => (
                                    <button
                                        key={note}
                                        type="button"
                                        onClick={() => setDescription(note)}
                                        className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-[10px] font-bold text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                                    >
                                        {note}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 flex items-center justify-end gap-3 mt-auto bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleBulkExport}
                        disabled={loading}
                        className="px-8 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Đang xuất...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Xác nhận xuất hàng loạt
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[120] p-4 bg-red-600 text-white rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={16} /></button>
                </div>
            )}
        </div>
    )
}

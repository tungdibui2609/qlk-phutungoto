'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Loader2, ShoppingCart, Trash2, AlertTriangle, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { unbundleService } from '@/services/inventory/unbundleService'
import { toBaseAmount as toBaseAmountLogic, ConversionMap, UnitNameMap } from '@/lib/unitConversion'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull } from '@/lib/numberUtils'

interface PendingExport {
    lot_id: string
    lot_code: string
    export_id: string
    customer: string
    date: string
    description: string
    location_code: string | null
    items: Record<string, any>
    is_edit?: boolean
    is_adjustment?: boolean
}

interface LotExportBufferProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    onFillInfo?: (data: any) => void
}

export const LotExportBuffer: React.FC<LotExportBufferProps> = ({ isOpen, onClose, onSuccess, onFillInfo }) => {
    const { systemType, currentSystem } = useSystem()
    const { showToast, showConfirm } = useToast()
    const [pendingExports, setPendingExports] = useState<PendingExport[]>([])
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)

    // Data State
    const [customers, setCustomers] = useState<any[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [units, setUnits] = useState<any[]>([])
    const [orderTypes, setOrderTypes] = useState<any[]>([])

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [quickCustomerId, setQuickCustomerId] = useState<string>('')
    const [quickBranchName, setQuickBranchName] = useState<string>('')
    const [quickOrderTypeId, setQuickOrderTypeId] = useState<string>('')
    const [targetUnit, setTargetUnit] = useState<string>('')

    useEffect(() => {
        if (isOpen) {
            fetchPendingExports()
            fetchCommonData()
            setSelectedIds(new Set())
            setQuickCustomerId('')
            setQuickBranchName('')
            setQuickOrderTypeId('')

            // Load saved unit
            const savedUnit = localStorage.getItem('lot_export_target_unit')
            setTargetUnit(savedUnit || '')
        }
    }, [isOpen])

    const fetchCommonData = async () => {
        if (!currentSystem?.code) return

        const [typesRes, custRes, branchRes, unitRes] = await Promise.all([
            (supabase as any).from('order_types').select('*').or(`scope.eq.outbound,scope.eq.both`).or(`system_code.eq.${currentSystem.code},system_code.is.null`).eq('is_active', true).order('name'),
            supabase.from('customers').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('units').select('*').eq('is_active', true).order('name')
        ])

        if (typesRes.data) setOrderTypes(typesRes.data)
        if (custRes.data) setCustomers(custRes.data)
        if (branchRes.data) {
            setBranches(branchRes.data)
            const defaultBranch = branchRes.data.find((b: any) => b.is_default) || branchRes.data[0]
            if (defaultBranch) setQuickBranchName(defaultBranch.name)
        }
        if (unitRes.data) setUnits(unitRes.data)
    }

    const fetchPendingExports = async () => {
        setLoading(true)
        try {
            // Find lots with pending exports in system history
            const { data, error } = await supabase
                .from('lots')
                .select('id, code, metadata, positions(code)')
                .eq('system_code', systemType)
            // Note: Filtering JSON arrays in JS for precision, but selecting all relevant lots

            if (error) throw error

            const buffer: PendingExport[] = []
            data?.forEach(lot => {
                const metadata = lot.metadata as any
                const exports = metadata?.system_history?.exports || []
                exports.forEach((exp: any) => {
                    if (exp.draft === true) {
                        buffer.push({
                            lot_id: lot.id,
                            lot_code: lot.code,
                            export_id: exp.id,
                            customer: exp.customer,
                            date: exp.date,
                            description: exp.description,
                            location_code: exp.location_code || (lot as any).positions?.[0]?.code || null,
                            items: exp.items,
                            is_edit: exp.is_edit,
                            is_adjustment: exp.is_adjustment
                        })
                    }
                })
            })

            setPendingExports(buffer)
        } catch (e: any) {
            showToast('Lỗi tải hàng chờ: ' + e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) newSelected.delete(id)
        else newSelected.add(id)
        setSelectedIds(newSelected)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === pendingExports.length && pendingExports.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(pendingExports.map(b => b.export_id)))
        }
    }

    const handleRemoveFromBuffer = async (exportId: string, lotId: string) => {
        if (!await showConfirm('Bạn có chắc chắn muốn xóa dòng này khỏi hàng chờ? (Lưu ý: Thao tác này KHÔNG hoàn lại số lượng sản phẩm vào LOT)')) return

        try {
            const { data: lot } = await supabase.from('lots').select('metadata').eq('id', lotId).single()
            if (!lot) return

            const metadata = { ...lot.metadata as any }
            metadata.system_history.exports = metadata.system_history.exports.filter((exp: any) => exp.id !== exportId)

            await supabase.from('lots').update({ metadata }).eq('id', lotId)
            setPendingExports(prev => prev.filter(p => p.export_id !== exportId))
            const newSelected = new Set(selectedIds)
            newSelected.delete(exportId)
            setSelectedIds(newSelected)
            showToast('Đã xóa khỏi hàng chờ', 'success')
        } catch (e: any) {
            showToast('Lỗi khi xóa: ' + e.message, 'error')
        }
    }

    const handleSync = async () => {
        const toSync = pendingExports.filter(p => selectedIds.has(p.export_id))
        if (toSync.length === 0) return

        const noLocation = toSync.filter(p => !p.location_code)
        if (noLocation.length > 0) {
            if (!await showConfirm(`CẢNH BÁO: Phát hiện ${noLocation.length} lô hàng CHƯA CÓ VỊ TRÍ.\n\nBạn có chắc chắn muốn tiếp tục lập phiếu không?`)) return
        }

        setSyncing(true)

        try {
            // --- A. PREPARE DATA FOR UNBUNDLE ---
            const uniqueProductIds = Array.from(new Set(
                toSync.flatMap(p => Object.values(p.items).map((item: any) => item.product_id))
            ))

            // 1. Fetch Products & Unit Configs
            const { data: productsData, error: prodErr } = await (supabase as any).from('products')
                .select('id, name, unit, product_units(unit_id, conversion_rate)')
                .in('id', uniqueProductIds)
            if (prodErr) throw prodErr

            // 2. Fetch Units (Atomic)
            const { data: unitsData, error: unitsErr } = await supabase.from('units').select('*').eq('is_active', true)
            if (unitsErr) throw unitsErr

            // 3. Fetch Inventory Balance via API
            const invRes = await fetch(`/api/inventory?systemType=${systemType}`).then(res => res.json())
            const stockData = (invRes.ok && Array.isArray(invRes.items)) ? invRes.items : []

            // 4. Fetch Conversion Type
            const { data: convType } = await (supabase as any).from('order_types')
                .select('id')
                .eq('code', 'CONV')
                .single()

            // 5. Build necessary maps
            const localUnitNameMap: UnitNameMap = new Map()
            unitsData?.forEach((u: any) => localUnitNameMap.set(u.name.toLowerCase().trim(), u.id))

            const localConversionMap: ConversionMap = new Map()
            productsData?.forEach((p: any) => {
                const pMap = new Map<string, number>()
                p.product_units?.forEach((pu: any) => pMap.set(pu.unit_id, pu.conversion_rate))
                localConversionMap.set(p.id, pMap)
            })

            const localUnitStockMap: Map<string, number> = new Map()
            stockData.forEach((s: any) => {
                const normUnit = (s.unit || '').toLowerCase().trim().replace(/\s+/g, ' ')
                const key = `${s.productId}_${normUnit}`
                const current = localUnitStockMap.get(key) || 0
                localUnitStockMap.set(key, current + (s.balance || 0))
            })

            console.log('[Unbundle Trace] Data Ready:', {
                toSyncCount: toSync.length,
                stockEntries: stockData.length,
                stockMapSize: localUnitStockMap.size,
                sampleStockKey: Array.from(localUnitStockMap.keys())[0]
            })

            // Generate Order Code Helper (Matches useOutboundOrder logic)
            const generateInternalCode = async (type: 'PNK' | 'PXK') => {
                const getPrefix = (code: string, name?: string): string => {
                    if (name) {
                        const nameWithoutKho = name.replace(/^Kho\s+/i, '')
                        return nameWithoutKho.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").split(' ').filter(word => word.length > 0).map(word => word[0]).join('').toUpperCase()
                    }
                    return code.substring(0, 3).toUpperCase()
                }

                const today = new Date()
                const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`
                const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
                const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()
                const tableName = type === 'PNK' ? 'inbound_orders' : 'outbound_orders'

                const { count, error } = await supabase.from(tableName)
                    .select('*', { count: 'exact', head: true })
                    .eq('system_code', systemType)
                    .gte('created_at', startOfDay)
                    .lte('created_at', endOfDay)

                const prefix = getPrefix(systemType, currentSystem?.name)
                if (error) {
                    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
                    return `${prefix}-${type}-${dateStr}-${random}`
                }
                const stt = String((count || 0) + 1).padStart(3, '0')
                return `${prefix}-${type}-${dateStr}-${stt}`
            }

            // --- B. GENERATE MAIN ORDER CODE ---
            const orderCode = await generateInternalCode('PXK')

            // --- C. PROCESS UNBUNDLE FOR EACH ITEM ---
            for (const p of toSync) {
                const itemsList = Object.values(p.items)
                for (const item of itemsList) {
                    const qtyNum = Number(item.exported_quantity) || 0
                    console.log(`[Unbundle Trace] Verifying item: ${item.product_name}`, {
                        reqQty: qtyNum,
                        reqUnit: item.unit,
                        currentInStock: localUnitStockMap.get(`${item.product_id}_${item.unit.toLowerCase().trim()}`) || 0
                    })

                    const check = unbundleService.checkUnbundle({
                        productId: item.product_id,
                        unit: item.unit,
                        qty: qtyNum,
                        products: productsData || [],
                        units: unitsData || [],
                        unitNameMap: localUnitNameMap,
                        conversionMap: localConversionMap,
                        unitStockMap: localUnitStockMap
                    })

                    console.log(`[Unbundle Trace] Unbundle Check for ${item.product_name}:`, check)

                    if (check.needsUnbundle && check.sourceUnit && check.rate) {
                        showToast(`Thiếu ${item.unit} cho ${item.product_name}. Đang tự bẻ gói từ ${check.sourceUnit}...`, 'info')

                        await unbundleService.executeAutoUnbundle({
                            supabase,
                            productId: item.product_id,
                            productName: item.product_name,
                            baseUnit: check.sourceUnit,
                            reqUnit: item.unit,
                            reqQty: qtyNum,
                            currentLiquid: localUnitStockMap.get(`${item.product_id}_${item.unit.toLowerCase().trim()}`) || 0,
                            costPrice: item.cost_price || 0,
                            rate: check.rate,
                            warehouseName: quickBranchName || currentSystem?.name || 'Kho chính',
                            systemCode: systemType,
                            mainOrderCode: orderCode,
                            convTypeId: convType?.id,
                            generateOrderCode: generateInternalCode
                        })

                        console.log(`[Unbundle Trace] Executed Unbundle for ${item.product_name}`)

                        // Update local stock map for subsequent items in the same batch
                        const sourceKey = `${item.product_id}_${check.sourceUnit.toLowerCase().trim()}`
                        const reqKey = `${item.product_id}_${item.unit.toLowerCase().trim()}`

                        const deficit = qtyNum - (localUnitStockMap.get(reqKey) || 0)
                        const baseToBreak = Math.ceil(deficit / check.rate - 0.000001)

                        localUnitStockMap.set(sourceKey, (localUnitStockMap.get(sourceKey) || 0) - baseToBreak)
                        localUnitStockMap.set(reqKey, (localUnitStockMap.get(reqKey) || 0) + (baseToBreak * check.rate))
                    }
                }
            }

            // --- D. CREATE FINAL BATCH OUTBOUND ORDER ---
            // 2. Identify Customer
            let mainCustomer = ''
            if (quickCustomerId) {
                mainCustomer = customers.find(c => c.id === quickCustomerId)?.name || ''
            } else {
                const unique = Array.from(new Set(toSync.map(p => p.customer)))
                mainCustomer = unique.length === 1 ? unique[0] : `Nhiều khách hàng (${unique.length})`
            }

            // 3. Create Outbound Order
            const { data: order, error: orderError } = await (supabase.from('outbound_orders') as any).insert({
                code: orderCode,
                customer_name: mainCustomer,
                description: `Phiếu xuất tổng cho ${toSync.length} lô hàng.`,
                status: 'Completed',
                type: 'Export',
                system_code: systemType,
                system_type: systemType,
                warehouse_name: quickBranchName || currentSystem?.name || 'Kho chính',
                order_type_id: quickOrderTypeId || null,
                metadata: {
                    batch_export: true,
                    merged_exports: toSync.map(p => p.export_id),
                    targetUnit: targetUnit
                }
            }).select().single()

            if (orderError) throw orderError

            // 4. Create Order Items (Aggregated)
            const aggregatedItemsMap = new Map<string, any>()

            toSync.forEach(p => {
                Object.values(p.items).forEach((item: any) => {
                    const key = `${item.product_id}|${item.unit}`
                    const qty = item.exported_quantity || 0

                    if (aggregatedItemsMap.has(key)) {
                        const existing = aggregatedItemsMap.get(key)
                        existing.quantity += qty
                        existing.document_quantity += qty
                        if (!existing.lots.includes(p.lot_code)) {
                            existing.lots.push(p.lot_code)
                        }
                    } else {
                        aggregatedItemsMap.set(key, {
                            order_id: order.id,
                            product_id: item.product_id,
                            product_name: item.product_name,
                            unit: item.unit,
                            quantity: qty,
                            document_quantity: qty,
                            price: item.cost_price || 0,
                            lots: [p.lot_code]
                        })
                    }
                })
            })

            const allOrderItems = Array.from(aggregatedItemsMap.values()).map(item => {
                const { lots, ...rest } = item
                return {
                    ...rest,
                    note: `Xuất từ các LOT: ${lots.join(', ')}`
                }
            })

            const { error: itemsError } = await (supabase.from('outbound_order_items') as any).insert(allOrderItems)
            if (itemsError) throw itemsError

            // 5. Update all LOTs to clear the draft flag
            for (const p of toSync) {
                const { data: lot } = await supabase.from('lots').select('metadata').eq('id', p.lot_id).single()
                if (lot) {
                    const metadata = { ...lot.metadata as any }
                    metadata.system_history.exports = metadata.system_history.exports.map((exp: any) => {
                        if (exp.id === p.export_id) {
                            return { ...exp, draft: false, order_id: order.id, order_code: orderCode }
                        }
                        return exp
                    })
                    await supabase.from('lots').update({ metadata }).eq('id', p.lot_id)
                }
            }

            showToast(`Đã tạo phiếu xuất tổng: ${orderCode}`, 'success')
            onSuccess()
            onClose()
        } catch (e: any) {
            console.error('Sync error details:', e)
            showToast('Lỗi đồng bộ: ' + (e.message || JSON.stringify(e)), 'error')
        } finally {
            setSyncing(false)
        }
    }

    if (!isOpen) return null

    const totalItems = pendingExports.reduce((sum, p) => sum + Object.keys(p.items).length, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <Layers size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                                Hàng chờ xuất kho
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">
                                Tổng cộng <span className="text-orange-600 dark:text-orange-400 font-bold">{pendingExports.length}</span> lệnh xuất lẻ, <span className="font-bold">{totalItems}</span> dòng sản phẩm.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {loading ? (
                        <div className="p-20 text-center">
                            <Loader2 className="animate-spin mx-auto text-orange-500 mb-4" size={32} />
                            <p className="text-slate-500 font-medium tracking-tight">Đang tải hàng chờ...</p>
                        </div>
                    ) : pendingExports.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-300">
                                <ShoppingCart size={40} />
                            </div>
                            <p className="text-slate-500 font-medium">Hiện không có sản phẩm nào trong hàng chờ</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div
                                onClick={toggleSelectAll}
                                className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.size === pendingExports.length
                                    ? "bg-orange-600 border-orange-600 text-white"
                                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                    }`}>
                                    {selectedIds.size === pendingExports.length && <Check size={16} strokeWidth={3} />}
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Chọn tất cả ({pendingExports.length})
                                </span>
                            </div>

                            {pendingExports.map((exp) => (
                                <div
                                    key={exp.export_id}
                                    onClick={() => toggleSelection(exp.export_id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedIds.has(exp.export_id)
                                        ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${selectedIds.has(exp.export_id)
                                            ? "bg-orange-600 border-orange-600 text-white"
                                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                            }`}>
                                            {selectedIds.has(exp.export_id) && <Check size={16} strokeWidth={3} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 font-mono bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                                                            LOT: {exp.lot_code}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${exp.location_code
                                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-pulse"
                                                            }`}>
                                                            {exp.location_code ? `VT: ${exp.location_code}` : "Chưa có vị trí"}
                                                        </span>
                                                        {exp.is_edit && (
                                                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                                                ĐÃ SỬA
                                                            </span>
                                                        )}
                                                        {exp.is_adjustment && (
                                                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 font-mono bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded">
                                                                ĐIỀU CHỈNH
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(exp.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-900 dark:text-slate-100 mt-1 cursor-help" title={exp.description || 'Không có ghi chú'}>
                                                        {(() => {
                                                            // If selected and using quick customer, show that
                                                            if (selectedIds.has(exp.export_id) && quickCustomerId) {
                                                                const quickCust = customers.find(c => c.id === quickCustomerId)
                                                                return quickCust ? `Khách: ${quickCust.name} (Gán lại)` : `Khách: ${exp.customer}`
                                                            }
                                                            // Default
                                                            return exp.customer && exp.customer !== 'N/A' ? `Khách: ${exp.customer}` : 'Chưa gán khách hàng'
                                                        })()}
                                                    </h4>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveFromBuffer(exp.export_id, exp.lot_id);
                                                    }}
                                                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                    title="Xóa khỏi hàng chờ"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="space-y-1 mt-2">
                                                {Object.values(exp.items).map((item: any, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-t border-slate-100 dark:border-slate-700/50">
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">
                                                                {item.product_name}
                                                            </span>
                                                        </div>
                                                        <div className="text-right whitespace-nowrap">
                                                            <span className="font-black text-slate-900 dark:text-slate-100">{formatQuantityFull(item.exported_quantity)}</span>
                                                            <span className="ml-1 text-slate-400 font-bold uppercase text-[9px]">{item.unit}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">

                    {selectedIds.size > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-2 fade-in">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Khách hàng (Gán chung)</label>
                                <select
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                                    value={quickCustomerId}
                                    onChange={e => setQuickCustomerId(e.target.value)}
                                >
                                    <option value="">-- Giữ nguyên theo LOT --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Chi nhánh ({currentSystem?.name || 'Kho'})</label>
                                <select
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                                    value={quickBranchName}
                                    onChange={e => setQuickBranchName(e.target.value)}
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Loại phiếu xuất</label>
                                <select
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                                    value={quickOrderTypeId}
                                    onChange={e => setQuickOrderTypeId(e.target.value)}
                                >
                                    <option value="">-- Chọn loại phiếu --</option>
                                    {orderTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Hiện quy đổi</label>
                                <select
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                                    value={targetUnit}
                                    onChange={e => {
                                        const newValue = e.target.value
                                        setTargetUnit(newValue)
                                        if (newValue) localStorage.setItem('lot_export_target_unit', newValue)
                                        else localStorage.removeItem('lot_export_target_unit')
                                    }}
                                >
                                    <option value="">-- Mặc định --</option>
                                    {units.map(u => (
                                        <option key={u.id} value={u.name}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700"
                        >
                            Đóng
                        </button>

                        <div className="flex items-center gap-3">


                            <button
                                onClick={handleSync}
                                disabled={selectedIds.size === 0 || syncing}
                                className="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all flex items-center gap-2 active:scale-95"
                            >
                                {syncing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Đang xử lý...
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} />
                                        Gộp & Tạo phiếu ({selectedIds.size})
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

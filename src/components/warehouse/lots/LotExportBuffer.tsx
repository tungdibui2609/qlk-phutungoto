'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Loader2, ShoppingCart, Trash2, AlertTriangle, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
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
            (supabase.from('order_types') as any).select('*').or(`scope.eq.outbound,scope.eq.both`).or(`system_code.eq.${currentSystem.code},system_code.is.null`).eq('is_active', true).order('name'),
            supabase.from('customers').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('units').select('*').order('name')
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
                            is_edit: exp.is_edit
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
            // 1. Generate Order Code
            const today = new Date()
            const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`
            let prefix = 'BATCH'
            if (currentSystem?.name) {
                prefix = currentSystem.name.replace(/^Kho\s+/i, '').split(/\s+/).map(word => word[0]).join('').toUpperCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
            }
            const orderCode = `${prefix}-PXK-${dateStr}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

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

            // 4. Create Order Items
            const allOrderItems: any[] = []
            toSync.forEach(p => {
                Object.values(p.items).forEach((item: any) => {
                    allOrderItems.push({
                        order_id: order.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        unit: item.unit,
                        quantity: item.exported_quantity,
                        document_quantity: item.exported_quantity,
                        price: item.cost_price || 0,
                        note: `Xuất từ LOT: ${p.lot_code}`
                    })
                })
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
            console.error('Sync error:', e)
            showToast('Lỗi đồng bộ: ' + e.message, 'error')
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

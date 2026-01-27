'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Loader2, Inbox, Trash2, AlertTriangle, Boxes, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull } from '@/lib/numberUtils'

interface PendingInbound {
    lot_id: string
    lot_code: string
    inbound_id: string
    supplier_id: string | null
    supplier_name: string
    date: string
    location_code: string | null
    items: Record<string, any>
    is_edit?: boolean
    is_adjustment?: boolean
}

interface LotInboundBufferProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    onFillInfo?: (data: any) => void
}

export const LotInboundBuffer: React.FC<LotInboundBufferProps> = ({ isOpen, onClose, onSuccess, onFillInfo }) => {
    const { systemType, currentSystem } = useSystem()
    const { showToast, showConfirm } = useToast()
    const [pendingInbounds, setPendingInbounds] = useState<PendingInbound[]>([])
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)

    // Data State
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [units, setUnits] = useState<any[]>([])
    const [orderTypes, setOrderTypes] = useState<any[]>([])

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [quickSupplierId, setQuickSupplierId] = useState<string>('')
    const [quickBranchName, setQuickBranchName] = useState<string>('')
    const [quickOrderTypeId, setQuickOrderTypeId] = useState<string>('')
    const [targetUnit, setTargetUnit] = useState<string>('')

    useEffect(() => {
        if (isOpen) {
            fetchPendingInbounds()
            fetchCommonData()
            setSelectedIds(new Set())
            setQuickSupplierId('')
            setQuickBranchName('')
            setQuickOrderTypeId('')

            // Load saved unit
            const savedUnit = localStorage.getItem('lot_inbound_target_unit')
            setTargetUnit(savedUnit || '')
        }
    }, [isOpen, currentSystem])

    const fetchCommonData = async () => {
        if (!currentSystem?.code) return

        const [typesRes, suppRes, branchRes, unitRes] = await Promise.all([
            (supabase.from('order_types') as any).select('*').or(`scope.eq.inbound,scope.eq.both`).or(`system_code.eq.${currentSystem.code},system_code.is.null`).eq('is_active', true).order('name'),
            supabase.from('suppliers').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('units').select('*').order('name')
        ])

        if (typesRes.data) setOrderTypes(typesRes.data)
        if (suppRes.data) setSuppliers(suppRes.data)
        if (branchRes.data) {
            setBranches(branchRes.data)
            const defaultBranch = branchRes.data.find((b: any) => b.is_default) || branchRes.data[0]
            if (defaultBranch) setQuickBranchName(defaultBranch.name)
        }
        if (unitRes.data) setUnits(unitRes.data)
    }

    const fetchPendingInbounds = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('lots')
                .select('id, code, metadata, positions(code)')
                .eq('system_code', systemType)

            if (error) throw error

            const buffer: PendingInbound[] = []
            data?.forEach(lot => {
                const metadata = lot.metadata as any
                const inbounds = metadata?.system_history?.inbound || []
                inbounds.forEach((inc: any) => {
                    if (inc.draft === true) {
                        buffer.push({
                            lot_id: lot.id,
                            lot_code: lot.code,
                            inbound_id: inc.id,
                            supplier_id: inc.supplier_id || null,
                            supplier_name: inc.supplier_name || 'N/A',
                            date: inc.date,
                            location_code: inc.location_code || (lot as any).positions?.[0]?.code || null,
                            items: inc.items,
                            is_edit: inc.is_edit,
                            is_adjustment: inc.is_adjustment
                        })
                    }
                })
            })
            setPendingInbounds(buffer)
        } catch (e: any) {
            showToast('Lỗi tải hàng chờ nhập: ' + e.message, 'error')
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
        if (selectedIds.size === pendingInbounds.length && pendingInbounds.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(pendingInbounds.map(b => b.inbound_id)))
        }
    }

    const handleRemoveFromBuffer = async (inboundId: string, lotId: string) => {
        if (!await showConfirm('Bạn có chắc chắn muốn xóa dòng này khỏi hàng chờ?')) return

        try {
            const { data: lot } = await supabase.from('lots').select('metadata').eq('id', lotId).single()
            if (!lot) return

            const metadata = { ...lot.metadata as any }
            metadata.system_history.inbound = metadata.system_history.inbound.filter((inc: any) => inc.id !== inboundId)

            await supabase.from('lots').update({ metadata }).eq('id', lotId)
            setPendingInbounds(prev => prev.filter(p => p.inbound_id !== inboundId))
            const newSelected = new Set(selectedIds)
            newSelected.delete(inboundId)
            setSelectedIds(newSelected)
            showToast('Đã xóa khỏi hàng chờ', 'success')
        } catch (e: any) {
            showToast('Lỗi khi xóa: ' + e.message, 'error')
        }
    }

    const handleSync = async () => {
        const toSync = pendingInbounds.filter(p => selectedIds.has(p.inbound_id))
        if (toSync.length === 0) return

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
            const orderCode = `${prefix}-PNK-${dateStr}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

            // 2. Identify Supplier
            let finalSupplierId = quickSupplierId || null
            let descriptionSuffix = ''

            if (!finalSupplierId) {
                const uniqueIds = Array.from(new Set(toSync.map(p => p.supplier_id).filter(Boolean)))
                if (uniqueIds.length === 1) {
                    finalSupplierId = uniqueIds[0] as string
                } else if (uniqueIds.length > 1) {
                    descriptionSuffix = ` (Bao gồm nhiều NCC: ${uniqueIds.length})`
                }
            }

            // 3. Create Inbound Order
            const { data: order, error: orderError } = await (supabase.from('inbound_orders') as any).insert({
                code: orderCode,
                supplier_id: finalSupplierId,
                description: `Phiếu nhập tổng cho ${toSync.length} lô hàng.${descriptionSuffix}`,
                status: 'Completed',
                type: 'Import',
                system_code: systemType,
                system_type: systemType,
                warehouse_name: quickBranchName || currentSystem?.name || 'Kho chính',
                order_type_id: quickOrderTypeId || null,
                metadata: {
                    batch_inbound: true,
                    merged_inbounds: toSync.map(p => p.inbound_id),
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
                        quantity: item.quantity || item.received_quantity || 0,
                        document_quantity: item.quantity || item.received_quantity || 0,
                        price: item.price || 0,
                        note: `Nhập từ LOT: ${p.lot_code}`
                    })
                })
            })

            const { error: itemsError } = await (supabase.from('inbound_order_items') as any).insert(allOrderItems)
            if (itemsError) throw itemsError

            // 5. Update Lots
            for (const p of toSync) {
                const { data: lot } = await supabase.from('lots').select('metadata').eq('id', p.lot_id).single()
                if (lot) {
                    const metadata = { ...lot.metadata as any }
                    metadata.system_history.inbound = metadata.system_history.inbound.map((inc: any) => {
                        if (inc.id === p.inbound_id) {
                            return { ...inc, draft: false, order_id: order.id, order_code: orderCode }
                        }
                        return inc
                    })
                    await supabase.from('lots').update({ metadata }).eq('id', p.lot_id)
                }
            }

            showToast(`Đã tạo phiếu nhập tổng: ${orderCode}`, 'success')
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

    const totalItems = pendingInbounds.reduce((sum, p) => sum + Object.keys(p.items).length, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Inbox size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                                Hàng chờ nhập kho
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">
                                Tổng cộng <span className="text-blue-600 dark:text-blue-400 font-bold">{pendingInbounds.length}</span> lệnh nhập lẻ, <span className="font-bold">{totalItems}</span> dòng sản phẩm.
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
                            <Loader2 className="animate-spin mx-auto text-blue-500 mb-4" size={32} />
                            <p className="text-slate-500 font-medium tracking-tight">Đang tải hàng chờ...</p>
                        </div>
                    ) : pendingInbounds.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-300">
                                <Boxes size={40} />
                            </div>
                            <p className="text-slate-500 font-medium">Hiện không có sản phẩm nào trong hàng chờ</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div
                                onClick={toggleSelectAll}
                                className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.size === pendingInbounds.length
                                    ? "bg-blue-600 border-blue-600 text-white"
                                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                    }`}>
                                    {selectedIds.size === pendingInbounds.length && <Check size={16} strokeWidth={3} />}
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Chọn tất cả ({pendingInbounds.length})
                                </span>
                            </div>

                            {pendingInbounds.map((inc) => (
                                <div
                                    key={inc.inbound_id}
                                    onClick={() => toggleSelection(inc.inbound_id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedIds.has(inc.inbound_id)
                                        ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${selectedIds.has(inc.inbound_id)
                                            ? "bg-blue-600 border-blue-600 text-white"
                                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                            }`}>
                                            {selectedIds.has(inc.inbound_id) && <Check size={16} strokeWidth={3} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                                            LOT: {inc.lot_code}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${inc.location_code
                                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-pulse"
                                                            }`}>
                                                            {inc.location_code ? `VT: ${inc.location_code}` : "Chưa có vị trí"}
                                                        </span>
                                                        {inc.is_edit && (
                                                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                                                ĐÃ SỬA
                                                            </span>
                                                        )}
                                                        {inc.is_adjustment && (
                                                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 font-mono bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded">
                                                                ĐIỀU CHỈNH
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(inc.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-900 dark:text-slate-100 mt-1 cursor-help">
                                                        {(() => {
                                                            if (selectedIds.has(inc.inbound_id) && quickSupplierId) {
                                                                const quickSupp = suppliers.find(s => s.id === quickSupplierId)
                                                                return quickSupp ? `NCC: ${quickSupp.name} (Gán lại)` : `NCC: ${inc.supplier_name}`
                                                            }
                                                            return inc.supplier_name ? `NCC: ${inc.supplier_name}` : 'Chưa gán NCC'
                                                        })()}
                                                    </h4>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveFromBuffer(inc.inbound_id, inc.lot_id);
                                                    }}
                                                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                    title="Xóa khỏi hàng chờ"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="space-y-1 mt-2">
                                                {Object.values(inc.items).map((item: any, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-t border-slate-100 dark:border-slate-700/50">
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">
                                                                {item.product_name}
                                                            </span>
                                                        </div>
                                                        <div className="text-right whitespace-nowrap">
                                                            <span className="font-black text-slate-900 dark:text-slate-100">
                                                                {formatQuantityFull(item.quantity || item.received_quantity || 0)}
                                                            </span>
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
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Nhà cung cấp (Gán chung)</label>
                                <select
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    value={quickSupplierId}
                                    onChange={e => setQuickSupplierId(e.target.value)}
                                >
                                    <option value="">-- Giữ nguyên theo LOT --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Chi nhánh ({currentSystem?.name || 'Kho'})</label>
                                <select
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    value={quickBranchName}
                                    onChange={e => setQuickBranchName(e.target.value)}
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Loại phiếu nhập</label>
                                <select
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
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
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    value={targetUnit}
                                    onChange={e => {
                                        const newValue = e.target.value
                                        setTargetUnit(newValue)
                                        if (newValue) localStorage.setItem('lot_inbound_target_unit', newValue)
                                        else localStorage.removeItem('lot_inbound_target_unit')
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
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2 active:scale-95"
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

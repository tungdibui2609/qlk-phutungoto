'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Loader2, Inbox, Trash2, AlertTriangle, Boxes, StickyNote } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'

interface PendingInbound {
    lot_id: string
    lot_code: string
    inbound_id: string
    supplier_id: string | null
    supplier_name: string
    date: string
    location_code: string | null
    items: Record<string, any>
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

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (isOpen) {
            fetchPendingInbounds()
            setSelectedIds(new Set())
        }
    }, [isOpen])

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
                inbounds.forEach((inb: any) => {
                    if (inb.draft === true) {
                        buffer.push({
                            lot_id: lot.id,
                            lot_code: lot.code,
                            inbound_id: inb.id,
                            supplier_id: inb.supplier_id || null,
                            supplier_name: inb.supplier_name || 'N/A',
                            date: inb.date,
                            location_code: (lot as any).positions?.[0]?.code || null,
                            items: inb.items
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
            setSelectedIds(new Set()) // Deselect all if all are currently selected
        } else {
            setSelectedIds(new Set(pendingInbounds.map(b => b.inbound_id))) // Select all
        }
    }

    const handleRemoveFromBuffer = async (inboundId: string, lotId: string) => {
        if (!await showConfirm('Bạn có chắc chắn muốn xóa dòng này khỏi hàng chờ nhập? (Lưu ý: Thao tác này KHÔNG xóa LOT hay sản phẩm thực tế)')) return

        try {
            const { data: lot } = await supabase.from('lots').select('metadata').eq('id', lotId).single()
            if (!lot) return

            const metadata = { ...lot.metadata as any }
            metadata.system_history.inbound = metadata.system_history.inbound.filter((inb: any) => inb.id !== inboundId)

            await supabase.from('lots').update({ metadata }).eq('id', lotId)
            setPendingInbounds(prev => prev.filter(p => p.inbound_id !== inboundId))
            const newSelected = new Set(selectedIds)
            newSelected.delete(inboundId)
            setSelectedIds(newSelected)
            showToast('Đã xóa khỏi hàng chờ nhập', 'success')
        } catch (e: any) {
            showToast('Lỗi khi xóa: ' + e.message, 'error')
        }
    }

    const handlePrepareFill = async () => {
        const toSync = pendingInbounds.filter(p => selectedIds.has(p.inbound_id))
        if (toSync.length === 0) return

        const noLocation = toSync.filter(p => !p.location_code)
        if (noLocation.length > 0) {
            if (!await showConfirm(`CẢNH BÁO: Phát hiện ${noLocation.length} lô hàng CHƯA CÓ VỊ TRÍ.\n\nBạn có chắc chắn muốn tiếp tục lập phiếu không?`)) return
        }

        const supplierIds = Array.from(new Set(toSync.map(p => p.supplier_id).filter(id => id)))
        const mainSupplierId = supplierIds.length === 1 ? supplierIds[0] as string : null

        const items = toSync.flatMap(p =>
            Object.values(p.items).map((item: any) => ({
                id: crypto.randomUUID(),
                productId: item.product_id,
                productName: item.product_name,
                unit: item.unit,
                quantity: item.quantity,
                document_quantity: item.quantity,
                price: item.price || 0,
                note: `Nhập qua LOT: ${p.lot_code}`
            }))
        )

        onFillInfo?.({
            supplierId: mainSupplierId,
            items,
            batchData: toSync.map(p => ({ lot_id: p.lot_id, inbound_id: p.inbound_id }))
        })
    }

    const handleSync = async () => {
        const toSync = pendingInbounds.filter(p => selectedIds.has(p.inbound_id))
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
            const orderCode = `${prefix}-INB-${dateStr}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

            // 2. Identify suppliers
            const supplierIds = Array.from(new Set(toSync.map(p => p.supplier_id).filter(id => id)))
            const mainSupplierId = supplierIds.length === 1 ? supplierIds[0] as string : null

            // 3. Create Inbound Order
            const { data: order, error: orderError } = await (supabase.from('inbound_orders') as any).insert({
                code: orderCode,
                supplier_id: mainSupplierId,
                description: `Phiếu nhập tổng gom từ ${toSync.length} lô hàng vừa tạo.`,
                status: 'Completed',
                system_code: systemType,
                system_type: systemType,
                warehouse_name: currentSystem?.name || 'Kho chính',
                metadata: {
                    batch_inbound: true,
                    merged_inbounds: toSync.map(p => p.inbound_id)
                }
            }).select().single()

            if (orderError) throw orderError

            // 4. Create Inbound Order Items
            const allOrderItems: any[] = []
            toSync.forEach(p => {
                Object.values(p.items).forEach((item: any) => {
                    allOrderItems.push({
                        order_id: order.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        unit: item.unit,
                        quantity: item.quantity,
                        document_quantity: item.quantity,
                        price: item.price || 0,
                        note: `Nhập qua LOT: ${p.lot_code}`
                    })
                })
            })

            const { error: itemsError } = await (supabase.from('inbound_order_items') as any).insert(allOrderItems)
            if (itemsError) throw itemsError

            // 5. Update all LOTs to clear the draft flag
            for (const p of toSync) {
                const { data: lot } = await supabase.from('lots').select('metadata').eq('id', p.lot_id).single()
                if (lot) {
                    const metadata = { ...lot.metadata as any }
                    metadata.system_history.inbound = metadata.system_history.inbound.map((inb: any) => {
                        if (inb.id === p.inbound_id) {
                            return { ...inb, draft: false, order_id: order.id, order_code: orderCode }
                        }
                        return inb
                    })
                    await supabase.from('lots').update({ metadata }).eq('id', p.lot_id)
                }
            }

            showToast(`Đã tạo phiếu nhập tổng: ${orderCode}`, 'success')
            onSuccess()
            onClose()
        } catch (e: any) {
            console.error('Sync error:', e)
            showToast('Lỗi đồng bộ nhập kho: ' + e.message, 'error')
        } finally {
            setSyncing(false)
        }
    }

    if (!isOpen) return null

    const totalLines = pendingInbounds.reduce((sum, p) => sum + Object.keys(p.items).length, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Boxes size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                                Hàng chờ nhập kho
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">
                                Có <span className="text-blue-600 dark:text-blue-400 font-bold">{pendingInbounds.length}</span> lô hàng mới tạo, <span className="font-bold">{totalLines}</span> dòng sản phẩm chờ kế toán chốt.
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
                            <p className="text-slate-500 font-medium tracking-tight">Đang tải hàng chờ nhập...</p>
                        </div>
                    ) : pendingInbounds.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-300">
                                <Inbox size={40} />
                            </div>
                            <p className="text-slate-500 font-medium">Hiện không có lô hàng nào đang chờ chốt phiếu nhập</p>
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

                            {pendingInbounds.map((inb) => (
                                <div
                                    key={inb.inbound_id}
                                    onClick={() => toggleSelection(inb.inbound_id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedIds.has(inb.inbound_id)
                                        ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${selectedIds.has(inb.inbound_id)
                                            ? "bg-blue-600 border-blue-600 text-white"
                                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                            }`}>
                                            {selectedIds.has(inb.inbound_id) && <Check size={16} strokeWidth={3} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                                            LOT: {inb.lot_code}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${inb.location_code
                                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-pulse"
                                                            }`}>
                                                            {inb.location_code ? `VT: ${inb.location_code}` : "Chưa có vị trí"}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(inb.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-900 dark:text-slate-100 mt-1">
                                                        {inb.supplier_name !== 'N/A' ? `NCC: ${inb.supplier_name}` : 'Chưa gán NCC'}
                                                    </h4>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveFromBuffer(inb.inbound_id, inb.lot_id);
                                                    }}
                                                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                    title="Xóa khỏi hàng chờ"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="space-y-1 mt-2">
                                                {Object.values(inb.items).map((item: any, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-t border-slate-50 dark:border-slate-700/50">
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">
                                                                {item.product_name}
                                                            </span>
                                                        </div>
                                                        <div className="text-right whitespace-nowrap">
                                                            <span className="font-black text-slate-900 dark:text-slate-100">{item.quantity}</span>
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
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/20 mb-4">
                        <AlertTriangle className="text-blue-600 shrink-0" size={18} />
                        <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">
                            Gộp <span className="font-bold text-blue-600">{selectedIds.size}</span> lô hàng đang chọn thành **1 Phiếu Nhập Kho** chính thức.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700"
                        >
                            Đóng
                        </button>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handlePrepareFill}
                                disabled={selectedIds.size === 0 || syncing}
                                className="px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                <StickyNote size={18} />
                                Điền thông tin & tạo phiếu
                            </button>

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

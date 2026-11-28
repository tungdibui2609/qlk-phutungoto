'use client'

import React, { useEffect, useState } from 'react'
import { X, Building2, ArrowRight, Plus, Loader2, CheckCircle2, Package } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { ConsignmentWarehouse, ConsignmentOrderStatus } from './types'
import { transferOutboundToConsignment } from './consignmentService'

interface TransferToConsignmentModalProps {
    isOpen: boolean
    outboundOrder: {
        id: string
        code: string
        customer_name?: string | null
        description?: string | null
        created_at?: string
        metadata?: Record<string, any> | null
    } | null
    onClose: () => void
    onSuccess?: (createdCode: string) => void
}

export default function TransferToConsignmentModal({
    isOpen,
    outboundOrder,
    onClose,
    onSuccess
}: TransferToConsignmentModalProps) {
    const { systemType } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()

    const [warehouses, setWarehouses] = useState<ConsignmentWarehouse[]>([])
    const [loadingWh, setLoadingWh] = useState(false)
    const [selectedWhId, setSelectedWhId] = useState('')
    const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 16))
    const [status, setStatus] = useState<ConsignmentOrderStatus>('Completed')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Tạo nhanh kho ký gửi nếu chưa có
    const [showQuickCreate, setShowQuickCreate] = useState(false)
    const [quickCode, setQuickCode] = useState('')
    const [quickName, setQuickName] = useState('')
    const [quickAddress, setQuickAddress] = useState('')
    const [creatingWh, setCreatingWh] = useState(false)

    useEffect(() => {
        if (!isOpen || !systemType) return
        loadWarehouses()
        setOrderDate(new Date().toISOString().slice(0, 16))
        setStatus('Completed')
        setDescription(
            outboundOrder
                ? `Nhận ký gửi từ phiếu xuất ${outboundOrder.code}${outboundOrder.description ? ` - ${outboundOrder.description}` : ''}`
                : ''
        )
        setShowQuickCreate(false)
    }, [isOpen, systemType, outboundOrder?.id])

    async function loadWarehouses() {
        setLoadingWh(true)
        const { data } = await (supabase.from('consignment_warehouses') as any)
            .select('*')
            .eq('system_code', systemType)
            .eq('is_active', true)
            .order('name')
        const list = (data || []) as ConsignmentWarehouse[]
        setWarehouses(list)
        if (list.length > 0) {
            setSelectedWhId(prev => (list.some(w => w.id === prev) ? prev : list[0].id))
        } else {
            setSelectedWhId('')
            setShowQuickCreate(true)
        }
        setLoadingWh(false)
    }

    async function handleQuickCreateWarehouse() {
        if (!quickName.trim()) {
            showToast('Vui lòng nhập tên kho ký gửi', 'warning')
            return
        }
        setCreatingWh(true)
        try {
            const generatedCode = quickCode.trim().toUpperCase() || `KKG-${Date.now().toString().slice(-4)}`
            const { data, error } = await (supabase.from('consignment_warehouses') as any)
                .insert({
                    company_id: profile?.company_id || undefined,
                    system_code: systemType,
                    code: generatedCode,
                    name: quickName.trim(),
                    address: quickAddress.trim() || null,
                    is_active: true
                })
                .select()
                .single()

            if (error) throw error
            showToast(`Đã tạo kho ký gửi "${data.name}"`, 'success')
            setQuickCode('')
            setQuickName('')
            setQuickAddress('')
            setShowQuickCreate(false)
            await loadWarehouses()
            setSelectedWhId(data.id)
        } catch (err: any) {
            showToast('Lỗi tạo kho ký gửi: ' + (err.message || 'Không xác định'), 'error')
        } finally {
            setCreatingWh(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!outboundOrder || !systemType) return
        if (!selectedWhId) {
            showToast('Vui lòng chọn Kho ký gửi nhận hàng', 'warning')
            return
        }

        setSubmitting(true)
        try {
            const created = await transferOutboundToConsignment({
                outboundOrderId: outboundOrder.id,
                systemCode: systemType,
                companyId: profile?.company_id || null,
                consignmentWarehouseId: selectedWhId,
                orderDate: new Date(orderDate).toISOString(),
                status,
                description
            })

            showToast(`Đã tạo phiếu nhập ký gửi ${created.code} thành công!`, 'success')
            onSuccess?.(created.code)
            onClose()
        } catch (err: any) {
            showToast(err.message || 'Lỗi khi chuyển sang Kho ký gửi', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen || !outboundOrder) return null

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between bg-amber-50/70 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            <Building2 size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                                Chuyển sang Nhập Kho Ký Gửi
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                                Nguồn: Phiếu xuất Kế toán <strong className="text-amber-700 dark:text-amber-300">{outboundOrder.code}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-zinc-800"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300">
                        <Package size={15} className="text-indigo-500 shrink-0" />
                        <span>Phiếu xuất Kế toán</span>
                        <ArrowRight size={14} className="text-amber-500 shrink-0" />
                        <span className="font-semibold text-amber-700 dark:text-amber-300">Phiếu nhập Kho ký gửi (NKG)</span>
                    </div>

                    {/* Chọn kho ký gửi */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                                Kho ký gửi nhận hàng <span className="text-red-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowQuickCreate(v => !v)}
                                className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
                            >
                                <Plus size={13} />
                                {showQuickCreate ? 'Đóng tạo nhanh' : 'Thêm kho mới'}
                            </button>
                        </div>

                        {loadingWh ? (
                            <div className="flex items-center gap-2 text-xs text-stone-500 py-2">
                                <Loader2 size={14} className="animate-spin" /> Đang tải danh sách kho ký gửi...
                            </div>
                        ) : (
                            <select
                                value={selectedWhId}
                                onChange={e => setSelectedWhId(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                required
                            >
                                <option value="">-- Chọn kho ký gửi --</option>
                                {warehouses.map(wh => (
                                    <option key={wh.id} value={wh.id}>
                                        [{wh.code}] {wh.name}{wh.address ? ` - ${wh.address}` : ''}
                                    </option>
                                ))}
                            </select>
                        )}

                        {showQuickCreate && (
                            <div className="mt-2.5 p-3 rounded-xl bg-amber-50/50 dark:bg-zinc-800/80 border border-amber-200/70 dark:border-zinc-700 space-y-2">
                                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                    Tạo nhanh Kho ký gửi mới
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Mã (VD: KKG-SG)"
                                        value={quickCode}
                                        onChange={e => setQuickCode(e.target.value)}
                                        className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Tên kho ký gửi *"
                                        value={quickName}
                                        onChange={e => setQuickName(e.target.value)}
                                        className="col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Địa chỉ / ghi chú (không bắt buộc)"
                                        value={quickAddress}
                                        onChange={e => setQuickAddress(e.target.value)}
                                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    />
                                    <button
                                        type="button"
                                        disabled={creatingWh}
                                        onClick={handleQuickCreateWarehouse}
                                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50"
                                    >
                                        {creatingWh ? 'Đang lưu...' : 'Lưu kho'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                                Ngày nhập ký gửi
                            </label>
                            <input
                                type="datetime-local"
                                value={orderDate}
                                onChange={e => setOrderDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                                Trạng thái phiếu
                            </label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value as ConsignmentOrderStatus)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            >
                                <option value="Completed">Hoàn thành (Cộng tồn ngay)</option>
                                <option value="Pending">Chờ duyệt</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                            Diễn giải / Ghi chú
                        </label>
                        <textarea
                            rows={2}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            placeholder="Ghi chú thêm về lô hàng gửi..."
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-zinc-800"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !selectedWhId}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Tạo Phiếu Nhập Ký Gửi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

'use client'

import React, { useEffect, useState } from 'react'
import { X, ArrowDownToLine, ArrowRight, Loader2, CheckCircle2, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { ConsignmentOrder } from './types'
import { transferConsignmentToInbound } from './consignmentService'

interface TransferToInboundModalProps {
    isOpen: boolean
    consignmentOrder: ConsignmentOrder | null
    onClose: () => void
    onSuccess?: (inboundCode: string) => void
}

export default function TransferToInboundModal({
    isOpen,
    consignmentOrder,
    onClose,
    onSuccess
}: TransferToInboundModalProps) {
    const { systemType } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()

    const [branches, setBranches] = useState<Array<{ id: string; name: string; is_default?: boolean }>>([])
    const [orderTypes, setOrderTypes] = useState<Array<{ id: string; name: string }>>([])
    const [warehouseName, setWarehouseName] = useState('')
    const [orderTypeId, setOrderTypeId] = useState('')
    const [status, setStatus] = useState<'Pending' | 'Completed'>('Pending')
    const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 16))
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!isOpen || !systemType) return
        loadMeta()
        setOrderDate(new Date().toISOString().slice(0, 16))
        setStatus('Pending')
        const whName = consignmentOrder?.consignment_warehouses?.name || 'Kho ký gửi'
        setDescription(
            consignmentOrder
                ? `Nhập thu hồi hàng ký gửi từ ${whName} (Phiếu ${consignmentOrder.code})${consignmentOrder.description ? ` - ${consignmentOrder.description}` : ''}`
                : ''
        )
    }, [isOpen, systemType, consignmentOrder?.id])

    async function loadMeta() {
        const [branchRes, typeRes] = await Promise.all([
            supabase.from('branches').select('id, name, is_default').order('is_default', { ascending: false }).order('name'),
            (supabase.from('order_types') as any)
                .select('id, name')
                .or('scope.eq.inbound,scope.eq.both')
                .or(`system_code.eq.${systemType},system_code.is.null`)
                .eq('is_active', true)
                .order('name')
        ])

        const bList = (branchRes.data || []) as Array<{ id: string; name: string; is_default?: boolean }>
        setBranches(bList)
        const def = bList.find(b => b.is_default) || bList[0]
        if (def) setWarehouseName(def.name)

        const tList = (typeRes.data || []) as Array<{ id: string; name: string }>
        setOrderTypes(tList)
        const returnType = tList.find(t =>
            t.name.toLowerCase().includes('ký gửi') ||
            t.name.toLowerCase().includes('nhập trả') ||
            t.name.toLowerCase().includes('thu hồi')
        )
        setOrderTypeId(returnType?.id || '')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!consignmentOrder || !systemType) return
        if (!warehouseName) {
            showToast('Vui lòng chọn Kho nhận của hệ thống Kế toán gốc', 'warning')
            return
        }

        setSubmitting(true)
        try {
            const inbound = await transferConsignmentToInbound({
                consignmentOrderId: consignmentOrder.id,
                systemCode: systemType,
                companyId: profile?.company_id || null,
                warehouseName,
                orderTypeId: orderTypeId || null,
                status,
                orderDate: new Date(orderDate).toISOString(),
                description
            })

            showToast(`Đã chuyển thành Phiếu nhập Kế toán ${inbound.code}!`, 'success')
            onSuccess?.(inbound.code)
            onClose()
        } catch (err: any) {
            showToast(err.message || 'Lỗi khi tạo Phiếu nhập Kế toán', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen || !consignmentOrder) return null

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between bg-emerald-50/70 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <ArrowDownToLine size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                                Chuyển về Phiếu Nhập Kế Toán Gốc
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                                Nguồn: Phiếu xuất ký gửi <strong className="text-emerald-700 dark:text-emerald-300">{consignmentOrder.code}</strong>
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
                        <Building2 size={15} className="text-amber-500 shrink-0" />
                        <span>Xuất Kho ký gửi ({consignmentOrder.consignment_warehouses?.name})</span>
                        <ArrowRight size={14} className="text-emerald-500 shrink-0" />
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">Phiếu nhập Kế toán (PNK)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                                Kho nhận (Kế toán gốc) <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={warehouseName}
                                onChange={e => setWarehouseName(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                required
                            >
                                <option value="">-- Chọn kho nhận --</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                                Loại phiếu nhập
                            </label>
                            <select
                                value={orderTypeId}
                                onChange={e => setOrderTypeId(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            >
                                <option value="">Mặc định (Nhập trả / Thu hồi)</option>
                                {orderTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                                Ngày nhập kế toán
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
                                Trạng thái PNK tạo ra
                            </label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value as 'Pending' | 'Completed')}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            >
                                <option value="Pending">Chờ duyệt (Kế toán kiểm duyệt lại)</option>
                                <option value="Completed">Hoàn thành ngay (Cộng tồn Kế toán)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                            Diễn giải Phiếu nhập Kế toán
                        </label>
                        <textarea
                            rows={2}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
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
                            disabled={submitting || !warehouseName}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Tạo Phiếu Nhập Kế Toán
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

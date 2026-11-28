'use client'

import React, { useEffect, useState } from 'react'
import { X, Building2, Save, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { ConsignmentWarehouse } from './types'

interface ConsignmentWarehouseModalProps {
    isOpen: boolean
    editWarehouse?: ConsignmentWarehouse | null
    onClose: () => void
    onSuccess: () => void
}

export default function ConsignmentWarehouseModal({
    isOpen,
    editWarehouse,
    onClose,
    onSuccess
}: ConsignmentWarehouseModalProps) {
    const { systemType } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()

    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [contactName, setContactName] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [notes, setNotes] = useState('')
    const [isActive, setIsActive] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        if (editWarehouse) {
            setCode(editWarehouse.code)
            setName(editWarehouse.name)
            setAddress(editWarehouse.address || '')
            setContactName(editWarehouse.contact_name || '')
            setContactPhone(editWarehouse.contact_phone || '')
            setNotes(editWarehouse.notes || '')
            setIsActive(editWarehouse.is_active)
        } else {
            setCode(`KKG-${Date.now().toString().slice(-4)}`)
            setName('')
            setAddress('')
            setContactName('')
            setContactPhone('')
            setNotes('')
            setIsActive(true)
        }
    }, [isOpen, editWarehouse?.id])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim() || !code.trim()) {
            showToast('Vui lòng nhập đầy đủ mã và tên kho ký gửi', 'warning')
            return
        }

        setSubmitting(true)
        try {
            const payload = {
                code: code.trim().toUpperCase(),
                name: name.trim(),
                address: address.trim() || null,
                contact_name: contactName.trim() || null,
                contact_phone: contactPhone.trim() || null,
                notes: notes.trim() || null,
                is_active: isActive,
                updated_at: new Date().toISOString()
            }

            if (editWarehouse) {
                const { error } = await (supabase.from('consignment_warehouses') as any)
                    .update(payload)
                    .eq('id', editWarehouse.id)
                if (error) throw error
                showToast('Đã cập nhật thông tin kho ký gửi', 'success')
            } else {
                const { error } = await (supabase.from('consignment_warehouses') as any)
                    .insert({
                        ...payload,
                        company_id: profile?.company_id || undefined,
                        system_code: systemType
                    })
                if (error) throw error
                showToast('Đã thêm kho ký gửi mới', 'success')
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            showToast('Lỗi lưu kho ký gửi: ' + (err.message || 'Không xác định'), 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            <Building2 size={18} />
                        </div>
                        <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                            {editWarehouse ? 'Sửa Kho ký gửi' : 'Thêm Kho ký gửi mới'}
                        </h3>
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
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Mã kho <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 uppercase"
                                required
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Tên kho ký gửi <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="VD: Kho Lạnh Sài Gòn, Kho Bến Lức..."
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                            Địa chỉ
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="Địa chỉ kho bên ngoài..."
                            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Người liên hệ / Thủ kho
                            </label>
                            <input
                                type="text"
                                value={contactName}
                                onChange={e => setContactName(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Số điện thoại
                            </label>
                            <input
                                type="text"
                                value={contactPhone}
                                onChange={e => setContactPhone(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                            Ghi chú
                        </label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                        />
                        Đang hoạt động (cho phép chọn khi tạo phiếu)
                    </label>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Lưu Kho ký gửi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

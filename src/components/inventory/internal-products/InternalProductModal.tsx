'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Database } from '@/lib/database.types'
import { X, Save, Box } from 'lucide-react'

type Product = Database['public']['Tables']['products']['Row']

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    onSuccess: () => void
}

export default function InternalProductModal({ open, onOpenChange, product, onSuccess }: Props) {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [internalCode, setInternalCode] = useState('')
    const [internalName, setInternalName] = useState('')

    useEffect(() => {
        if (open && product) {
            setInternalCode(product.internal_code || '')
            setInternalName(product.internal_name || '')
        } else {
            setInternalCode('')
            setInternalName('')
        }
    }, [open, product])

    const handleSave = async () => {
        if (!product) return

        setLoading(true)
        try {
            // Check for duplicate internal_code if it's not empty
            if (internalCode.trim()) {
                const { data: existing, error: checkError } = await supabase
                    .from('products')
                    .select('id')
                    .eq('internal_code', internalCode.trim())
                    .neq('id', product.id)
                    .single()

                if (existing) {
                    showToast('Mã nội bộ này đã được sử dụng cho một sản phẩm khác', 'error')
                    setLoading(false)
                    return
                }
            }

            const { error } = await supabase
                .from('products')
                .update({
                    internal_code: internalCode.trim() || null,
                    internal_name: internalName.trim() || null
                })
                .eq('id', product.id)

            if (error) throw error

            showToast('Cập nhật thông tin nội bộ thành công', 'success')
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error('Update error:', error)
            showToast('Lỗi khi cập nhật: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
            <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-slide-up border border-stone-100">
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                            <Box size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-stone-800 tracking-tight">Cập nhật mã nội bộ</h2>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{product?.sku}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                        <p className="text-sm font-bold text-stone-700">{product?.name}</p>
                        <p className="text-xs text-stone-500 mt-1">Mã NSX: {product?.part_number || '---'}</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-2">Mã nội bộ</label>
                            <input
                                type="text"
                                value={internalCode}
                                onChange={(e) => setInternalCode(e.target.value)}
                                placeholder="Nhập mã nội bộ (nếu có)"
                                className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-stone-800 placeholder:text-stone-300"
                            />
                            <p className="text-[11px] text-stone-500 mt-1.5 font-medium">* Mã nội bộ là duy nhất và dùng để quét barcode nhanh tại xưởng.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-2">Tên nội bộ</label>
                            <input
                                type="text"
                                value={internalName}
                                onChange={(e) => setInternalName(e.target.value)}
                                placeholder="Nhập tên nội bộ (nếu có)"
                                className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-stone-800 placeholder:text-stone-300"
                            />
                            <p className="text-[11px] text-stone-500 mt-1.5 font-medium">* Tên thường gọi của sản phẩm dùng để tìm kiếm, làm phiếu.</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="px-6 py-2.5 rounded-xl text-stone-500 font-bold hover:bg-stone-200 transition-colors text-sm uppercase tracking-wider"
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 active:scale-95 transition-all text-sm uppercase tracking-wider disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Lưu lại
                    </button>
                </div>
            </div>
        </div>
    )
}

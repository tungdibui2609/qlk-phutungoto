'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QrCode, X, RefreshCw, Trash2, Box, Layers } from 'lucide-react'

interface LotBoxLabelsModalProps {
    lotId: string
    lotCode: string
    onClose: () => void
}

export function LotBoxLabelsModal({ lotId, lotCode, onClose }: LotBoxLabelsModalProps) {
    const { showToast } = useToast()
    const [labels, setLabels] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUnlinking, setIsUnlinking] = useState<string | null>(null)

    const fetchLinkedBoxLabels = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('box_labels')
                .select(`
                    id,
                    code,
                    quantity,
                    unit,
                    status,
                    semi_finished_lot_code,
                    finished_lot_code,
                    products (
                        name,
                        sku,
                        internal_name
                    )
                `)
                .eq('lot_id', lotId)
                .order('code', { ascending: true })

            if (error) throw error
            setLabels(data || [])
        } catch (err: any) {
            console.error('Lỗi khi tải tem thùng đã liên kết với Pallet:', err)
            showToast('Không thể tải danh sách tem thùng: ' + err.message, 'error')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (lotId) {
            fetchLinkedBoxLabels()
        }
    }, [lotId])

    const handleUnlink = async (labelId: string, labelCode: string) => {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn gỡ tem thùng "${labelCode}" ra khỏi Pallet này không?`)
        if (!confirmed) return

        setIsUnlinking(labelId)
        try {
            const { error } = await supabase
                .from('box_labels')
                .update({ lot_id: null, status: 'printed' })
                .eq('id', labelId)

            if (error) throw error

            setLabels(prev => prev.filter(item => item.id !== labelId))
            showToast(`Đã gỡ liên kết tem ${labelCode} thành công`, 'success')
        } catch (err: any) {
            console.error('Lỗi gỡ liên kết tem thùng:', err)
            showToast('Không thể gỡ liên kết: ' + err.message, 'error')
        } finally {
            setIsUnlinking(null)
        }
    }

    // Trích xuất 3 số thứ tự cuối cùng của tem để hiển thị STT gọn gàng
    const getBoxIndex = (code: string): string => {
        if (!code) return '---'
        const parts = code.trim().split('-')
        const lastPart = parts[parts.length - 1]
        if (lastPart && !isNaN(Number(lastPart))) {
            return lastPart
        }
        return code
    }

    const totalWeight = labels.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)
    const displayUnit = labels[0]?.unit || 'Kg'

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-stone-50 dark:bg-zinc-800/40 border-b border-stone-100 dark:border-zinc-800">
                    <div>
                        <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                            <Layers className="text-emerald-600 animate-pulse" size={20} />
                            Tem Thùng Đã Gắn Trên Pallet
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-mono">
                            Pallet Code: <span className="font-black text-stone-850 dark:text-white uppercase">{lotCode}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-3">
                            <RefreshCw className="text-emerald-500 animate-spin" size={28} />
                            <p className="text-xs font-semibold text-stone-500">Đang truy xuất thông tin tem thùng...</p>
                        </div>
                    ) : labels.length > 0 ? (
                        <div className="space-y-4">
                            {/* Panel thống kê */}
                            <div className="grid grid-cols-2 gap-4 bg-emerald-500/5 dark:bg-emerald-450/5 border border-emerald-500/10 rounded-2xl p-4 text-xs">
                                <div className="space-y-0.5">
                                    <div className="text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider text-[10px]">Tổng số tem thùng</div>
                                    <div className="text-lg font-black text-stone-900 dark:text-white tabular-nums">{labels.length} tem</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider text-[10px]">Tổng trọng lượng xếp</div>
                                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{totalWeight.toFixed(2)} {displayUnit}</div>
                                </div>
                            </div>

                            {/* Bảng danh sách tem */}
                            <div className="border border-stone-150 dark:border-zinc-800 rounded-2xl overflow-hidden bg-stone-50/10 dark:bg-zinc-900/20">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-stone-150 dark:border-zinc-800 bg-stone-100/50 dark:bg-zinc-800/30 text-[9px] font-black tracking-widest text-stone-400 dark:text-stone-500 uppercase">
                                            <th className="px-4 py-3 text-center w-16">STT</th>
                                            <th className="px-4 py-3">Mã tem thùng</th>
                                            <th className="px-4 py-3">Sản phẩm</th>
                                            <th className="px-4 py-3 text-right">Trọng lượng</th>
                                            <th className="px-4 py-3 text-center">Gỡ liên kết</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-150/40 dark:divide-zinc-800/50">
                                        {labels.map((label, idx) => {
                                            const prodName = label.products 
                                                ? (label.products.internal_name || label.products.name)
                                                : 'Sản phẩm không rõ'
                                            const prodSku = label.products ? label.products.sku : '---'

                                            return (
                                                <tr key={label.id || idx} className="hover:bg-stone-50/20 dark:hover:bg-zinc-800/10 transition-colors">
                                                    <td className="px-4 py-3 text-center font-bold text-stone-450 tabular-nums">
                                                        #{idx + 1}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-bold text-stone-850 dark:text-zinc-150 uppercase" title={label.code}>
                                                        #{getBoxIndex(label.code)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-stone-900 dark:text-white line-clamp-1 leading-normal uppercase">
                                                            {prodName}
                                                        </div>
                                                        <div className="text-[9px] text-stone-450 font-mono leading-none mt-0.5">{prodSku}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-stone-900 dark:text-zinc-200 tabular-nums">
                                                        {label.quantity} {label.unit}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            disabled={isUnlinking === label.id}
                                                            onClick={() => handleUnlink(label.id, label.code)}
                                                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                                            title="Gỡ tem khỏi Pallet"
                                                        >
                                                            {isUnlinking === label.id ? (
                                                                <RefreshCw className="animate-spin" size={14} />
                                                            ) : (
                                                                <Trash2 size={14} />
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16 space-y-3">
                            <Box className="text-stone-300 dark:text-zinc-700 mx-auto" size={48} />
                            <div>
                                <h5 className="text-xs font-bold text-stone-700 dark:text-zinc-300">Không tìm thấy tem nào</h5>
                                <p className="text-[10px] text-stone-400 dark:text-stone-500 max-w-xs mx-auto leading-relaxed mt-1">
                                    Pallet hiện chưa được gán bất kỳ tem thùng hàng nào. Quét mã xếp Pallet để thiết lập liên kết nguồn gốc.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-stone-50 dark:bg-zinc-800/40 border-t border-stone-100 dark:border-zinc-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}

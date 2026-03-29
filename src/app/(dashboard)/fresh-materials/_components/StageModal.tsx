'use client'

import { useState, useEffect } from 'react'
import { Save, X, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'

interface StageModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    batchId: string
    editItem?: any | null
    nextOrder: number
    previousStageOutput: number
    defaultUnit: string
}

export default function StageModal({ isOpen, onClose, onSuccess, batchId, editItem, nextOrder, previousStageOutput, defaultUnit }: StageModalProps) {
    const { showToast } = useToast()
    const [isSaving, setIsSaving] = useState(false)

    const [stageName, setStageName] = useState('')
    const [stageOrder, setStageOrder] = useState(1)
    const [inputQuantity, setInputQuantity] = useState(0)
    const [inputUnit, setInputUnit] = useState('Kg')
    const [notes, setNotes] = useState('')
    const [isProductionLink, setIsProductionLink] = useState(false)

    useEffect(() => {
        if (editItem) {
            setStageName(editItem.stage_name || '')
            setStageOrder(editItem.stage_order || 1)
            setInputQuantity(editItem.input_quantity || 0)
            setInputUnit(editItem.input_unit || defaultUnit)
            setNotes(editItem.notes || '')
            setIsProductionLink(editItem.is_production_link || false)
        } else {
            setStageName('')
            setStageOrder(nextOrder)
            setInputQuantity(previousStageOutput)
            setInputUnit(defaultUnit)
            setNotes('')
            setIsProductionLink(false)
        }
    }, [editItem, isOpen, nextOrder, previousStageOutput, defaultUnit])

    const suggestedNames = ['Phân loại', 'Cấp đông', 'Rã đông', 'Sơ chế', 'Tinh chế', 'Đóng gói', 'Kiểm tra QC', 'Bảo quản']

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!stageName.trim()) {
            showToast('Vui lòng nhập tên giai đoạn', 'error')
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                batch_id: batchId,
                stage_order: stageOrder,
                stage_name: stageName.trim(),
                input_quantity: inputQuantity || 0,
                input_unit: inputUnit,
                is_production_link: isProductionLink,
                notes: notes || null,
                updated_at: new Date().toISOString()
            }

            if (editItem?.id) {
                const { error } = await (supabase as any)
                    .from('fresh_material_stages')
                    .update(payload)
                    .eq('id', editItem.id)
                if (error) throw error
            } else {
                const { error } = await (supabase as any)
                    .from('fresh_material_stages')
                    .insert([{ ...payload, status: 'PENDING' }])
                if (error) throw error
            }

            showToast(editItem ? 'Cập nhật giai đoạn thành công' : 'Thêm giai đoạn thành công', 'success')
            onSuccess()
            onClose()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[28px] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                            <Layers size={18} className="text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-800 dark:text-white">
                                {editItem ? 'Sửa giai đoạn' : 'Thêm giai đoạn mới'}
                            </h3>
                            <p className="text-[10px] text-stone-400 font-medium">Giai đoạn xử lý nguyên liệu</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full">
                        <X size={20} className="text-stone-400" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Stage Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500">Tên giai đoạn</label>
                        <input
                            type="text"
                            value={stageName}
                            onChange={e => setStageName(e.target.value)}
                            placeholder="VD: Phân loại, Cấp đông..."
                            className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                            required
                        />
                        {/* Quick suggestions */}
                        <div className="flex flex-wrap gap-1.5">
                            {suggestedNames.map(name => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => setStageName(name)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                        stageName === name
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-stone-100 dark:bg-zinc-800 text-stone-500 hover:bg-emerald-100 hover:text-emerald-600'
                                    }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Production Link Toggle */}
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-between">
                        <div>
                            <div className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest mb-0.5">Kết nối từ Lệnh sản xuất</div>
                            <div className="text-[10px] text-stone-400 font-bold uppercase italic">Dữ liệu thành phẩm lấy tự động</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isProductionLink}
                                onChange={(e) => setIsProductionLink(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600 shadow-sm" />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Order */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500">Thứ tự</label>
                            <input
                                type="number"
                                value={stageOrder}
                                onChange={e => setStageOrder(parseInt(e.target.value) || 1)}
                                min={1}
                                className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-black text-lg focus:ring-4 focus:ring-emerald-100 outline-none"
                            />
                        </div>

                        {/* Input Quantity */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500">SL đầu vào ({inputUnit})</label>
                            <input
                                type="number"
                                value={inputQuantity || ''}
                                onChange={e => setInputQuantity(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-black text-lg focus:ring-4 focus:ring-emerald-100 outline-none"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500">Ghi chú</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Ghi chú..."
                            className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-medium text-sm focus:ring-4 focus:ring-emerald-100 outline-none resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-stone-500 hover:bg-stone-100 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
                            {editItem ? 'Cập nhật' : 'Thêm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

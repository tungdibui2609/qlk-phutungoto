'use client'

import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Pencil, X } from 'lucide-react'

interface EditJournalModalProps {
    editingRecord: any
    editType: 'in' | 'out'
    setEditType: (v: 'in' | 'out') => void
    editQuantity: number
    setEditQuantity: (v: number) => void
    editUnit: string
    setEditUnit: (v: string) => void
    editNotes: string
    setEditNotes: (v: string) => void
    savingEdit: boolean
    pinnedProducts: any[]
    allProducts: any[]
    availableUnits: string[]
    getProductUnits: (p: any) => string[]
    cleanUnitLabel: (u: string) => string
    onClose: () => void
    onSave: () => void
}

/** Modal chỉnh sửa từng dòng nhật ký số liệu trên Web. */
export default function EditJournalModal({
    editingRecord,
    editType,
    setEditType,
    editQuantity,
    setEditQuantity,
    editUnit,
    setEditUnit,
    editNotes,
    setEditNotes,
    savingEdit,
    pinnedProducts,
    allProducts,
    availableUnits,
    getProductUnits,
    cleanUnitLabel,
    onClose,
    onSave,
}: EditJournalModalProps) {
    if (!editingRecord) return null

    const prod =
        pinnedProducts.find(p => p.name === editingRecord.item_name) ||
        allProducts.find(p => p.name === editingRecord.item_name)
    const productUnits = prod ? getProductUnits(prod) : []
    const baseUnits =
        productUnits.length > 0
            ? productUnits
            : prod?.id?.startsWith('custom_')
              ? availableUnits
              : prod?.unit
                ? [prod.unit]
                : availableUnits
    const currentCleanUnit = cleanUnitLabel(editUnit) || editUnit
    const unitsToShow = Array.from(
        new Set([currentCleanUnit, ...baseUnits].map(u => cleanUnitLabel(u)).filter(Boolean))
    )

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
                <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-zinc-800 mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                            <Pencil className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                Chỉnh Sửa Dòng Số Liệu
                            </h3>
                            <p className="text-xs text-stone-400">
                                {editingRecord.delivery_code || 'Ghi nhận đợt'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-3.5 overflow-y-auto flex-1 pr-0.5">
                    <div>
                        <label className="block text-xs font-semibold text-stone-500 mb-1">
                            Sản phẩm
                        </label>
                        <div className="p-2.5 bg-stone-50 dark:bg-zinc-800/60 rounded-xl font-bold text-xs text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-zinc-700/60 break-words">
                            {editingRecord.item_name}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-stone-500 mb-1.5">
                            Phân loại thao tác
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setEditType('in')}
                                className={`h-11 sm:h-9 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition border ${
                                    editType === 'in'
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                        : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-zinc-700 hover:bg-stone-50'
                                }`}
                            >
                                <ArrowDownLeft className="w-4 h-4" />
                                Nhập kho (+)
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditType('out')}
                                className={`h-11 sm:h-9 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition border ${
                                    editType === 'out'
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                        : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-zinc-700 hover:bg-stone-50'
                                }`}
                            >
                                <ArrowUpRight className="w-4 h-4" />
                                Xuất kho (-)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-stone-500 mb-1">
                                Số lượng
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={editQuantity}
                                onChange={e => setEditQuantity(parseFloat(e.target.value) || 0)}
                                className="w-full text-base font-bold p-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-stone-500 mb-1">
                                Đơn vị tính
                            </label>
                            <select
                                value={editUnit}
                                onChange={e => setEditUnit(e.target.value)}
                                className="w-full text-xs font-bold p-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 h-[42px]"
                            >
                                {unitsToShow.map(u => (
                                    <option key={u} value={u}>
                                        {u}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-stone-500 mb-1">
                            Ghi chú
                        </label>
                        <input
                            type="text"
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            placeholder="Ghi chú đợt (nếu có)..."
                            className="w-full text-xs p-3 sm:p-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-11 sm:h-9 px-4 text-xs font-semibold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        disabled={savingEdit}
                        onClick={onSave}
                        className="h-11 sm:h-9 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center"
                    >
                        {savingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                    </button>
                </div>
            </div>
        </div>
    )
}

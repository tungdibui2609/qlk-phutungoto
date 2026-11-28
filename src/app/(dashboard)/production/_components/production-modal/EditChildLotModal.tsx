'use client'

import React from 'react'
import { X, Edit } from 'lucide-react'
import type { ProductionLot } from './types'

interface EditChildLotModalProps {
    editingLot: ProductionLot | null
    setEditingLot: React.Dispatch<React.SetStateAction<ProductionLot | null>>
    products: any[]
    editLotSearchTerm: string
    setEditLotSearchTerm: React.Dispatch<React.SetStateAction<string>>
    editLotShowSuggestions: boolean
    setEditLotShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>
    setEditLotProductId: React.Dispatch<React.SetStateAction<string>>
    setEditLotWeightPerUnit: React.Dispatch<React.SetStateAction<number>>
    editLotLotCode: string
    setEditLotLotCode: React.Dispatch<React.SetStateAction<string>>
    editLotProductionDate: string
    setEditLotProductionDate: React.Dispatch<React.SetStateAction<string>>
    editLotPlannedQty: number
    setEditLotPlannedQty: React.Dispatch<React.SetStateAction<number>>
    handleSaveEditedLot: () => Promise<void>
}

export function EditChildLotModal({
    editingLot,
    setEditingLot,
    products,
    editLotSearchTerm,
    setEditLotSearchTerm,
    editLotShowSuggestions,
    setEditLotShowSuggestions,
    setEditLotProductId,
    setEditLotWeightPerUnit,
    editLotLotCode,
    setEditLotLotCode,
    editLotProductionDate,
    setEditLotProductionDate,
    editLotPlannedQty,
    setEditLotPlannedQty,
    handleSaveEditedLot,
}: EditChildLotModalProps) {
    if (!editingLot) return null
    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-[150] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-4 py-3 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-stone-50/70 dark:bg-zinc-900">
                    <div className="flex items-center gap-2">
                        <Edit size={14} className="text-orange-500" />
                        <span className="text-xs font-bold text-stone-800 dark:text-zinc-200">Chỉnh sửa thông tin Lot</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setEditingLot(null)}
                        className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                    <div className="relative">
                        <label className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400 mb-1 block">Sản phẩm sản xuất</label>
                        <input
                            type="text"
                            placeholder="Tìm sản phẩm..."
                            value={editLotSearchTerm}
                            onChange={(e) => {
                                setEditLotSearchTerm(e.target.value)
                                setEditLotShowSuggestions(true)
                            }}
                            onFocus={() => setEditLotShowSuggestions(true)}
                            className="w-full h-8 px-2.5 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                        />

                        {editLotShowSuggestions && editLotSearchTerm.trim() !== '' && (
                            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-44 overflow-y-auto z-[160]">
                                {products
                                    .filter(p => p.name.toLowerCase().includes(editLotSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(editLotSearchTerm.toLowerCase()))
                                    .map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                                setEditLotProductId(p.id)
                                                setEditLotSearchTerm(p.name)
                                                setEditLotShowSuggestions(false)
                                                setEditLotWeightPerUnit(p.weight_kg || 0)
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50 dark:hover:bg-zinc-700 text-stone-800 dark:text-stone-200 border-b border-stone-100 dark:border-zinc-700 last:border-0"
                                        >
                                            <div className="font-semibold">{p.name}</div>
                                            <div className="text-[10px] text-stone-400">SKU: {p.sku} • {p.weight_kg}kg</div>
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400 mb-1 block">Mã Lot sản xuất</label>
                            <input
                                type="text"
                                placeholder="Nhập mã Lot..."
                                value={editLotLotCode}
                                onChange={(e) => setEditLotLotCode(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-semibold uppercase text-stone-800 dark:text-stone-100 focus:outline-none focus:border-orange-500"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400 mb-1 block">Ngày sản xuất</label>
                            <input
                                type="date"
                                value={editLotProductionDate}
                                onChange={(e) => setEditLotProductionDate(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-medium text-stone-800 dark:text-stone-100 focus:outline-none focus:border-orange-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400 mb-1 block">Sản lượng kế hoạch (Thùng / Bao)</label>
                        <input
                            type="number"
                            placeholder="Kế hoạch..."
                            value={editLotPlannedQty || ''}
                            onChange={(e) => setEditLotPlannedQty(parseFloat(e.target.value) || 0)}
                            className="w-full h-8 px-2.5 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-orange-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 bg-stone-50/70 dark:bg-zinc-900 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setEditingLot(null)}
                        className="px-3 py-1.5 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 rounded-lg text-xs font-semibold hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveEditedLot}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                    >
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    )
}
